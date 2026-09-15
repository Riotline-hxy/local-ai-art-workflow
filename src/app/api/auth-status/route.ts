import { accessDenied } from '@/lib/private-access';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const denied = accessDenied(request);
    if (denied) return denied;

    const appPasswordSet = !!process.env.APP_PASSWORD;
    return NextResponse.json({ passwordRequired: appPasswordSet });
}
