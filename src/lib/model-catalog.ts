type Model = { id?: unknown; type?: unknown; capabilities?: unknown; modalities?: unknown; output_modalities?: unknown; supported_endpoint_types?: unknown; endpoints?: unknown };
export type ModelKind = 'image' | 'text' | 'other';
export function modelKind(model: Model): ModelKind {
    const id = typeof model.id === 'string' ? model.id.toLowerCase() : '';
    const endpoints = JSON.stringify(model.supported_endpoint_types || model.endpoints || '').toLowerCase();
    const output = JSON.stringify(model.output_modalities || '').toLowerCase();
    const type = typeof model.type === 'string' ? model.type.toLowerCase() : '';
    if (/image/.test(output) || /image/.test(type) || /images\/(generations|edits)|image-generation|image-edit/.test(endpoints) || /gpt-image|dall-e|imagen|flux|(^|[-_.])image([-.]|$)|nano-banana|seedream|stable-diffusion|(^|[-_/])sdxl|gemini.*image|ideogram|recraft/.test(id)) return 'image';
    if (/embedding|whisper|tts|transcri|realtime|moderation|rerank|sora|veo|video|audio/.test(id + ' ' + type)) return 'other';
    if (/chat|text|language/.test(type) || /chat\/completions|responses/.test(endpoints) || /text/.test(output)) return 'text';
    // /models has no universal capability schema; recognize common chat families.
    if (/gpt-|chatgpt|(^|[/_-])o[134]([\W_]|$)|claude|gemini|deepseek|qwen|llama|mistral|mixtral|gemma|glm-|grok|kimi|moonshot|doubao|yi-|command-|ernie/.test(id)) return 'text';
    return 'other';
}
export function filterModels(data: unknown, kind: 'image' | 'text'): string[] {
    if (!Array.isArray(data)) throw new Error('Invalid model list');
    return [...new Set(data.filter((m): m is Model & { id: string } => !!m && typeof m === 'object' && typeof m.id === 'string' && !!m.id.trim() && modelKind(m) === kind).map(m => m.id.trim()))].sort();
}
