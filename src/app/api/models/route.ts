import { NextRequest, NextResponse } from 'next/server';
import { getRuntimeConfig } from '@/lib/runtime-config';
import { accessDenied } from '@/lib/private-access';
import { filterModels } from '@/lib/model-catalog';
export const dynamic = 'force-dynamic';
async function list(kind: 'image' | 'text', base?: string, key?: string) {
    if (!key) return { models: [], error: 'API key is not configured' };
    try {
        const response = await fetch((base || 'https://api.openai.com/v1').replace(/\/+$/, '') + '/models', {
            headers: { Authorization: 'Bearer ' + key }, cache: 'no-store', signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) return { models: [], error: 'Model list request failed: ' + response.status };
        const body = await response.json();
        return { models: filterModels(body.data, kind), error: '' };
    } catch { return { models: [], error: 'Model list unavailable or timed out' }; }
}
export async function GET(request: NextRequest) {
    const denied = accessDenied(request); if (denied) return denied;
    try {
        const c = await getRuntimeConfig();
        const [image, text] = await Promise.all([list('image', c.openaiBaseUrl, c.openaiApiKey), list('text', c.promptRefinerBaseUrl, c.promptRefinerApiKey)]);
        return NextResponse.json({ imageModels: image.models, textModels: text.models, errors: { image: image.error, text: text.error }, refinerEnabled: !!c.promptRefinerEnabled, textModel: c.promptRefinerModel || '', textEffort: c.promptRefinerEffort || 'default' }, { headers: { 'Cache-Control': 'no-store' } });
    } catch { return NextResponse.json({ error: 'Unable to read local configuration' }, { status: 500 }); }
}
