import { isTextEffort } from '@/lib/text-options';
import { NextRequest, NextResponse } from 'next/server';
import { getRuntimeConfig, saveRuntimeConfig } from '@/lib/runtime-config';
const headers = { 'Cache-Control': 'no-store' };
function allowed(request: NextRequest) {
    const host = request.headers.get('host') || '';
    const origin = request.headers.get('origin');
    if (process.env.PHOTO_ALLOW_REMOTE_CONFIG === '1') {
        let publicUrl: URL;
        try { publicUrl = new URL(process.env.PHOTO_PUBLIC_ORIGIN || ''); }
        catch { return false; }
        if (!['http:', 'https:'].includes(publicUrl.protocol) || publicUrl.username || publicUrl.password ||
            publicUrl.pathname !== '/' || publicUrl.search || publicUrl.hash) return false;
        // Reverse proxies preserve the browser-facing Host even when the internal request URL uses localhost.
        if (host.toLowerCase() !== publicUrl.host || (origin !== null && origin !== publicUrl.origin)) return false;
        const fetchSite = request.headers.get('sec-fetch-site');
        if (fetchSite && !['same-origin', 'none'].includes(fetchSite)) return false;
        if (request.method === 'POST' && origin !== publicUrl.origin) return false;
    } else {
        if (process.env.NODE_ENV === 'production') return false;
        if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) return false;
        if (request.method === 'POST' && (!origin || !['http://' + host, 'https://' + host].includes(origin))) return false;
    }
    if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
    if (request.method === 'POST') {
        if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return false;
    }
    return true;
}
export async function GET(request: NextRequest) {
    if (!allowed(request)) return NextResponse.json({ error: 'Configuration is unavailable for this request origin or deployment.' }, { status: 403, headers });
    try {
        const c = await getRuntimeConfig();
        return NextResponse.json({ openaiBaseUrl: c.openaiBaseUrl, promptRefinerBaseUrl: c.promptRefinerBaseUrl,
            promptRefinerModel: c.promptRefinerModel, promptRefinerEnabled: !!c.promptRefinerEnabled, promptRefinerEffort: c.promptRefinerEffort || 'default', canEditCredentials: true, canEditPreferences: true,
            imageKeyConfigured: !!c.openaiApiKey, textKeyConfigured: !!c.promptRefinerApiKey }, { headers });
    } catch { return NextResponse.json({ error: 'Unable to read local configuration.' }, { status: 500, headers }); }
}
export async function POST(request: NextRequest) {
    if (!allowed(request)) return NextResponse.json({ error: 'Configuration is unavailable for this request origin or deployment.' }, { status: 403, headers });
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
        if (body.promptRefinerEffort !== undefined) {
            if (!isTextEffort(body.promptRefinerEffort)) throw new Error();
            config.promptRefinerEffort = body.promptRefinerEffort;
        }
        await saveRuntimeConfig(config);
        return NextResponse.json({ ok: true }, { headers });
    } catch { return NextResponse.json({ error: 'Invalid configuration or unable to save. Check the URLs and local file permissions.' }, { status: 400, headers }); }
}
