import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import https from 'node:https';
import type { ImageSource } from './image-adapter';

const MAX_BYTES = 30 * 1024 * 1024;
const blocked = new BlockList();
for (const [ip, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.168.0.0',16],['192.0.0.0',24],['198.18.0.0',15],['224.0.0.0',4],['240.0.0.0',4]] as const) blocked.addSubnet(ip,prefix,'ipv4');
for (const [ip,prefix] of [['::',128],['::1',128],['fc00::',7],['fe80::',10],['ff00::',8],['::ffff:0:0',96]] as const) blocked.addSubnet(ip,prefix,'ipv6');
export function isPublicImageAddress(ip: string) {
    const version = isIP(ip);
    if (!version) return false;
    return !blocked.check(ip, version === 4 ? 'ipv4' : 'ipv6');
}

async function downloadImage(url: string, redirects = 0): Promise<Buffer> {
    const target = new URL(url);
    if (target.protocol !== 'https:' || target.username || target.password || (target.port && target.port !== '443')) throw new Error('图片 URL 必须使用公共 HTTPS 地址。 / Image URL must use public HTTPS.');
    const hostname = target.hostname.replace(/^\[|\]$/g,'');
    const addresses = await lookup(hostname, { all: true });
    if (!addresses.length || addresses.some(a => !isPublicImageAddress(a.address))) throw new Error('拒绝从私有网络下载图片。 / Private network image URL rejected.');
    // Pin the validated address, including every redirect, to prevent DNS rebinding.
    return new Promise((resolve,reject) => {
        const timer = setTimeout(() => req.destroy(new Error('图片下载超时。 / Image download timed out.')), 60_000);
        const req = https.get(target, { lookup: (_host, options, cb) => {
            if (options.all) (cb as unknown as (error: null, result: typeof addresses) => void)(null, [addresses[0]]);
            else cb(null, addresses[0].address, addresses[0].family);
        } }, response => {
            const status = response.statusCode || 0;
            if (status >= 300 && status < 400 && response.headers.location) {
                response.resume(); clearTimeout(timer);
                if (redirects >= 4) return reject(new Error('Too many image redirects'));
                downloadImage(new URL(response.headers.location, target).href, redirects + 1).then(resolve,reject); return;
            }
            if (status !== 200) { response.resume(); clearTimeout(timer); reject(new Error(`图片 URL 下载失败（HTTP ${status}）。 / Image download failed.`)); return; }
            let bytes = 0; const chunks: Buffer[] = [];
            response.on('data', (chunk: Buffer) => {
                bytes += chunk.length;
                if (bytes > MAX_BYTES) { req.destroy(new Error('Image exceeds 30 MiB')); return; }
                chunks.push(chunk);
            });
            response.on('error',reject);
            response.on('end',() => { clearTimeout(timer); resolve(Buffer.concat(chunks)); });
        });
        req.on('error',() => { clearTimeout(timer); reject(new Error('图片 URL 下载失败，请检查中转站返回的图片地址。 / Image URL download failed.')); });
    });
}

export function decodeImage(buffer: Buffer) {
    if (buffer.length > MAX_BYTES) throw new Error('Image exceeds 30 MiB');
    const format = buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png'
        : buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255 ? 'jpeg'
        : buffer.toString('ascii',0,4) === 'RIFF' && buffer.toString('ascii',8,12) === 'WEBP' ? 'webp' : null;
    if (!format) throw new Error('接口返回的内容不是支持的 PNG/JPEG/WebP 图片。 / Invalid image bytes.');
    return { buffer, format, b64_json: buffer.toString('base64') };
}
export async function resolveImage(source: ImageSource) {
    const value = source.b64_json || source.url;
    if (!value) throw new Error('图片响应没有图片数据或 URL。 / No image data or URL.');
    if (value.startsWith('data:')) {
        const match = /^data:image\/[\w.+-]+;base64,([\s\S]+)$/.exec(value);
        if (!match) throw new Error('Invalid image data URL');
        if (match[1].length > MAX_BYTES * 1.4) throw new Error('Image exceeds 30 MiB');
        return decodeImage(Buffer.from(match[1], 'base64'));
    }
    if (source.b64_json) {
        if (value.length > MAX_BYTES * 1.4) throw new Error('Image exceeds 30 MiB');
        return decodeImage(Buffer.from(value,'base64'));
    }
    return decodeImage(await downloadImage(value));
}
