import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export const accessCookie = 'pf_photo_access';
export function sameSecret(a: string, b: string) {
    const left = Buffer.from(a), right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
}
export function sessionValue(secret: string) {
    return createHmac('sha256', secret).update('photo-session-v1').digest('hex');
}
export function accessDenied(request: NextRequest): NextResponse | null {
    const secret = process.env.PHOTO_ACCESS_TOKEN;
    if (!secret && process.env.PHOTO_REQUIRE_ACCESS !== '1') return null;
    if (!secret || !sameSecret(request.cookies.get(accessCookie)?.value || '', sessionValue(secret))) {
        return NextResponse.json({ error: '请使用专属邀请链接打开图片工作台。' }, { status: 403 });
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
        const origin = request.headers.get('origin');
        if (origin && origin !== process.env.PHOTO_PUBLIC_ORIGIN) {
            return NextResponse.json({ error: '请求来源不受信任。' }, { status: 403 });
        }
    }
    return null;
}
