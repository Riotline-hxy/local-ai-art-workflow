export const IMAGE_PROTOCOLS = ['auto', 'gpt', 'images', 'seedream', 'gemini', 'chat'] as const;
export type ImageProtocol = typeof IMAGE_PROTOCOLS[number];
export function isImageProtocol(value: unknown): value is ImageProtocol {
    return typeof value === 'string' && (IMAGE_PROTOCOLS as readonly string[]).includes(value);
}
export function resolveImageProtocol(model: string, requested: ImageProtocol = 'auto'): Exclude<ImageProtocol, 'auto'> {
    if (requested !== 'auto') return requested;
    if (/gpt-image/i.test(model)) return 'gpt';
    if (/seedream/i.test(model)) return 'seedream';
    if (/gemini.*image|nano.banana/i.test(model)) return 'gemini';
    return 'images';
}
