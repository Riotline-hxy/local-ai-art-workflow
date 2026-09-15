export const EFFORT_OPTIONS = ['default', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const;
export type TextEffort = (typeof EFFORT_OPTIONS)[number];
export function isTextEffort(value: unknown): value is TextEffort {
    return typeof value === 'string' && (EFFORT_OPTIONS as readonly string[]).includes(value);
}
export function effortParams(effort: TextEffort) {
    return effort === 'default' ? {} : { reasoning_effort: effort };
}
