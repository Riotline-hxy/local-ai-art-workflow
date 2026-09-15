import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createHash } from 'node:crypto';
import { getRuntimeConfig } from '@/lib/runtime-config';
import { accessDenied, sameSecret } from '@/lib/private-access';
import { effortParams, isTextEffort } from '@/lib/text-options';
import { filterModels } from '@/lib/model-catalog';

export async function POST(request: NextRequest) {
    const denied = accessDenied(request); if (denied) return denied;
    try {
        const body = await request.json();
        if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
        if (process.env.APP_PASSWORD && !sameSecret(String(body.passwordHash || ''), createHash('sha256').update(process.env.APP_PASSWORD).digest('hex'))) {
            return NextResponse.json({ error: 'Access password required.', code: 'password_required' }, { status: 401 });
        }
        const config = await getRuntimeConfig();
        if (!config.promptRefinerApiKey) return NextResponse.json({ error: 'Configure the text API key in Settings.' }, { status: 503 });
        const model = typeof body.model === 'string' ? body.model.trim() : config.promptRefinerModel;
        const effort = body.effort ?? config.promptRefinerEffort ?? 'default';
        if (!model || model.length > 256 || !isTextEffort(effort)) return NextResponse.json({ error: 'Select a valid text model and reasoning effort.' }, { status: 400 });
        if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 200) return NextResponse.json({ error: 'Messages are required.' }, { status: 400 });
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
        for (const message of body.messages.slice(-30)) {
            if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string' || message.content.length > 100000) return NextResponse.json({ error: 'Invalid message.' }, { status: 400 });
            messages.push({ role: message.role, content: message.content });
        }
        if (messages.at(-1)?.role !== 'user') return NextResponse.json({ error: 'The last message must be from the user.' }, { status: 400 });
        // Validate using the configured provider, never a browser-supplied URL or key.
        const catalog = await fetch((config.promptRefinerBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '') + '/models', {
            headers: { Authorization: 'Bearer ' + config.promptRefinerApiKey }, cache: 'no-store', signal: AbortSignal.timeout(15000)
        });
        if (!catalog.ok) return NextResponse.json({ error: 'Unable to verify the text model. Refresh the model list and try again.' }, { status: 503 });
        if (!filterModels((await catalog.json()).data, 'text').includes(model)) return NextResponse.json({ error: 'This text model is not available from the configured API.' }, { status: 400 });
        const client = new OpenAI({ apiKey: config.promptRefinerApiKey, baseURL: config.promptRefinerBaseUrl, maxRetries: 0, timeout: 180000 });
        const result = await client.chat.completions.create({ model, messages, ...effortParams(effort) });
        const message = result.choices[0]?.message?.content?.trim();
        if (!message) return NextResponse.json({ error: 'The text model returned an empty reply.' }, { status: 502 });
        return NextResponse.json({ message, model, effort }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        if (error instanceof OpenAI.APIError) {
            const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 502;
            return NextResponse.json({ error: status === 400 ? 'The provider rejected these parameters. Try the default effort or another text model.' : 'Text API request failed (' + status + '). Please retry or check the provider.', code: 'provider_error' }, { status });
        }
        return NextResponse.json({ error: 'Chat request failed or timed out.' }, { status: 502 });
    }
}
