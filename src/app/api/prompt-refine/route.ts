import { effortParams, isTextEffort } from '@/lib/text-options';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createHash } from 'node:crypto';
import { getRuntimeConfig } from '@/lib/runtime-config';
import { accessDenied, sameSecret } from '@/lib/private-access';
export async function POST(request: NextRequest) {
    const denied = accessDenied(request); if (denied) return denied;
    try {
        const body = await request.json();
        if (process.env.APP_PASSWORD && !sameSecret(String(body.passwordHash || ''), createHash('sha256').update(process.env.APP_PASSWORD).digest('hex'))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const config = await getRuntimeConfig();
        if (!config.promptRefinerEnabled) return NextResponse.json({ error: 'Prompt refiner is disabled.' }, { status: 409 });
        if (!config.promptRefinerApiKey || !config.promptRefinerModel) return NextResponse.json({ error: 'Configure the text API key and select a text model in Settings.' }, { status: 503 });
        const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
        if (!prompt) return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
        const client = new OpenAI({ apiKey: config.promptRefinerApiKey, baseURL: config.promptRefinerBaseUrl, maxRetries: 0, timeout: 180000 });
        const system = '你是图片生成提示词整理器。将用户需求改写为可直接交给图片生成或编辑模型的提示词。保留用户语言、意图、指定文字、限制和参考图编号，不虚构品牌信息。你只能读取文本，不能看到图片，不要声称分析了图像内容。仅输出最终画面描述，可按任务、必须保留、必须修改、视觉风格、构图、文字要求、禁止元素组织。不要输出思维过程。';
        const result = await client.chat.completions.create({ model: config.promptRefinerModel, ...effortParams(isTextEffort(config.promptRefinerEffort) ? config.promptRefinerEffort : 'default'), messages: [
            { role: 'system', content: system },
            { role: 'user', content: 'Task: ' + (body.mode === 'edit' ? 'image edit' : 'image generation') + '\n' + prompt }
        ] });
        const refined = result.choices[0]?.message?.content?.trim();
        if (!refined) return NextResponse.json({ error: 'The text model returned an empty prompt.' }, { status: 502 });
        return NextResponse.json({ prompt: refined }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        const status = error instanceof OpenAI.APIError ? error.status : undefined;
        return NextResponse.json({ error: status ? 'Text API request failed (' + status + '). Check the provider settings.' : 'Prompt refinement failed or timed out.' }, { status: status && status >= 400 && status < 600 ? status : 502 });
    }
}
