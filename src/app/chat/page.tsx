'use client';

import { useLanguage } from '@/lib/i18n';
import { EFFORT_OPTIONS, isTextEffort, type TextEffort } from '@/lib/text-options';
import {
    ArrowLeft,
    Bot,
    Eraser,
    Languages,
    Loader2,
    RefreshCw,
    Send,
    SlidersHorizontal,
    Sparkles,
    User
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

const API_BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';
const PREFERENCES_KEY = `photo-chat-preferences:${API_BASE || '/'}`;
type Message = {
    role: 'user' | 'assistant';
    content: string;
    model?: string;
    effort?: TextEffort;
};
type Preferences = { model: string; effort: TextEffort };
type ModelResponse = { textModels?: unknown[]; textModel?: string; errors?: { text?: string }; error?: string };

function readPreferences(): Preferences {
    try {
        const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}');
        return {
            model: typeof saved.model === 'string' ? saved.model : '',
            effort: isTextEffort(saved.effort) ? saved.effort : 'default'
        };
    } catch {
        return { model: '', effort: 'default' };
    }
}

function savePreferences(patch: Partial<Preferences>) {
    try {
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ ...readPreferences(), ...patch }));
    } catch {
        // Keep the active selection usable when browser storage is disabled.
    }
}

export default function Chat() {
    const { language, setLanguage, t } = useLanguage();
    const [messages, setMessages] = React.useState<Message[]>([]);
    const [input, setInput] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState('');
    const [models, setModels] = React.useState<string[]>([]);
    const [model, setModel] = React.useState('');
    const [effort, setEffort] = React.useState<TextEffort>('default');
    const [loadingModels, setLoadingModels] = React.useState(true);
    const [modelError, setModelError] = React.useState('');
    const end = React.useRef<HTMLDivElement>(null);
    const modelRequest = React.useRef<AbortController | null>(null);
    const preferencesLoaded = React.useRef(false);
    const requestInFlight = React.useRef(false);
    const canSend = !busy && !loadingModels && models.includes(model) && !!input.trim();

    const effortLabel = (value: TextEffort) => {
        const labels: Record<TextEffort, [string, string]> = {
            default: ['服务商默认', 'Provider default'],
            none: ['不推理 · none', 'No reasoning · none'],
            minimal: ['极低 · minimal', 'Minimal'],
            low: ['低 · low', 'Low'],
            medium: ['中 · medium', 'Medium'],
            high: ['高 · high', 'High'],
            xhigh: ['极高 · xhigh', 'Extra high · xhigh']
        };
        return t(...labels[value]);
    };

    const fetchModels = React.useCallback(() => {
        modelRequest.current?.abort();
        const controller = new AbortController();
        modelRequest.current = controller;
        return fetch(`${API_BASE}/api/models`, { cache: 'no-store', signal: controller.signal })
            .then(async (response) => {
                const data: ModelResponse = await response.json();
                if (!response.ok) throw new Error(data.error || 'Model list unavailable or timed out');
                return data;
            })
            .then((data) => {
                if (controller.signal.aborted) return;
                const available = [
                    ...new Set(
                        (data.textModels || []).filter((id): id is string => typeof id === 'string' && !!id.trim())
                    )
                ];
                const saved = readPreferences();
                setModels(available);
                setModel((current) => {
                    const preferred = current || saved.model;
                    return available.includes(preferred)
                        ? preferred
                        : data.textModel && available.includes(data.textModel)
                          ? data.textModel
                          : available[0] || '';
                });
                if (!preferencesLoaded.current) {
                    setEffort(saved.effort);
                    preferencesLoaded.current = true;
                }
                setModelError(data.errors?.text || '');
            })
            .catch((cause) => {
                if (controller.signal.aborted) return;
                setModels([]);
                setModel('');
                setModelError(cause instanceof Error ? cause.message : 'Model list unavailable or timed out');
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoadingModels(false);
            });
    }, []);

    React.useEffect(() => {
        void fetchModels();
        return () => modelRequest.current?.abort();
    }, [fetchModels]);

    React.useEffect(() => {
        end.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, busy]);

    function refreshModels() {
        setLoadingModels(true);
        setModelError('');
        void fetchModels();
    }

    async function send() {
        const content = input.trim();
        if (!canSend || requestInFlight.current) return;
        requestInFlight.current = true;
        const requestModel = model;
        const requestEffort = effort;
        const nextMessages: Message[] = [...messages, { role: 'user', content }];
        setMessages(nextMessages);
        setInput('');
        setError('');
        setBusy(true);
        savePreferences({ model: requestModel, effort: requestEffort });
        try {
            const response = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: nextMessages.map(({ role, content: text }) => ({ role, content: text })),
                    model: requestModel,
                    effort: requestEffort
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || t('请求失败。', 'Request failed.'));
            if (typeof data.message !== 'string' || !data.message.trim()) {
                throw new Error(t('文本模型返回了空回复。', 'The text model returned an empty reply.'));
            }
            setMessages((current) => [
                ...current,
                { role: 'assistant', content: data.message, model: requestModel, effort: requestEffort }
            ]);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : t('请求失败。', 'Request failed.'));
        } finally {
            requestInFlight.current = false;
            setBusy(false);
        }
    }

    return (
        <main className='min-h-screen bg-[#07090d] text-slate-100'>
            <div className='mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-5 sm:px-6'>
                <header className='flex items-center justify-between gap-3 border-b border-white/10 pb-5'>
                    <div className='flex min-w-0 items-center gap-3'>
                        <Link
                            href='/'
                            className='rounded-xl p-2 text-slate-400 hover:bg-white/10'
                            aria-label={t('返回图片工作台', 'Back to image studio')}>
                            <ArrowLeft size={18} />
                        </Link>
                        <div className='rounded-xl bg-violet-400/10 p-2.5 text-violet-300'>
                            <Bot size={20} />
                        </div>
                        <div className='min-w-0'>
                            <h1 className='font-semibold'>{t('文本聊天', 'Text chat')}</h1>
                            <p className='text-xs text-slate-500'>
                                {t('直接和文本模型交流', 'Talk directly with your text model')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
                        className='flex shrink-0 items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs hover:bg-white/5'>
                        <Languages size={15} />
                        {language === 'zh' ? 'English' : '中文'}
                    </button>
                </header>

                <section
                    aria-label={t('对话设置', 'Chat settings')}
                    className='mt-5 rounded-2xl border border-white/10 bg-white/[.03] p-4'>
                    <div className='mb-3 flex items-center justify-between gap-3'>
                        <div className='flex items-center gap-2 text-sm font-medium text-slate-200'>
                            <SlidersHorizontal size={15} className='text-violet-300' />
                            {t('对话设置', 'Chat settings')}
                        </div>
                        <button
                            type='button'
                            onClick={refreshModels}
                            disabled={loadingModels || busy}
                            className='flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200 disabled:opacity-40'>
                            <RefreshCw size={13} className={loadingModels ? 'animate-spin' : ''} />
                            {t('刷新模型', 'Refresh models')}
                        </button>
                    </div>
                    <div className='grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)]'>
                        <label className='min-w-0 space-y-2'>
                            <span className='block text-xs text-slate-400'>{t('文本模型', 'Text model')}</span>
                            <select
                                value={model}
                                onChange={(event) => {
                                    setModel(event.target.value);
                                    savePreferences({ model: event.target.value });
                                }}
                                disabled={busy || loadingModels || !models.length}
                                className='h-11 w-full min-w-0 rounded-xl border border-white/10 bg-[#0f1219] px-3 text-sm text-slate-100 [color-scheme:dark] outline-none focus:border-violet-300/60 disabled:opacity-50'>
                                {!models.length && (
                                    <option value=''>
                                        {loadingModels
                                            ? t('正在获取文本模型…', 'Loading text models…')
                                            : t('未获取到文本模型', 'No text models available')}
                                    </option>
                                )}
                                {models.map((id) => (
                                    <option key={id} value={id}>
                                        {id}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className='min-w-0 space-y-2'>
                            <span className='block text-xs text-slate-400'>
                                {t('推理强度（Effort）', 'Reasoning effort')}
                            </span>
                            <select
                                value={effort}
                                onChange={(event) => {
                                    const next = event.target.value;
                                    if (isTextEffort(next)) {
                                        setEffort(next);
                                        savePreferences({ effort: next });
                                    }
                                }}
                                disabled={busy || loadingModels}
                                aria-describedby='effort-help'
                                className='h-11 w-full min-w-0 rounded-xl border border-white/10 bg-[#0f1219] px-3 text-sm text-slate-100 [color-scheme:dark] outline-none focus:border-violet-300/60 disabled:opacity-50'>
                                {EFFORT_OPTIONS.map((value) => (
                                    <option key={value} value={value}>
                                        {effortLabel(value)}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <p id='effort-help' className='mt-3 text-xs leading-5 text-slate-500'>
                        {t(
                            '“服务商默认”不指定推理强度。各模型支持的档位不同；如果提示不支持，请切回默认。切换模型会保留当前对话。',
                            'Provider default leaves reasoning effort unspecified. Supported levels vary by model; choose the default if a level is rejected. Switching models keeps this conversation.'
                        )}
                    </p>
                    {modelError && (
                        <p role='alert' className='mt-3 text-xs leading-5 text-amber-200'>
                            {t(modelError)}
                        </p>
                    )}
                    {!loadingModels && !models.length && (
                        <p className='mt-2 text-xs leading-5 text-slate-400'>
                            {t(
                                '请检查文本 API 配置后刷新模型；共享网站请联系管理员。',
                                'Check the text API configuration and refresh models. On a shared site, contact the administrator.'
                            )}
                        </p>
                    )}
                </section>

                <section className='flex flex-1 flex-col py-6'>
                    <div className='flex-1 space-y-5 overflow-y-auto'>
                        {messages.length === 0 && (
                            <div className='flex min-h-[32vh] flex-col items-center justify-center text-center'>
                                <Sparkles className='mb-4 text-violet-300' />
                                <h2 className='text-xl'>{t('想聊点什么？', 'What would you like to discuss?')}</h2>
                                <p className='mt-2 text-sm text-slate-500'>
                                    {t('选择文本模型，开始一段对话。', 'Choose a text model and start a conversation.')}
                                </p>
                            </div>
                        )}
                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div
                                    className={`flex max-w-[92%] min-w-0 gap-3 rounded-2xl px-4 py-3 text-sm leading-7 sm:max-w-[88%] ${message.role === 'user' ? 'bg-violet-400/15' : 'bg-white/[.06]'}`}>
                                    {message.role === 'assistant' ? (
                                        <Bot size={16} className='mt-1 shrink-0 text-violet-300' />
                                    ) : (
                                        <User size={16} className='mt-1 shrink-0 text-violet-200' />
                                    )}
                                    <div className='min-w-0'>
                                        {message.model && (
                                            <p className='mb-1 text-[11px] leading-5 break-all text-slate-500'>
                                                {message.model} · {effortLabel(message.effort || 'default')}
                                            </p>
                                        )}
                                        <div className='[overflow-wrap:anywhere] whitespace-pre-wrap'>
                                            {message.content}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {busy && (
                            <div role='status' className='flex items-center gap-2 text-sm text-slate-400'>
                                <Loader2 size={16} className='shrink-0 animate-spin' />
                                <span className='break-all'>
                                    {t('文本模型正在回复…', 'The text model is replying…')} {model}
                                </span>
                            </div>
                        )}
                        <div ref={end} />
                    </div>
                    {error && (
                        <p role='alert' className='mt-3 rounded-xl border border-red-400/20 p-3 text-sm text-red-200'>
                            {t(error)}
                        </p>
                    )}
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            void send();
                        }}
                        className='mt-6 flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[.04] p-2'>
                        <textarea
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (
                                    event.key === 'Enter' &&
                                    !event.shiftKey &&
                                    !event.nativeEvent.isComposing &&
                                    event.nativeEvent.keyCode !== 229
                                ) {
                                    event.preventDefault();
                                    void send();
                                }
                            }}
                            rows={2}
                            aria-label={t('输入消息', 'Message')}
                            placeholder={t(
                                '输入消息，按 Enter 发送，Shift+Enter 换行',
                                'Type a message. Enter sends, Shift+Enter adds a line'
                            )}
                            className='min-w-0 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-600'
                        />
                        <button
                            type='button'
                            onClick={() => {
                                setMessages([]);
                                setError('');
                            }}
                            disabled={busy || !messages.length}
                            className='rounded-xl p-3 text-slate-500 hover:bg-white/5 disabled:opacity-30'
                            aria-label={t('清空对话', 'Clear chat')}>
                            <Eraser size={17} />
                        </button>
                        <button
                            type='submit'
                            disabled={!canSend}
                            className='rounded-xl bg-violet-300 p-3 text-slate-950 hover:bg-violet-200 disabled:opacity-30'
                            aria-label={t('发送消息', 'Send message')}>
                            <Send size={17} />
                        </button>
                    </form>
                </section>
            </div>
        </main>
    );
}
