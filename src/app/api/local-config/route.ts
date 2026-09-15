import { NextRequest, NextResponse } from 'next/server';
import { getRuntimeConfig, saveRuntimeConfig } from '@/lib/runtime-config';
const headers = { 'Cache-Control': 'no-store' };
function allowed(request: NextRequest) {
    if (process.env.NODE_ENV === 'production') return false;
    const host = request.headers.get('host') || '';
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) return false;
    if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
    if (request.method === 'POST') {
        const origin = request.headers.get('origin');
        if (!origin || ![ 'http://' + host, 'https://' + host ].includes(origin)) return false;
        if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return false;
    }
    return true;
}
export async function GET(request: NextRequest) {
    if (!allowed(request)) return NextResponse.json({ error: 'Local configuration is available on localhost in development mode only.' }, { status: 403, headers });
    try {
        const c = await getRuntimeConfig();
        return NextResponse.json({ openaiBaseUrl: c.openaiBaseUrl, promptRefinerBaseUrl: c.promptRefinerBaseUrl,
            promptRefinerModel: c.promptRefinerModel, promptRefinerEnabled: !!c.promptRefinerEnabled,
            imageKeyConfigured: !!c.openaiApiKey, textKeyConfigured: !!c.promptRefinerApiKey }, { headers });
    } catch { return NextResponse.json({ error: 'Unable to read local configuration.' }, { status: 500, headers }); }
}
export async function POST(request: NextRequest) {
    if (!allowed(request)) return NextResponse.json({ error: 'Local configuration is available on localhost in development mode only.' }, { status: 403, headers });
    try {
        const body = await request.json();
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
        const config = await getRuntimeConfig();
        for (const field of ['openaiBaseUrl', 'promptRefinerBaseUrl'] as const) {
            if (body[field] === undefined) continue;
            if (typeof body[field] !== 'string') throw new Error();
            const url = new URL(body[field].trim());
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
            config[field] = url.href.replace(/\/+$/, '');
        }
        for (const field of ['openaiApiKey', 'promptRefinerApiKey', 'promptRefinerModel'] as const) {
            if (body[field] === undefined) continue;
            if (typeof body[field] !== 'string' || body[field].length > 4096) throw new Error();
            if (body[field].trim() || field === 'promptRefinerModel') config[field] = body[field].trim();
        }
        if (body.promptRefinerEnabled !== undefined) {
            if (typeof body.promptRefinerEnabled !== 'boolean') throw new Error();
            config.promptRefinerEnabled = body.promptRefinerEnabled;
        }
        await saveRuntimeConfig(config);
        return NextResponse.json({ ok: true }, { headers });
    } catch { return NextResponse.json({ error: 'Invalid configuration or unable to save. Check the URLs and local file permissions.' }, { status: 400, headers }); }
}
