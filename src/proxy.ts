import { NextRequest, NextResponse } from 'next/server';
import { accessCookie, accessDenied, sameSecret, sessionValue } from './lib/private-access';

export function proxy(request: NextRequest) {
    const secret = process.env.PHOTO_ACCESS_TOKEN;
    const invite = request.nextUrl.searchParams.get('invite');
    let response: NextResponse;
    if (request.method === 'GET' && secret && invite && sameSecret(invite, secret)) {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
        const requestPath = request.nextUrl.pathname || '/';
        const destinationPath = requestPath === basePath || requestPath.startsWith(basePath + '/') ? requestPath : basePath + (requestPath.startsWith('/') ? requestPath : '/' + requestPath);
        const destination = new URL(destinationPath === basePath + '/' && basePath ? basePath : destinationPath || '/', process.env.PHOTO_PUBLIC_ORIGIN || request.url);
        response = NextResponse.redirect(destination, 303);
        response.cookies.set(accessCookie, sessionValue(secret), {
            httpOnly: true, secure: destination.protocol === 'https:', sameSite: 'lax',
            path: process.env.NEXT_PUBLIC_BASE_PATH || '/', maxAge: 60 * 60 * 24 * 180
        });
    } else {
        const denied = accessDenied(request);
        const isDocument = ['GET', 'HEAD'].includes(request.method) && (request.headers.get('accept') || '').includes('text/html') && !(request.nextUrl.pathname || '').includes('/api/');
        if (denied && isDocument) {
            response = new NextResponse(
                '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>请使用完整邀请链接</title><style>body{margin:0;background:#0b1020;color:#eef2ff;font-family:system-ui,sans-serif;display:grid;min-height:100dvh;place-items:center}main{max-width:480px;margin:24px;padding:28px;background:#151c30;border:1px solid #303c55;border-radius:20px}h1{font-size:23px}p{line-height:1.8;color:#cbd5e1}small{color:#94a3b8}</style></head><body><main><h1>请使用完整邀请链接</h1><p>此浏览器尚未获得访问权限，或访问凭据已过期。</p><p>请重新打开家人发给你的完整链接，保留问号后面的 invite=… 部分。不要只打开 /photo 地址。</p><p>如果从微信切换到手机浏览器，请在新浏览器中再次打开完整邀请链接；两个浏览器不会共享访问权限。</p><small>无需填写 API 密钥或密码。若完整链接仍无法打开，请让网站管理员检查邀请权限。</small></main></body></html>',
                { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
        } else {
            response = denied || NextResponse.next();
        }
    }
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    response.headers.set('X-Frame-Options', 'DENY');
    return response;
}
