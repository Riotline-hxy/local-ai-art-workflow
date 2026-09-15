"use client";
import * as React from 'react';
export type TimeSpan = { start: number; end?: number };
export type WorkflowTiming = { total: TimeSpan; refinement?: TimeSpan; image?: TimeSpan };
export function formatElapsed(ms: number) { return (Math.max(0, ms) / 1000).toFixed(1) + ' s'; }
export function ElapsedTime({ span }: { span: TimeSpan }) {
    const [now, setNow] = React.useState(span.start);
    React.useEffect(() => {
        if (span.end !== undefined) return;
        const id = setInterval(() => setNow(performance.now()), 100);
        return () => clearInterval(id);
    }, [span.start, span.end]);
    return <span className='tabular-nums'>{formatElapsed((span.end ?? now) - span.start)}</span>;
}
export function finishTiming(timing: WorkflowTiming, end: number): WorkflowTiming {
    const finish = (span: TimeSpan): TimeSpan => ({ ...span, end: span.end ?? end });
    return { total: finish(timing.total), refinement: timing.refinement && finish(timing.refinement), image: timing.image && finish(timing.image) };
}
