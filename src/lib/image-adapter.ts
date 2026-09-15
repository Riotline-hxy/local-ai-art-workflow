import { resolveImageProtocol, type ImageProtocol } from './image-protocol';

type ObjectValue = Record<string, unknown>;
const object = (v: unknown): ObjectValue => v && typeof v === 'object' ? v as ObjectValue : {};
export type ImageSource = { b64_json?: string; url?: string };

/** Normalize explicit image fields only; never fetch arbitrary links in model prose. */
export function extractImages(payload: unknown): ImageSource[] {
    const root = object(payload);
    const images: ImageSource[] = [];
    const add = (value: unknown) => {
        const item = object(value);
        const inline = object(item.inlineData || item.inline_data);
        const nestedUrl = object(item.image_url).url;
        const b64 = item.b64_json || inline.data;
        const url = item.url || (typeof item.image_url === 'string' ? item.image_url : nestedUrl);
        if (typeof b64 === 'string' && b64) images.push({ b64_json: b64 });
        else if (typeof url === 'string' && url) images.push({ url });
    };
    if (Array.isArray(root.data)) root.data.forEach(add);
    if (Array.isArray(root.candidates)) for (const candidate of root.candidates) {
        const parts = object(object(candidate).content).parts;
        if (Array.isArray(parts)) parts.forEach(add);
    }
    if (Array.isArray(root.choices)) for (const choice of root.choices) {
        const message = object(object(choice).message);
        if (Array.isArray(message.images)) message.images.forEach(add);
        if (Array.isArray(message.content)) message.content.forEach(add);
        if (typeof message.content === 'string') {
            for (const match of message.content.matchAll(/!\[[^\]]*\]\((https:\/\/[^\s)]+|data:image\/[^\s)]+)\)/g)) images.push({ url: match[1] });
        }
    }
    return images;
}

export type AdapterInput = {
    model: string; prompt: string; mode: 'generate' | 'edit'; protocol: ImageProtocol;
    n: number; size?: string; images: { data: string; mimeType: string }[]; hasMask: boolean;
};
export function buildImageRequest(input: AdapterInput, baseURL: string) {
    const protocol = resolveImageProtocol(input.model, input.protocol);
    const base = baseURL.replace(/\/+$/, '');
    const { model, prompt, n, images } = input;
    if (input.hasMask) throw new Error('此协议不支持局部蒙版，请移除蒙版或选择 GPT Images。 / Masks require GPT Images.');
    if ((protocol === 'gemini' || protocol === 'chat') && n !== 1) throw new Error('此协议每次请求只支持一张图片，请将生成张数设为 1。 / Set image count to 1.');
    const dataURLs = images.map(img => `data:${img.mimeType};base64,${img.data}`);
    if (protocol === 'gemini') {
        const apiRoot = base.replace(/\/v1(?:beta)?$/, '');
        return { url: `${apiRoot}/v1beta/models/${encodeURIComponent(model)}:generateContent`, body: {
            contents: [{ role: 'user', parts: [{ text: prompt }, ...images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } }))] }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
        } };
    }
    if (protocol === 'chat') return { url: `${base}/chat/completions`, body: {
        model, stream: false, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, ...dataURLs.map(url => ({ type: 'image_url', image_url: { url } }))] }]
    } };
    if (protocol === 'seedream') {
        if (input.mode === 'edit' && /seedream-3/i.test(model)) throw new Error('Seedream 3 文生图模型不支持参考图编辑。 / Seedream 3 text-to-image does not support editing.');
        if (n !== 1) throw new Error('Seedream 适配器暂时每次生成一张，请将张数设为 1。 / Set image count to 1 for Seedream.');
        return { url: `${base}/images/generations`, body: {
            model, prompt, response_format: 'b64_json', size: input.size && input.size !== 'auto' ? input.size : /seedream-3/i.test(model) ? '1024x1024' : '2K',
            ...(images.length ? { image: dataURLs.length === 1 ? dataURLs[0] : dataURLs } : {})
        } };
    }
    // Generic OpenAI-compatible Images: omit GPT-only quality/background/moderation/stream fields.
    return { url: `${base}/images/${input.mode === 'edit' ? 'edits' : 'generations'}`, body: {
        model, prompt, n, response_format: 'b64_json', ...(input.size && input.size !== 'auto' && !/grok/i.test(model) ? { size: input.size } : {}),
        ...(images.length ? { image: dataURLs.length === 1 ? dataURLs[0] : dataURLs } : {})
    } };
}

export async function callImageAdapter(input: AdapterInput, baseURL: string, apiKey: string, signal?: AbortSignal): Promise<unknown> {
    const request = buildImageRequest(input, baseURL);
    const nativeGoogle = new URL(request.url).hostname === 'generativelanguage.googleapis.com';
    const multipart = resolveImageProtocol(input.model, input.protocol) === 'images' && input.mode === 'edit' && !/grok/i.test(input.model);
    const form = new FormData();
    if (multipart) {
        for (const [key, value] of Object.entries(request.body)) if (key !== 'image') form.set(key, String(value));
        input.images.forEach((img, index) => form.append(input.images.length === 1 ? 'image' : 'image[]', new Blob([Buffer.from(img.data, 'base64')], { type: img.mimeType }), `reference-${index}.${img.mimeType.split('/')[1] || 'png'}`));
    }
    // A single upstream call: no hidden retries or paid endpoint probing.
    const response = await fetch(request.url, {
        method: 'POST', headers: { ...(nativeGoogle ? { 'x-goog-api-key': apiKey } : { Authorization: `Bearer ${apiKey}` }), ...(multipart ? {} : { 'Content-Type': 'application/json' }) },
        body: multipart ? form : JSON.stringify(request.body), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(600_000)]) : AbortSignal.timeout(600_000)
    });
    const raw = await response.text();
    let result: unknown;
    try { result = JSON.parse(raw); } catch { throw new Error(`图片服务返回了非 JSON 响应（HTTP ${response.status}），请检查所选协议和 Base URL。 / Non-JSON image response.`); }
    if (!response.ok || object(result).error) {
        const upstream = object(object(result).error).message;
        const message = typeof upstream === 'string' ? upstream.replaceAll(apiKey, '[redacted]').slice(0,500) : `HTTP ${response.status}`;
        throw new Error(`图片请求失败 [${resolveImageProtocol(input.model, input.protocol)}]：${message}`);
    }
    return result;
}
