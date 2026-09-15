'use client';

import * as React from 'react';
import {
    Check, ChevronRight, CircleAlert, ImageIcon, Languages, Loader2, LockKeyhole,
    MessageSquareText, RefreshCw, Save, Settings2, ShieldCheck, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { useLanguage } from '@/lib/i18n';

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: () => Promise<void>;
    imageModels: string[];
    textModels: string[];
    modelsLoading: boolean;
    modelErrors: { image: string | null; text: string | null };
    onRefresh: () => Promise<void>;
    busy?: boolean;
}

interface ConfigForm {
    openaiBaseUrl: string;
    openaiApiKey: string;
    promptRefinerBaseUrl: string;
    promptRefinerApiKey: string;
    promptRefinerModel: string;
    promptRefinerEnabled: boolean;
}

type SettingsResponse = Partial<Omit<ConfigForm, 'openaiApiKey' | 'promptRefinerApiKey'>> & {
    imageKeyConfigured?: boolean;
    textKeyConfigured?: boolean;
    error?: string;
};

const emptyForm: ConfigForm = {
    openaiBaseUrl: '', openaiApiKey: '', promptRefinerBaseUrl: '',
    promptRefinerApiKey: '', promptRefinerModel: '', promptRefinerEnabled: false
};
const fieldClass = 'h-11 rounded-xl border-white/10 bg-slate-950/70 text-slate-100 shadow-none placeholder:text-slate-600 focus-visible:border-cyan-400/60 focus-visible:ring-cyan-400/15';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function SettingsDialog({
    open, onOpenChange, onSaved, imageModels, textModels, modelsLoading, modelErrors,
    onRefresh, busy = false
}: SettingsDialogProps) {
    const { language, setLanguage, t } = useLanguage();
    const copy = (zh: string, en: string) => language === 'zh' ? zh : en;
    const [activeTab, setActiveTab] = React.useState<'image' | 'text'>('image');
    const [form, setForm] = React.useState<ConfigForm>(emptyForm);
    const [keyStatus, setKeyStatus] = React.useState({ image: false, text: false });
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [unavailable, setUnavailable] = React.useState(false);
    const [message, setMessage] = React.useState<'saved' | 'load-error' | 'save-error' | null>(null);
    const [serverError, setServerError] = React.useState<string | null>(null);
    const [modelSearch, setModelSearch] = React.useState('');
    const imageList = Array.from(new Set(imageModels)).filter(Boolean);
    const textList = Array.from(new Set(textModels)).filter(Boolean);
    const currentModels = activeTab === 'image' ? imageList : textList;
    const visibleModels = currentModels.filter(model => model.toLowerCase().includes(modelSearch.toLowerCase()));
    const currentError = modelErrors[activeTab];
    const textModelSupported = textList.includes(form.promptRefinerModel);
    const controlsDisabled = loading || saving || unavailable || busy;

    React.useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        const readSettings = async () => {
            setLoading(true);
            setUnavailable(false);
            setMessage(null);
            setServerError(null);
            try {
                const response = await fetch(basePath + '/api/local-config', {
                    cache: 'no-store', signal: controller.signal
                });
                const data = await response.json() as SettingsResponse;
                if (!response.ok) {
                    if (response.status === 403) setUnavailable(true);
                    throw new Error(data.error || 'Unable to load settings');
                }
                setForm({
                    openaiBaseUrl: data.openaiBaseUrl || '',
                    openaiApiKey: '',
                    promptRefinerBaseUrl: data.promptRefinerBaseUrl || '',
                    promptRefinerApiKey: '',
                    promptRefinerModel: data.promptRefinerModel || '',
                    promptRefinerEnabled: Boolean(data.promptRefinerEnabled)
                });
                setKeyStatus({
                    image: Boolean(data.imageKeyConfigured), text: Boolean(data.textKeyConfigured)
                });
            } catch (error) {
                if (!controller.signal.aborted) {
                    setMessage('load-error');
                    setServerError(error instanceof Error ? error.message : String(error));
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        void readSettings();
        return () => controller.abort();
    }, [open]);

    const updateField = <K extends keyof ConfigForm>(field: K, value: ConfigForm[K]) => {
        setForm(current => ({ ...current, [field]: value }));
        setMessage(null);
        setServerError(null);
    };

    const saveSettings = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (controlsDisabled) return;
        setSaving(true);
        setMessage(null);
        setServerError(null);
        try {
            const response = await fetch(basePath + '/api/local-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            const data = await response.json() as SettingsResponse;
            if (!response.ok) throw new Error(data.error || 'Unable to save settings');
            setKeyStatus(current => ({
                image: data.imageKeyConfigured ?? (Boolean(form.openaiApiKey.trim()) || current.image),
                text: data.textKeyConfigured ?? (Boolean(form.promptRefinerApiKey.trim()) || current.text)
            }));
            setForm(current => ({ ...current, openaiApiKey: '', promptRefinerApiKey: '' }));
            setMessage('saved');
            await onSaved();
        } catch (error) {
            setMessage('save-error');
            setServerError(error instanceof Error ? error.message : String(error));
        } finally {
            setSaving(false);
        }
    };

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) {
            setForm(current => ({ ...current, openaiApiKey: '', promptRefinerApiKey: '' }));
        }
        onOpenChange(nextOpen);
    };

    const providerIsImage = activeTab === 'image';
    const keyConfigured = providerIsImage ? keyStatus.image : keyStatus.text;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className='flex max-h-[min(90dvh,900px)] flex-col gap-0 overflow-hidden rounded-3xl border-white/10 bg-[#0c111b] p-0 text-slate-100 shadow-2xl shadow-black/70 duration-300 sm:max-w-[760px] motion-reduce:animate-none'>
                <DialogHeader className='shrink-0 border-b border-white/7 bg-gradient-to-br from-cyan-400/7 via-transparent to-transparent px-5 py-5 text-left sm:px-7 sm:py-6'>
                    <div className='mb-2 flex items-center gap-2.5 text-xs font-medium text-cyan-300'>
                        <span className='flex size-7 items-center justify-center rounded-lg bg-cyan-400/10 ring-1 ring-cyan-300/15'><Settings2 className='size-4' /></span>
                        {copy('创作空间设置', 'WORKSPACE SETTINGS')}
                    </div>
                    <DialogTitle className='text-xl font-semibold tracking-tight sm:text-2xl'>
                        {copy('连接你的模型', 'Connect your models')}
                    </DialogTitle>
                    <DialogDescription className='pr-5 text-sm leading-6 text-slate-400'>
                        {copy('图片模型负责创作，文本模型负责整理提示词。两组 API 可以独立配置。',
                            'Image models create your visuals. Text models refine your prompts. Configure each API independently.')}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={saveSettings} className='flex min-h-0 flex-1 flex-col'>
                    <div className='min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7'>
                        <div className='flex flex-wrap items-center justify-between gap-3'>
                            <div className='flex items-center gap-2 text-sm text-slate-300'>
                                <Languages className='size-4 text-slate-500' />
                                {copy('界面语言', 'Interface language')}
                            </div>
                            <div className='inline-flex rounded-xl border border-white/8 bg-slate-950/60 p-1' aria-label={copy('界面语言', 'Interface language')}>
                                {(['zh', 'en'] as const).map(value => (
                                    <button
                                        key={value}
                                        type='button'
                                        aria-pressed={language === value}
                                        onClick={() => setLanguage(value)}
                                        className={'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all focus-visible:outline-2 focus-visible:outline-cyan-300 ' + (language === value ? 'bg-slate-700/70 text-white shadow-sm' : 'text-slate-400 hover:text-white')}
                                    >
                                        {language === value && <Check className='size-3' />}
                                        {value === 'zh' ? '中文' : 'English'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div role='tablist' aria-label={copy('API 分类', 'API categories')} className='grid grid-cols-2 gap-2 rounded-2xl bg-slate-950/70 p-1.5'>
                            {(['image', 'text'] as const).map(tab => {
                                const selected = activeTab === tab;
                                const Icon = tab === 'image' ? ImageIcon : MessageSquareText;
                                return (
                                    <button
                                        type='button'
                                        role='tab'
                                        id={'settings-tab-' + tab}
                                        aria-controls={'settings-panel-' + tab}
                                        aria-selected={selected}
                                        tabIndex={selected ? 0 : -1}
                                        onKeyDown={event => {
                                            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                                            event.preventDefault();
                                            const nextTab = event.key === 'Home' ? 'image' : event.key === 'End' ? 'text' : tab === 'image' ? 'text' : 'image';
                                            setActiveTab(nextTab);
                                            setModelSearch('');
                                            document.getElementById('settings-tab-' + nextTab)?.focus();
                                        }}
                                        key={tab}
                                        onClick={() => { setActiveTab(tab); setModelSearch(''); }}
                                        className={'flex min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm transition-all duration-200 focus-visible:outline-2 focus-visible:outline-cyan-300 ' + (selected ? 'bg-cyan-400/10 text-cyan-200 shadow-sm ring-1 ring-cyan-300/20' : 'text-slate-400 hover:bg-white/3 hover:text-slate-200')}
                                    >
                                        <Icon className='size-4 shrink-0' />
                                        {tab === 'image' ? copy('图片模型', 'Image models') : copy('文本模型', 'Text models')}
                                        <span className={'hidden rounded-md px-1.5 py-0.5 text-[10px] tabular-nums sm:inline ' + (selected ? 'bg-cyan-300/10 text-cyan-200' : 'bg-white/5 text-slate-500')}>
                                            {tab === 'image' ? imageList.length : textList.length}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {unavailable && (
                            <div role='alert' className='flex gap-3 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100'>
                                <LockKeyhole className='mt-1 size-4 shrink-0' />
                                <span>{copy('API 配置仅限本机开发环境。请从 localhost 或 127.0.0.1 打开本地网站；语言和模型列表仍可查看。',
                                    'API settings are available only on the local development site. Open localhost or 127.0.0.1 to edit them. You can still change language and view models here.')}</span>
                            </div>
                        )}

                        <section
                            key={activeTab}
                            role='tabpanel'
                            id={'settings-panel-' + activeTab}
                            aria-labelledby={'settings-tab-' + activeTab}
                            className='space-y-5 animate-in fade-in-0 slide-in-from-bottom-1 duration-200 motion-reduce:animate-none'
                        >
                            <div className='flex items-start justify-between gap-3'>
                                <div>
                                    <h3 className='text-sm font-semibold'>{providerIsImage ? copy('图片生成 API', 'Image generation API') : copy('提示词整理 API', 'Prompt refinement API')}</h3>
                                    <p className='mt-1 text-xs leading-5 text-slate-400'>
                                        {providerIsImage
                                            ? copy('图片模型在生成 / 编辑表单中选择。', 'Choose an image model in the Generate or Edit form.')
                                            : copy('生成图片前，将你的描述整理成完整提示词。', 'Turn your description into a complete prompt before generating images.')}
                                    </p>
                                </div>
                                {!loading && (
                                    <span className={'mt-0.5 flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] ' + (keyConfigured ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/5 text-slate-500')}>
                                        {keyConfigured ? <ShieldCheck className='size-3' /> : <LockKeyhole className='size-3' />}
                                        {keyConfigured ? copy('已保存密钥', 'Key saved') : copy('未配置', 'Not configured')}
                                    </span>
                                )}
                            </div>

                            {!providerIsImage && (
                                <label className='flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-cyan-300/10 bg-cyan-300/5 p-3.5'>
                                    <span className='flex items-center gap-2 text-sm'><Sparkles className='size-4 text-cyan-300' />{copy('启用提示词整理', 'Enable prompt refinement')}</span>
                                    <input
                                        type='checkbox'
                                        role='switch'
                                        checked={form.promptRefinerEnabled}
                                        onChange={event => updateField('promptRefinerEnabled', event.target.checked)}
                                        disabled={controlsDisabled}
                                        className='size-4 accent-cyan-300'
                                    />
                                </label>
                            )}

                            {loading ? (
                                <div role='status' className='flex h-40 items-center justify-center gap-2 text-sm text-slate-400'>
                                    <Loader2 className='size-4 animate-spin' />{copy('正在读取本地配置…', 'Loading local settings…')}
                                </div>
                            ) : (
                                <div className='space-y-4'>
                                    <div className='space-y-2'>
                                        <label htmlFor={'settings-' + activeTab + '-url'} className='block text-xs font-medium text-slate-300'>
                                            {copy('接口地址', 'Base URL')}{language === 'zh' && <span className='font-normal text-slate-500'> / Base URL</span>}
                                        </label>
                                        <Input
                                            id={'settings-' + activeTab + '-url'}
                                            type='url'
                                            autoComplete='off'
                                            spellCheck={false}
                                            placeholder='https://api.example.com/v1'
                                            value={providerIsImage ? form.openaiBaseUrl : form.promptRefinerBaseUrl}
                                            onChange={event => updateField(providerIsImage ? 'openaiBaseUrl' : 'promptRefinerBaseUrl', event.target.value)}
                                            disabled={controlsDisabled}
                                            className={fieldClass}
                                        />
                                    </div>
                                    <div className='space-y-2'>
                                        <label htmlFor={'settings-' + activeTab + '-key'} className='block text-xs font-medium text-slate-300'>
                                            {copy('API 密钥', 'API key')}
                                        </label>
                                        <Input
                                            id={'settings-' + activeTab + '-key'}
                                            type='password'
                                            autoComplete='new-password'
                                            spellCheck={false}
                                            placeholder={keyConfigured ? copy('已保存，留空保持原密钥', 'Saved — leave blank to keep the current key') : copy('输入 API 密钥', 'Enter your API key')}
                                            value={providerIsImage ? form.openaiApiKey : form.promptRefinerApiKey}
                                            onChange={event => updateField(providerIsImage ? 'openaiApiKey' : 'promptRefinerApiKey', event.target.value)}
                                            disabled={controlsDisabled}
                                            className={fieldClass}
                                        />
                                    </div>
                                    {!providerIsImage && (
                                        <div className='space-y-2'>
                                            <label htmlFor='settings-text-model' className='block text-xs font-medium text-slate-300'>{copy('用于整理提示词的文本模型', 'Text model for prompt refinement')}</label>
                                            <Select
                                                value={textModelSupported ? form.promptRefinerModel : ''}
                                                onValueChange={value => updateField('promptRefinerModel', value)}
                                                disabled={controlsDisabled || modelsLoading || textList.length === 0}
                                            >
                                                <SelectTrigger id='settings-text-model' className={fieldClass + ' w-full [&_[data-slot=select-value]]:truncate'}>
                                                    <SelectValue placeholder={modelsLoading ? copy('正在加载模型…', 'Loading models…') : copy('选择 API 支持的文本模型', 'Choose a supported text model')} />
                                                </SelectTrigger>
                                                <SelectContent className='max-h-64 max-w-[calc(100vw-3rem)] border-white/10 bg-slate-950 text-slate-100'>
                                                    {textList.map(model => <SelectItem key={model} value={model} className='focus:bg-cyan-300/10 focus:text-cyan-100'>{model}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            {form.promptRefinerModel && !textModelSupported && (
                                                <p className='break-words text-xs leading-5 text-amber-300/90'>
                                                    {copy('已保存的模型不在当前列表中：', 'The saved model is not in the current list: ')}{form.promptRefinerModel}
                                                </p>
                                            )}
                                            <p className='text-xs leading-5 text-slate-500'>{copy('首次配置时，先保存 API，再从刷新的模型列表中选择并保存。', 'For a new provider, save the API first, then select a model from the refreshed list and save again.')}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className='rounded-2xl border border-white/7 bg-slate-950/40'>
                                <div className='flex items-center justify-between gap-3 px-4 py-3'>
                                    <span className='text-xs text-slate-400'>
                                        {copy('API 返回的可用模型', 'Models returned by the API')}
                                        <span className='ml-2 font-mono text-slate-200'>{currentModels.length}</span>
                                    </span>
                                    <button
                                        type='button'
                                        disabled={modelsLoading || saving}
                                        onClick={() => { void onRefresh(); }}
                                        className='flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-cyan-300 transition-colors hover:bg-cyan-300/10 disabled:opacity-50'
                                    >
                                        <RefreshCw className={'size-3 ' + (modelsLoading ? 'animate-spin' : '')} />
                                        {modelsLoading ? copy('刷新中', 'Refreshing') : copy('刷新模型', 'Refresh')}
                                    </button>
                                </div>
                                {currentError ? (
                                    <div role='status' className='flex gap-2 border-t border-white/5 px-4 py-3 text-xs leading-5 text-amber-300/90'>
                                        <CircleAlert className='mt-0.5 size-3.5 shrink-0' /><span className='min-w-0 break-words'>{t(currentError)}</span>
                                    </div>
                                ) : currentModels.length === 0 ? (
                                    <p className='border-t border-white/5 px-4 py-3 text-xs leading-5 text-slate-500'>
                                        {modelsLoading ? copy('正在查询 API…', 'Querying the API…') : copy('暂无可用模型。配置并保存这组 API 后刷新。', 'No available models. Configure and save this API, then refresh.')}
                                    </p>
                                ) : (
                                    <details className='group border-t border-white/5'>
                                        <summary className='flex cursor-pointer list-none items-center gap-1.5 px-4 py-3 text-xs text-slate-400 transition-colors hover:text-slate-200 [&::-webkit-details-marker]:hidden'>
                                            <ChevronRight className='size-3 transition-transform group-open:rotate-90' />
                                            {copy('查看模型列表', 'Browse model list')}
                                        </summary>
                                        <div className='space-y-2 px-4 pb-4'>
                                            <Input
                                                aria-label={copy('搜索模型', 'Search models')}
                                                value={modelSearch}
                                                onChange={event => setModelSearch(event.target.value)}
                                                placeholder={copy('搜索模型名称…', 'Search model names…')}
                                                className='h-8 border-white/10 bg-slate-950 text-xs placeholder:text-slate-600'
                                            />
                                            <ul className='max-h-32 space-y-1 overflow-y-auto pr-1'>
                                                {visibleModels.map(model => <li key={model} className='break-all rounded-md bg-white/3 px-2 py-1.5 font-mono text-[11px] text-slate-300'>{model}</li>)}
                                                {visibleModels.length === 0 && <li className='py-2 text-xs text-slate-500'>{copy('没有匹配的模型', 'No matching models')}</li>}
                                            </ul>
                                        </div>
                                    </details>
                                )}
                            </div>
                        </section>
                    </div>

                    <div className='shrink-0 space-y-3 border-t border-white/7 bg-slate-950/35 px-5 py-4 sm:px-7'>
                        {message && !(message === 'load-error' && unavailable) && (
                            <div role={message === 'saved' ? 'status' : 'alert'} className={'flex items-start gap-2 text-xs leading-5 ' + (message === 'saved' ? 'text-emerald-300' : 'text-rose-300')}>
                                {message === 'saved' ? <Check className='mt-0.5 size-4 shrink-0' /> : <CircleAlert className='mt-0.5 size-4 shrink-0' />}
                                <span className='min-w-0 break-words'>
                                    {message === 'saved' ? copy('配置已保存到本地，下次请求立即生效。重启后仍然保留。', 'Saved locally and applied to the next request. Your settings survive restarts.')
                                        : message === 'load-error' ? copy('无法读取配置。', 'Could not load settings.') : copy('保存未完成。', 'Could not save settings.')}
                                    {serverError && ' ' + t(serverError)}
                                </span>
                            </div>
                        )}
                        {busy && <p className='text-xs text-amber-200/80'>{copy('图片任务进行中，完成后可以修改 API 配置。', 'An image task is running. You can update API settings when it finishes.')}</p>}
                        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                            <p className='flex items-start gap-1.5 text-[11px] leading-5 text-slate-500 sm:max-w-[320px]'>
                                <ShieldCheck className='mt-0.5 size-3.5 shrink-0 text-slate-400' />
                                {copy('密钥保存在本机服务端配置文件，不会返回浏览器，也不会加入 Git。', 'Keys stay in the local server config, are never returned to the browser, and are excluded from Git.')}
                            </p>
                            <Button type='submit' disabled={controlsDisabled} className='h-10 rounded-xl bg-cyan-300 px-4 font-semibold text-slate-950 shadow-lg shadow-cyan-950/20 transition-all hover:bg-cyan-200 active:scale-[0.98] disabled:opacity-40'>
                                {saving ? <Loader2 className='size-4 animate-spin' /> : <Save className='size-4' />}
                                {saving ? copy('正在保存并刷新…', 'Saving and refreshing…') : copy('保存配置并刷新', 'Save and refresh')}
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
