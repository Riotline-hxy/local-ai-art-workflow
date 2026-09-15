'use client';
import { Check, Circle, Loader2, Copy, AlertCircle } from 'lucide-react';
import * as React from 'react';
import { useI18n } from '@/lib/i18n';
type State = { original: string; refined: string; status: 'idle' | 'refining' | 'preview' | 'sending' | 'completed' | 'error' };
export function WorkflowPanel({ state, refinerEnabled, imageModel, textModel }: { state: State; refinerEnabled: boolean; imageModel: string; textModel: string }) {
    const { t } = useI18n();
    const [copied, setCopied] = React.useState(false);
    const [copyError, setCopyError] = React.useState(false);
    if (state.status === 'idle') return null;
    const active = state.status === 'refining' ? 0 : state.status === 'preview' ? 1 : state.status === 'sending' ? 2 : 3;
    const steps = [t('提示词整理', 'Refine prompt'), t('最终提示词预览', 'Final prompt preview'), t('对接图片模型', 'Generate image'), t('图片生成完成', 'Image complete')];
    return <section aria-label={t('工作链', 'Workflow')} className='rounded-2xl border border-white/10 bg-white/[0.035] p-4 md:p-5'>
        <ol className='grid grid-cols-2 gap-3 md:grid-cols-4' aria-live='polite'>
            {steps.map((label, index) => <li key={index} aria-current={active === index ? 'step' : undefined} className={'flex items-center gap-2 rounded-xl px-3 py-2 text-xs ' + (active === index ? 'bg-sky-400/10 text-sky-200' : index < active ? 'text-white/75' : 'text-white/30')}>
                {state.status === 'error' && index === active ? <AlertCircle size={15} className='text-red-300' /> : (index < active || state.status === 'completed') ? <Check size={15} /> : index === active ? <Loader2 size={15} className='animate-spin' /> : <Circle size={15} />}
                {index === 0 && !refinerEnabled ? t('使用原始提示词', 'Use original prompt') : label}
            </li>)}
        </ol>
        <p className='mt-3 text-xs text-white/45' role='status'>{state.status === 'refining' ? t('正在等待文本模型整理提示词…', 'Waiting for the text model to refine your prompt…') : state.status === 'sending' ? t('已提交图片模型，生成结果返回后会自动显示。', 'Submitted to the image model. Results will appear automatically.') : state.status === 'error' ? t('任务未完成，请查看错误信息；已整理的提示词会保留。', 'The task did not complete. See the error below; the prepared prompt is kept.') : t('本次任务已完成。', 'This task is complete.')}</p>
        {state.refined && <div className='mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/25'>
            <div className='flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3'>
                <div><h2 className='text-sm font-medium'>{t('最终提示词 · 实际发送内容', 'Final prompt · sent to the image model')}</h2><p className='mt-1 break-all text-xs text-white/40'>{refinerEnabled && textModel ? textModel + ' → ' : ''}{imageModel}</p></div>
                <button type='button' className='flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-white/60 hover:bg-white/10' onClick={async () => { try { await navigator.clipboard.writeText(state.refined); setCopied(true); setCopyError(false); } catch { setCopyError(true); } }}><Copy size={13} />{copied ? t('已复制', 'Copied') : t('复制', 'Copy')}</button>
            </div>
            <pre className='max-h-64 overflow-y-auto whitespace-pre-wrap break-words p-4 font-sans text-sm leading-7 text-white/80'>{state.refined}</pre>
            {copyError && <p role='alert' className='px-4 pb-3 text-xs text-amber-300'>{t('复制失败，请手动选中提示词复制。', 'Copy failed. Select the prompt and copy it manually.')}</p>}
        </div>}
    </section>;
}
