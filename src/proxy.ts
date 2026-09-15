import { NextRequest, NextResponse } from 'next/server';
import { accessCookie, accessDenied, sameSecret, sessionValue } from './lib/private-access';

export function proxy(request: NextRequest) {
    const secret = process.env.PHOTO_ACCESS_TOKEN;
    const invite = request.nextUrl.searchParams.get('invite');
    let response: NextResponse;
    if (request.method === 'GET' && secret && invite && sameSecret(invite, secret)) {
        const destination = new URL((process.env.NEXT_PUBLIC_BASE_PATH || '') + '/', process.env.PHOTO_PUBLIC_ORIGIN || request.url);
        response = NextResponse.redirect(destination, 303);
        response.cookies.set(accessCookie, sessionValue(secret), {
            httpOnly: true, secure: destination.protocol === 'https:', sameSite: 'lax',
            path: process.env.NEXT_PUBLIC_BASE_PATH || '/', maxAge: 60 * 60 * 24 * 180
        });
    } else {
        response = accessDenied(request) || NextResponse.next();
    }
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    response.headers.set('X-Frame-Options', 'DENY');
    return response;
}
