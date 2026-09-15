'use client';

import Link from 'next/link';
import { finishTiming, type WorkflowTiming } from '@/components/elapsed-time';
import { SettingsDialog } from '@/components/settings-dialog';
import { WorkflowPanel } from '@/components/workflow-panel';
import { useI18n } from '@/lib/i18n';
import { Settings2, Languages, RefreshCw, Sparkles, MessageSquareText } from 'lucide-react';
import { EditingForm, type EditingFormData } from '@/components/editing-form';
import { GenerationForm, type GenerationFormData } from '@/components/generation-form';
import { HistoryPanel } from '@/components/history-panel';
import { ImageOutput } from '@/components/image-output';
import { PasswordDialog } from '@/components/password-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { calculateApiCost, type CostDetails, type GptImageModel } from '@/lib/cost-utils';
import { getPresetDimensions } from '@/lib/size-utils';
import { db, type ImageRecord } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import * as React from 'react';

type HistoryImage = {
    filename: string;
};

export type HistoryMetadata = {
    timestamp: number;
    images: HistoryImage[];
    storageModeUsed?: 'fs' | 'indexeddb';
    durationMs: number;
    refinementMs?: number;
    imageRequestMs?: number;
    quality: GenerationFormData['quality'];
    background: GenerationFormData['background'];
    moderation: GenerationFormData['moderation'];
    prompt: string;
    mode: 'generate' | 'edit';
    costDetails: CostDetails | null;
    output_format?: GenerationFormData['output_format'];
    model?: GptImageModel;
};

type DrawnPoint = {
    x: number;
    y: number;
    size: number;
};

const MAX_EDIT_IMAGES = 10;

const explicitModeClient = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE;

const vercelEnvClient = process.env.NEXT_PUBLIC_VERCEL_ENV;
const isOnVercelClient = vercelEnvClient === 'production' || vercelEnvClient === 'preview';

let effectiveStorageModeClient: 'fs' | 'indexeddb';

if (explicitModeClient === 'fs') {
    effectiveStorageModeClient = 'fs';
} else if (explicitModeClient === 'indexeddb') {
    effectiveStorageModeClient = 'indexeddb';
} else if (isOnVercelClient) {
    effectiveStorageModeClient = 'indexeddb';
} else {
    effectiveStorageModeClient = 'fs';
}
console.log(
    `Client Effective Storage Mode: ${effectiveStorageModeClient} (Explicit: ${explicitModeClient || 'unset'}, Vercel Env: ${vercelEnvClient || 'N/A'})`
);

type ApiImageResponseItem = {
    filename: string;
    b64_json?: string;
    output_format: string;
    path?: string;
};

export default function HomePage() {
    const [mode, setMode] = React.useState<'generate' | 'edit'>('generate');
    const [isPasswordRequiredByBackend, setIsPasswordRequiredByBackend] = React.useState<boolean | null>(null);
    const [clientPasswordHash, setClientPasswordHash] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const { language, setLanguage, t } = useI18n();
    const [modelRefreshAt, setModelRefreshAt] = React.useState<number | null>(null);
    const [availableModels, setAvailableModels] = React.useState<string[]>([]);
    const [textModels, setTextModels] = React.useState<string[]>([]);
    const [modelsLoading, setModelsLoading] = React.useState(false);
    const [modelErrors, setModelErrors] = React.useState<{ image: string | null; text: string | null }>({ image: null, text: null });
    const [refinerEnabled, setRefinerEnabled] = React.useState(false);
    const [textModel, setTextModel] = React.useState('');
    const [configOpen, setConfigOpen] = React.useState(false);
    const modelsRequestRef = React.useRef<AbortController | null>(null);
    const [promptRefinement, setPromptRefinement] = React.useState<{ original: string; refined: string; status: 'idle' | 'refining' | 'preview' | 'sending' | 'completed' | 'error' }>({ original: '', refined: '', status: 'idle' });
    const [workflowTiming, setWorkflowTiming] = React.useState<WorkflowTiming | null>(null);
    const [generationStartTime, setGenerationStartTime] = React.useState<number | null>(null);
    const [isSendingToEdit, setIsSendingToEdit] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [latestImageBatch, setLatestImageBatch] = React.useState<{ path: string; filename: string }[] | null>(null);
    const [imageOutputView, setImageOutputView] = React.useState<'grid' | number>('grid');
    const [history, setHistory] = React.useState<HistoryMetadata[]>([]);
    const [isInitialLoad, setIsInitialLoad] = React.useState(true);
    const blobUrlCacheRef = React.useRef<Map<string, string>>(new Map());
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = React.useState(false);
    const [passwordDialogContext, setPasswordDialogContext] = React.useState<'initial' | 'retry'>('initial');
    const [lastApiCallArgs, setLastApiCallArgs] = React.useState<[GenerationFormData | EditingFormData] | null>(null);
    const [skipDeleteConfirmation, setSkipDeleteConfirmation] = React.useState<boolean>(false);
    const [itemToDeleteConfirm, setItemToDeleteConfirm] = React.useState<HistoryMetadata | null>(null);
    const [dialogCheckboxStateSkipConfirm, setDialogCheckboxStateSkipConfirm] = React.useState<boolean>(false);

    const allDbImages = useLiveQuery<ImageRecord[] | undefined>(() => db.images.toArray(), []);

    const [editImageFiles, setEditImageFiles] = React.useState<File[]>([]);
    const [editSourceImagePreviewUrls, setEditSourceImagePreviewUrls] = React.useState<string[]>([]);
    const [editPrompt, setEditPrompt] = React.useState('');
    const [editN, setEditN] = React.useState([1]);
    const [editSize, setEditSize] = React.useState<EditingFormData['size']>('auto');
    const [editCustomWidth, setEditCustomWidth] = React.useState<number>(1024);
    const [editCustomHeight, setEditCustomHeight] = React.useState<number>(1024);
    const [editQuality, setEditQuality] = React.useState<EditingFormData['quality']>('auto');
    const [editBrushSize, setEditBrushSize] = React.useState([20]);
    const [editShowMaskEditor, setEditShowMaskEditor] = React.useState(false);
    const [editGeneratedMaskFile, setEditGeneratedMaskFile] = React.useState<File | null>(null);
    const [editIsMaskSaved, setEditIsMaskSaved] = React.useState(false);
    const [editOriginalImageSize, setEditOriginalImageSize] = React.useState<{ width: number; height: number } | null>(
        null
    );
    const [editDrawnPoints, setEditDrawnPoints] = React.useState<DrawnPoint[]>([]);
    const [editMaskPreviewUrl, setEditMaskPreviewUrl] = React.useState<string | null>(null);

    const [genModel, setGenModel] = React.useState<GenerationFormData['model']>('gpt-image-2');
    const [genPrompt, setGenPrompt] = React.useState('');
    const [genN, setGenN] = React.useState([1]);
    const [genSize, setGenSize] = React.useState<GenerationFormData['size']>('auto');
    const [genCustomWidth, setGenCustomWidth] = React.useState<number>(1024);
    const [genCustomHeight, setGenCustomHeight] = React.useState<number>(1024);
    const [genQuality, setGenQuality] = React.useState<GenerationFormData['quality']>('auto');
    const [genOutputFormat, setGenOutputFormat] = React.useState<GenerationFormData['output_format']>('png');
    const [genCompression, setGenCompression] = React.useState([100]);
    const [genBackground, setGenBackground] = React.useState<GenerationFormData['background']>('auto');
    const [genModeration, setGenModeration] = React.useState<GenerationFormData['moderation']>('auto');

    const [editModel, setEditModel] = React.useState<EditingFormData['model']>('gpt-image-2');

    const refreshModels = React.useCallback(async () => {
        modelsRequestRef.current?.abort();
        const controller = new AbortController();
        modelsRequestRef.current = controller;
        setModelsLoading(true);
        try {
            const response = await fetch((process.env.NEXT_PUBLIC_BASE_PATH || '') + '/api/models', { cache: 'no-store', signal: controller.signal });
            if (!response.ok) throw new Error('Unable to fetch models');
            const data = await response.json();
            if (controller.signal.aborted) return;
            const imageList: string[] = [...new Set<string>((data.imageModels || []).filter((m: unknown) => typeof m === 'string' && m))];
            const textList: string[] = [...new Set<string>((data.textModels || []).filter((m: unknown) => typeof m === 'string' && m))];
            setAvailableModels(imageList);
            setTextModels(textList);
            setGenModel(current => imageList.includes(current) ? current : (imageList.find(m => m === 'gpt-image-2') || imageList.find(m => m.startsWith('gpt-image')) || imageList[0] || '') as GptImageModel);
            setEditModel(current => imageList.includes(current) ? current : (imageList.find(m => m === 'gpt-image-2') || imageList.find(m => m.startsWith('gpt-image')) || imageList[0] || '') as GptImageModel);
            setRefinerEnabled(!!data.refinerEnabled);
            setTextModel(data.textModel || '');
            setModelErrors({ image: data.errors?.image || null, text: data.errors?.text || null });
            setModelRefreshAt(Date.now());
        } catch {
            if (controller.signal.aborted) return;
            setAvailableModels([]); setTextModels([]);
            setGenModel('' as GptImageModel); setEditModel('' as GptImageModel);
            setModelErrors({ image: 'Model list unavailable or timed out', text: 'Model list unavailable or timed out' });
        } finally { if (!controller.signal.aborted) setModelsLoading(false); }
    }, []);
    React.useEffect(() => {
        const refresh = () => { if (!isLoading && document.visibilityState === 'visible') void refreshModels(); };
        let cancelled = false;
        queueMicrotask(() => { if (!cancelled && !isLoading) void refreshModels(); });
        const timer = window.setInterval(refresh, 300000);
        window.addEventListener('focus', refresh);
        return () => { cancelled = true; clearInterval(timer); window.removeEventListener('focus', refresh); modelsRequestRef.current?.abort(); };
    }, [refreshModels, isLoading]);

    // Streaming state (shared between generate and edit modes)
    const [enableStreaming, setEnableStreaming] = React.useState(false);
    const [partialImages, setPartialImages] = React.useState<1 | 2 | 3>(2);
    // Streaming preview images (base64 data URLs for partial images during streaming)
    const [streamingPreviewImages, setStreamingPreviewImages] = React.useState<Map<number, string>>(new Map());

    const getImageSrc = React.useCallback(
        (filename: string): string | undefined => {
            const cached = blobUrlCacheRef.current.get(filename);
            if (cached) return cached;

            const record = allDbImages?.find((img) => img.filename === filename);
            if (record?.blob) {
                const url = URL.createObjectURL(record.blob);
                blobUrlCacheRef.current.set(filename, url);
                return url;
            }

            return undefined;
        },
        [allDbImages]
    );

    React.useEffect(() => {
        const cache = blobUrlCacheRef.current;
        return () => {
            cache.forEach((url) => URL.revokeObjectURL(url));
            cache.clear();
        };
    }, []);

    React.useEffect(() => {
        return () => {
            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [editSourceImagePreviewUrls]);

    React.useEffect(() => {
        let cancelled = false;

        queueMicrotask(() => {
            if (cancelled) return;

            try {
                const storedHistory = localStorage.getItem('openaiImageHistory');
                if (storedHistory) {
                    const parsedHistory: HistoryMetadata[] = JSON.parse(storedHistory);
                    if (Array.isArray(parsedHistory)) {
                        setHistory(parsedHistory);
                    } else {
                        console.warn('Invalid history data found in localStorage.');
                        localStorage.removeItem('openaiImageHistory');
                    }
                }
            } catch (e) {
                console.error('Failed to load or parse history from localStorage:', e);
                localStorage.removeItem('openaiImageHistory');
            }
            setIsInitialLoad(false);
        });

        return () => {
            cancelled = true;
        };
    }, []);

    React.useEffect(() => {
        const fetchAuthStatus = async () => {
            try {
                const response = await fetch((process.env.NEXT_PUBLIC_BASE_PATH || '') + '/api/auth-status');
                if (!response.ok) {
                    throw new Error('Failed to fetch auth status');
                }
                const data = await response.json();
                setIsPasswordRequiredByBackend(data.passwordRequired);
            } catch (error) {
                console.error('Error fetching auth status:', error);
                setIsPasswordRequiredByBackend(false);
            }
        };

        fetchAuthStatus();

        let cancelled = false;
        queueMicrotask(() => {
            if (cancelled) return;

            const storedHash = localStorage.getItem('clientPasswordHash');
            if (storedHash) {
                setClientPasswordHash(storedHash);
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    React.useEffect(() => {
        if (!isInitialLoad) {
            try {
                localStorage.setItem('openaiImageHistory', JSON.stringify(history));
            } catch (e) {
                console.error('Failed to save history to localStorage:', e);
            }
        }
    }, [history, isInitialLoad]);

    React.useEffect(() => {
        return () => {
            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [editSourceImagePreviewUrls]);

    React.useEffect(() => {
        let cancelled = false;

        queueMicrotask(() => {
            if (cancelled) return;

            const storedPref = localStorage.getItem('imageGenSkipDeleteConfirm');
            if (storedPref === 'true') {
                setSkipDeleteConfirmation(true);
            } else if (storedPref === 'false') {
                setSkipDeleteConfirmation(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    React.useEffect(() => {
        localStorage.setItem('imageGenSkipDeleteConfirm', String(skipDeleteConfirmation));
    }, [skipDeleteConfirmation]);

    React.useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            if (mode !== 'edit' || !event.clipboardData) {
                return;
            }

            if (editImageFiles.length >= MAX_EDIT_IMAGES) {
                alert(`Cannot paste: Maximum of ${MAX_EDIT_IMAGES} images reached.`);
                return;
            }

            const items = event.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        event.preventDefault();

                        const previewUrl = URL.createObjectURL(file);

                        setEditImageFiles((prevFiles) => [...prevFiles, file]);
                        setEditSourceImagePreviewUrls((prevUrls) => [...prevUrls, previewUrl]);

                        break;
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);

        return () => {
            window.removeEventListener('paste', handlePaste);
        };
    }, [mode, editImageFiles.length]);

    async function sha256Client(text: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    const handleSavePassword = async (password: string) => {
        if (!password.trim()) {
            setError(t("密码不能为空。", "Password cannot be empty."));
            return;
        }
        try {
            const hash = await sha256Client(password);
            localStorage.setItem('clientPasswordHash', hash);
            setClientPasswordHash(hash);
            setError(null);
            setIsPasswordDialogOpen(false);
            if (passwordDialogContext === 'retry' && lastApiCallArgs) {
                await handleApiCall(...lastApiCallArgs);
            }
        } catch (e) {
            console.error('Error hashing password:', e);
            setError(t("密码处理失败，请重试。", "Could not process the password. Please try again."));
        }
    };

    const handleOpenPasswordDialog = () => {
        setPasswordDialogContext('initial');
        setIsPasswordDialogOpen(true);
    };

    const getMimeTypeFromFormat = (format: string): string => {
        if (format === 'jpeg') return 'image/jpeg';
        if (format === 'webp') return 'image/webp';

        return 'image/png';
    };

    const handleApiCall = async (formData: GenerationFormData | EditingFormData) => {
        if (isLoading) return;
        if (!availableModels.includes(formData.model)) {
            setError(t('请先在设置中连接图片 API 并选择有效模型。', 'Connect the image API in Settings and select an available model first.'));
            setConfigOpen(true); return;
        }
        if (refinerEnabled && (!textModel || !textModels.includes(textModel))) {
            setError(t('请在设置中选择 API 支持的文本模型，再保存配置。', 'Select an available text model in Settings and save the configuration.'));
            setConfigOpen(true); return;
        }
        const apiFormData = new FormData();
        if (isPasswordRequiredByBackend && clientPasswordHash) {
            apiFormData.append('passwordHash', clientPasswordHash);
        } else if (isPasswordRequiredByBackend) {
            setError(t('请点击锁图标配置访问密码。', 'Use the lock icon to configure the access password.'));
            setPasswordDialogContext('initial'); setIsPasswordDialogOpen(true); return;
        }
        const originalPrompt = formData.prompt;
        let refinedPrompt = originalPrompt;
        const startTime = performance.now();
        let timing: WorkflowTiming = { total: { start: startTime }, ...(refinerEnabled ? { refinement: { start: startTime } } : {}) };
        setWorkflowTiming(timing);
        const finish = () => { timing = finishTiming(timing, performance.now()); setWorkflowTiming(timing); };
        let durationMs = 0;
        let streamCompleted = false;
        setIsLoading(true);
        setGenerationStartTime(startTime);
        setError(null);
        setLatestImageBatch(null);
        setImageOutputView('grid');
        setStreamingPreviewImages(new Map());
        setPromptRefinement({ original: originalPrompt, refined: '', status: refinerEnabled ? 'refining' : 'preview' });
        try {
            if (refinerEnabled) {
                const response = await fetch((process.env.NEXT_PUBLIC_BASE_PATH || '') + '/api/prompt-refine', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: originalPrompt, mode, passwordHash: clientPasswordHash, referenceCount: mode === 'edit' ? editImageFiles.length : 0 })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || t('提示词整理失败，请检查整理器配置。', 'Prompt refinement failed. Check the refiner configuration.'));
                if (typeof result.prompt !== 'string' || !result.prompt.trim()) throw new Error(t('文本模型未返回提示词。', 'The text model did not return a prompt.'));
                refinedPrompt = result.prompt;
                timing = { ...timing, refinement: { start: startTime, end: performance.now() } };
                setWorkflowTiming(timing);
            }
            setPromptRefinement({ original: originalPrompt, refined: refinedPrompt, status: 'sending' });
            apiFormData.append('mode', mode);

        // Add streaming parameters if enabled
        if (enableStreaming) {
            apiFormData.append('stream', 'true');
            apiFormData.append('partial_images', partialImages.toString());
        }

        if (mode === 'generate') {
            const genData = formData as GenerationFormData;
            apiFormData.append('model', genModel);
            apiFormData.append('prompt', refinedPrompt);
            apiFormData.append('n', genN[0].toString());
            const genSizeToSend =
                genSize === 'custom'
                    ? `${genCustomWidth}x${genCustomHeight}`
                    : (getPresetDimensions(genSize, genModel) ?? genSize);
            apiFormData.append('size', genSizeToSend);
            apiFormData.append('quality', genQuality);
            apiFormData.append('output_format', genOutputFormat);
            if (
                (genOutputFormat === 'jpeg' || genOutputFormat === 'webp') &&
                genData.output_compression !== undefined
            ) {
                apiFormData.append('output_compression', genData.output_compression.toString());
            }
            apiFormData.append('background', genBackground);
            apiFormData.append('moderation', genModeration);
        } else {
            apiFormData.append('model', editModel);
            apiFormData.append('prompt', refinedPrompt);
            apiFormData.append('n', editN[0].toString());
            const editSizeToSend =
                editSize === 'custom'
                    ? `${editCustomWidth}x${editCustomHeight}`
                    : (getPresetDimensions(editSize, editModel) ?? editSize);
            apiFormData.append('size', editSizeToSend);
            apiFormData.append('quality', editQuality);

            editImageFiles.forEach((file, index) => {
                apiFormData.append(`image_${index}`, file, file.name);
            });
            if (editGeneratedMaskFile) {
                apiFormData.append('mask', editGeneratedMaskFile, editGeneratedMaskFile.name);
            }
        }

            timing = { ...timing, image: { start: performance.now() } };
            setWorkflowTiming(timing);
            const response = await fetch((process.env.NEXT_PUBLIC_BASE_PATH || '') + '/api/images', {
                method: 'POST',
                body: apiFormData
            });

            // Check if response is SSE (streaming)
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('text/event-stream')) {
                if (!response.body) {
                    throw new Error(t("服务返回了空响应。", "The service returned an empty response."));
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    // Process complete SSE events
                    const lines = buffer.split('\n\n');
                    buffer = lines.pop() || ''; // Keep incomplete event in buffer

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const jsonStr = line.slice(6);
                            try {
                                const event = JSON.parse(jsonStr);

                                if (event.type === 'partial_image') {
                                    // Update streaming preview with partial image
                                    const imageIndex = event.index ?? 0;
                                    const dataUrl = `data:image/png;base64,${event.b64_json}`;
                                    setStreamingPreviewImages((prev) => {
                                        const newMap = new Map(prev);
                                        newMap.set(imageIndex, dataUrl);
                                        return newMap;
                                    });
                                } else if (event.type === 'error') {
                                    throw new Error(event.error || t("实时预览发生错误。", "An error occurred during live preview."));
                                } else if (event.type === 'done') {
                                    // Finalize with all completed images
                                    timing = { ...timing, image: { ...timing.image!, end: performance.now() } };
                                    durationMs = performance.now() - startTime;

                                    if (event.images && event.images.length > 0) {
                                        let historyQuality: GenerationFormData['quality'] = 'auto';
                                        let historyBackground: GenerationFormData['background'] = 'auto';
                                        let historyModeration: GenerationFormData['moderation'] = 'auto';
                                        let historyOutputFormat: GenerationFormData['output_format'] = 'png';
                                        let historyPrompt: string = '';

                                        if (mode === 'generate') {
                                            historyQuality = genQuality;
                                            historyBackground = genBackground;
                                            historyModeration = genModeration;
                                            historyOutputFormat = genOutputFormat;
                                            historyPrompt = refinedPrompt;
                                        } else {
                                            historyQuality = editQuality;
                                            historyBackground = 'auto';
                                            historyModeration = 'auto';
                                            historyOutputFormat = 'png';
                                            historyPrompt = refinedPrompt;
                                        }

                                        const currentModel = mode === 'generate' ? genModel : editModel;
                                        const costDetails = calculateApiCost(event.usage, currentModel);

                                        const batchTimestamp = Date.now();
                                        const newHistoryEntry: HistoryMetadata = {
                                            timestamp: batchTimestamp,
                                            images: event.images.map((img: { filename: string }) => ({
                                                filename: img.filename
                                            })),
                                            storageModeUsed: effectiveStorageModeClient,
                                            durationMs: durationMs,
                                            quality: historyQuality,
                                            background: historyBackground,
                                            moderation: historyModeration,
                                            output_format: historyOutputFormat,
                                            prompt: historyPrompt,
                                            mode: mode,
                                            costDetails: costDetails,
                                            model: currentModel
                                        };

                                        let newImageBatchPromises: Promise<{ path: string; filename: string } | null>[] =
                                            [];
                                        if (effectiveStorageModeClient === 'indexeddb') {
                                            newImageBatchPromises = event.images.map(async (img: ApiImageResponseItem) => {
                                                if (img.b64_json) {
                                                    try {
                                                        const byteCharacters = atob(img.b64_json);
                                                        const byteNumbers = new Array(byteCharacters.length);
                                                        for (let i = 0; i < byteCharacters.length; i++) {
                                                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                                                        }
                                                        const byteArray = new Uint8Array(byteNumbers);

                                                        const actualMimeType = getMimeTypeFromFormat(img.output_format);
                                                        const blob = new Blob([byteArray], { type: actualMimeType });

                                                        await db.images.put({ filename: img.filename, blob });

                                                        const blobUrl = URL.createObjectURL(blob);
                                                        blobUrlCacheRef.current.set(img.filename, blobUrl);

                                                        return { filename: img.filename, path: blobUrl };
                                                    } catch (dbError) {
                                                        console.error(
                                                            `Error saving blob ${img.filename} to IndexedDB:`,
                                                            dbError
                                                        );
                                                        setError(
                                                            `Failed to save image ${img.filename} to local database.`
                                                        );
                                                        return null;
                                                    }
                                                } else {
                                                    console.warn(
                                                        `Image ${img.filename} missing b64_json in indexeddb mode.`
                                                    );
                                                    return null;
                                                }
                                            });
                                        } else {
                                            newImageBatchPromises = event.images
                                                .filter((img: ApiImageResponseItem) => !!img.path)
                                                .map((img: ApiImageResponseItem) =>
                                                    Promise.resolve({
                                                        path: img.path!,
                                                        filename: img.filename
                                                    })
                                                );
                                        }

                                        const processedImages = (await Promise.all(newImageBatchPromises)).filter(
                                            Boolean
                                        ) as {
                                            path: string;
                                            filename: string;
                                        }[];

                                        setLatestImageBatch(processedImages);
                setPromptRefinement(v => ({ ...v, status: 'completed' }));
                streamCompleted = true;
                                        setImageOutputView(processedImages.length > 1 ? 'grid' : 0);
                                        setStreamingPreviewImages(new Map()); // Clear streaming previews

                                        finish();
                newHistoryEntry.durationMs = timing.total.end! - timing.total.start;
                newHistoryEntry.refinementMs = timing.refinement ? timing.refinement.end! - timing.refinement.start : 0;
                newHistoryEntry.imageRequestMs = timing.image!.end! - timing.image!.start;
                setHistory((prevHistory) => [newHistoryEntry, ...prevHistory]);
                                    }
                                }
                            } catch (parseError) {
                                throw parseError;
                            }
                        }
                    }
                }

                if (!streamCompleted) throw new Error(t('图片流已中断，未收到完成结果。', 'The image stream ended without a completed result.'));
                return; // Exit early for streaming
            }

            // Non-streaming response handling (original code)
            const result = await response.json();
            timing = { ...timing, image: { ...timing.image!, end: performance.now() } };

            if (!response.ok) {
                if (response.status === 401 && isPasswordRequiredByBackend) {
                    setError(t("访问凭据无效或缺失，请重试。", "Access credentials are invalid or missing. Please try again."));
                    setPasswordDialogContext('retry');
                    setLastApiCallArgs([formData]);
                    setIsPasswordDialogOpen(true);
                    setPromptRefinement(v => ({ ...v, status: 'error' }));
                    return;
                }
                throw new Error(result.error || `API request failed with status ${response.status}`);
            }

            if (result.images && result.images.length > 0) {
                durationMs = performance.now() - startTime;

                let historyQuality: GenerationFormData['quality'] = 'auto';
                let historyBackground: GenerationFormData['background'] = 'auto';
                let historyModeration: GenerationFormData['moderation'] = 'auto';
                let historyOutputFormat: GenerationFormData['output_format'] = 'png';
                let historyPrompt: string = '';

                if (mode === 'generate') {
                    historyQuality = genQuality;
                    historyBackground = genBackground;
                    historyModeration = genModeration;
                    historyOutputFormat = genOutputFormat;
                    historyPrompt = refinedPrompt;
                } else {
                    historyQuality = editQuality;
                    historyBackground = 'auto';
                    historyModeration = 'auto';
                    historyOutputFormat = 'png';
                    historyPrompt = refinedPrompt;
                }

                const currentModel = mode === 'generate' ? genModel : editModel;
                const costDetails = calculateApiCost(result.usage, currentModel);

                const batchTimestamp = Date.now();
                const newHistoryEntry: HistoryMetadata = {
                    timestamp: batchTimestamp,
                    images: result.images.map((img: { filename: string }) => ({ filename: img.filename })),
                    storageModeUsed: effectiveStorageModeClient,
                    durationMs: durationMs,
                    quality: historyQuality,
                    background: historyBackground,
                    moderation: historyModeration,
                    output_format: historyOutputFormat,
                    prompt: historyPrompt,
                    mode: mode,
                    costDetails: costDetails,
                    model: currentModel
                };

                let newImageBatchPromises: Promise<{ path: string; filename: string } | null>[] = [];
                if (effectiveStorageModeClient === 'indexeddb') {
                    newImageBatchPromises = result.images.map(async (img: ApiImageResponseItem) => {
                        if (img.b64_json) {
                            try {
                                const byteCharacters = atob(img.b64_json);
                                const byteNumbers = new Array(byteCharacters.length);
                                for (let i = 0; i < byteCharacters.length; i++) {
                                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                                }
                                const byteArray = new Uint8Array(byteNumbers);

                                const actualMimeType = getMimeTypeFromFormat(img.output_format);
                                const blob = new Blob([byteArray], { type: actualMimeType });

                                await db.images.put({ filename: img.filename, blob });

                                const blobUrl = URL.createObjectURL(blob);
                                blobUrlCacheRef.current.set(img.filename, blobUrl);

                                return { filename: img.filename, path: blobUrl };
                            } catch (dbError) {
                                console.error(`Error saving blob ${img.filename} to IndexedDB:`, dbError);
                                setError(`Failed to save image ${img.filename} to local database.`);
                                return null;
                            }
                        } else {
                            console.warn(`Image ${img.filename} missing b64_json in indexeddb mode.`);
                            return null;
                        }
                    });
                } else {
                    newImageBatchPromises = result.images
                        .filter((img: ApiImageResponseItem) => !!img.path)
                        .map((img: ApiImageResponseItem) =>
                            Promise.resolve({
                                path: img.path!,
                                filename: img.filename
                            })
                        );
                }

                const processedImages = (await Promise.all(newImageBatchPromises)).filter(Boolean) as {
                    path: string;
                    filename: string;
                }[];

                setLatestImageBatch(processedImages);
                setPromptRefinement(v => ({ ...v, status: 'completed' }));
                streamCompleted = true;
                setImageOutputView(processedImages.length > 1 ? 'grid' : 0);

                finish();
                newHistoryEntry.durationMs = timing.total.end! - timing.total.start;
                newHistoryEntry.refinementMs = timing.refinement ? timing.refinement.end! - timing.refinement.start : 0;
                newHistoryEntry.imageRequestMs = timing.image!.end! - timing.image!.start;
                setHistory((prevHistory) => [newHistoryEntry, ...prevHistory]);
            } else {
                setLatestImageBatch(null);
                throw new Error(t("接口未返回有效图片。", "The API did not return valid images."));
            }
        } catch (err: unknown) {
            durationMs = performance.now() - startTime;
            console.error(`API Call Error after ${durationMs}ms:`, err);
            const errorMessage = err instanceof Error ? err.message : t("发生未知错误。", "An unknown error occurred.");
            setError(errorMessage);
            setPromptRefinement(v => ({ ...v, status: 'error' }));
            setLatestImageBatch(null);
            setStreamingPreviewImages(new Map());
        } finally {
            finish();
            if (durationMs === 0) durationMs = performance.now() - startTime;
            setIsLoading(false);
            setGenerationStartTime(null);
        }
    };

    const handleHistorySelect = React.useCallback(
        (item: HistoryMetadata) => {
            const originalStorageMode = item.storageModeUsed || 'fs';

            const selectedBatchPromises = item.images.map(async (imgInfo) => {
                let path: string | undefined;
                if (originalStorageMode === 'indexeddb') {
                    path = getImageSrc(imgInfo.filename);
                } else {
                    path = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/image/${imgInfo.filename}`;
                }

                if (path) {
                    return { path, filename: imgInfo.filename };
                } else {
                    console.warn(
                        `Could not get image source for history item: ${imgInfo.filename} (mode: ${originalStorageMode})`
                    );
                    setError(`Image ${imgInfo.filename} could not be loaded.`);
                    return null;
                }
            });

            Promise.all(selectedBatchPromises).then((resolvedBatch) => {
                const validImages = resolvedBatch.filter(Boolean) as { path: string; filename: string }[];

                if (validImages.length !== item.images.length) {
                    setError(
                        t("部分历史图片无法加载，可能已被清理。", "Some images in history could not be loaded. They may have been removed.")
                    );
                } else {
                    setError(null);
                }

                setLatestImageBatch(validImages.length > 0 ? validImages : null);
                setImageOutputView(validImages.length > 1 ? 'grid' : 0);
            });
        },
        [getImageSrc, t]
    );

    const handleClearHistory = React.useCallback(async () => {
        const confirmationMessage =
            effectiveStorageModeClient === 'indexeddb'
                ? t("确定清空所有历史记录及浏览器保存的图片吗？此操作无法撤销。", "Clear all history and images saved in this browser? This cannot be undone.")
                : t("确定清空全部历史记录吗？此操作无法撤销。", "Clear all history? This cannot be undone.");

        if (window.confirm(confirmationMessage)) {
            setHistory([]);
            setLatestImageBatch(null);
            setImageOutputView('grid');
            setError(null);

            try {
                localStorage.removeItem('openaiImageHistory');

                if (effectiveStorageModeClient === 'indexeddb') {
                    await db.images.clear();
                    blobUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
                    blobUrlCacheRef.current.clear();
                }
            } catch (e) {
                console.error('Failed during history clearing:', e);
                setError(`Failed to clear history: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }, [t]);

    const handleSendToEdit = async (filename: string) => {
        if (isSendingToEdit) return;
        setIsSendingToEdit(true);
        setError(null);

        const alreadyExists = editImageFiles.some((file) => file.name === filename);
        if (mode === 'edit' && alreadyExists) {
            setIsSendingToEdit(false);
            return;
        }

        if (mode === 'edit' && editImageFiles.length >= MAX_EDIT_IMAGES) {
            setError(`Cannot add more than ${MAX_EDIT_IMAGES} images to the edit form.`);
            setIsSendingToEdit(false);
            return;
        }

        try {
            let blob: Blob | undefined;
            let mimeType: string = 'image/png';

            if (effectiveStorageModeClient === 'indexeddb') {
                const record = allDbImages?.find((img) => img.filename === filename);
                if (record?.blob) {
                    blob = record.blob;
                    mimeType = blob.type || mimeType;
                } else {
                    throw new Error(`Image ${filename} not found in local database.`);
                }
            } else {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/image/${filename}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch image: ${response.statusText}`);
                }
                blob = await response.blob();
                mimeType = response.headers.get('Content-Type') || mimeType;
            }

            if (!blob) {
                throw new Error(`Could not retrieve image data for ${filename}.`);
            }

            const newFile = new File([blob], filename, { type: mimeType });
            const newPreviewUrl = URL.createObjectURL(blob);

            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));

            setEditImageFiles([newFile]);
            setEditSourceImagePreviewUrls([newPreviewUrl]);

            if (mode === 'generate') {
                setMode('edit');
            }
        } catch (err: unknown) {
            console.error('Error sending image to edit:', err);
            const errorMessage = err instanceof Error ? err.message : t("图片无法送入编辑区。", "Could not send the image to the editor.");
            setError(errorMessage);
        } finally {
            setIsSendingToEdit(false);
        }
    };

    const executeDeleteItem = React.useCallback(
        async (item: HistoryMetadata) => {
            if (!item) return;
            setError(null);

            const { images: imagesInEntry, storageModeUsed, timestamp } = item;
            const filenamesToDelete = imagesInEntry.map((img) => img.filename);

            try {
                if (storageModeUsed === 'indexeddb') {
                    await db.images.where('filename').anyOf(filenamesToDelete).delete();
                    filenamesToDelete.forEach((fn) => {
                        const url = blobUrlCacheRef.current.get(fn);
                        if (url) URL.revokeObjectURL(url);
                        blobUrlCacheRef.current.delete(fn);
                    });
                } else if (storageModeUsed === 'fs') {
                    const apiPayload: { filenames: string[]; passwordHash?: string } = {
                        filenames: filenamesToDelete
                    };
                    if (isPasswordRequiredByBackend && clientPasswordHash) {
                        apiPayload.passwordHash = clientPasswordHash;
                    }

                    const response = await fetch((process.env.NEXT_PUBLIC_BASE_PATH || '') + '/api/image-delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(apiPayload)
                    });

                    const result = await response.json();
                    if (!response.ok) {
                        throw new Error(result.error || `API deletion failed with status ${response.status}`);
                    }
                }

                setHistory((prevHistory) => prevHistory.filter((h) => h.timestamp !== timestamp));
                setLatestImageBatch((prev) =>
                    prev && prev.some((img) => filenamesToDelete.includes(img.filename)) ? null : prev
                );
            } catch (e: unknown) {
                console.error('Error during item deletion:', e);
                setError(e instanceof Error ? e.message : t("删除时发生错误。", "An error occurred while deleting."));
            } finally {
                setItemToDeleteConfirm(null);
            }
        },
        [isPasswordRequiredByBackend, clientPasswordHash, t]
    );

    const handleRequestDeleteItem = React.useCallback(
        (item: HistoryMetadata) => {
            if (!skipDeleteConfirmation) {
                setDialogCheckboxStateSkipConfirm(skipDeleteConfirmation);
                setItemToDeleteConfirm(item);
            } else {
                executeDeleteItem(item);
            }
        },
        [skipDeleteConfirmation, executeDeleteItem]
    );

    const handleConfirmDeletion = React.useCallback(() => {
        if (itemToDeleteConfirm) {
            executeDeleteItem(itemToDeleteConfirm);
            setSkipDeleteConfirmation(dialogCheckboxStateSkipConfirm);
        }
    }, [itemToDeleteConfirm, executeDeleteItem, dialogCheckboxStateSkipConfirm]);

    const handleCancelDeletion = React.useCallback(() => {
        setItemToDeleteConfirm(null);
    }, []);

    return (
        <main className='flex min-h-screen flex-col items-center bg-black p-4 text-white md:p-8 lg:p-12'>
            <PasswordDialog
                isOpen={isPasswordDialogOpen}
                onOpenChange={setIsPasswordDialogOpen}
                onSave={handleSavePassword}
                title={passwordDialogContext === 'retry' ? t("需要密码", "Password required") : t("配置密码", "Configure password")}
                description={
                    passwordDialogContext === 'retry'
                        ? t("请输入正确的访问密码后继续。", "Enter the correct access password to continue.")
                        : t("设置请求使用的密码。", "Set the password to use for requests.")
                }
            />
            <div className='w-full max-w-screen-2xl space-y-6'>
                <header className='flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5'>
                    <div className='flex items-center gap-3'>
                        <div className='rounded-2xl bg-sky-400/10 p-3 text-sky-300'><Sparkles size={22} /></div>
                        <div><h1 className='text-xl font-semibold tracking-tight'>{t('图片工作台', 'Image Studio')}</h1><p className='mt-1 text-xs text-white/45'>{t('从一个想法，到一张好图。', 'From a thought to a picture.')}</p></div>
                    </div>
                    <div className='flex items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5'>
                        <button type='button' className='flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white' onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')} aria-label={t('切换为英文', 'Switch to Chinese')}><Languages size={16} /><span>{language === 'zh' ? 'English' : '中文'}</span></button>
                        <button type='button' disabled={modelsLoading || isLoading} onClick={() => void refreshModels()} title={t('刷新模型列表', 'Refresh models')} aria-label={t('刷新模型列表', 'Refresh models')} className='rounded-xl p-2.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40'><RefreshCw size={16} className={modelsLoading ? 'animate-spin' : ''} /></button>
                        <span className='mx-1 h-5 w-px bg-white/10' />
                        <button type='button' onClick={() => setConfigOpen(true)} className='flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium transition-colors hover:bg-white/15'><Settings2 size={16} />{t('设置', 'Settings')}</button><Link href='/chat' className='flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white'><MessageSquareText size={16} />{t('文本聊天', 'Text chat')}</Link>
                    </div>
                </header>
                <SettingsDialog open={configOpen} onOpenChange={setConfigOpen} onSaved={refreshModels} imageModels={availableModels} textModels={textModels} modelsLoading={modelsLoading} modelErrors={modelErrors} onRefresh={refreshModels} busy={isLoading} />
                <div className='flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/45' aria-live='polite'>
                    <span>{t('图片模型', 'Image models')}: {availableModels.length}</span>
                    <span>{t('文本模型', 'Text models')}: {textModels.length}</span>
                    <span>{refinerEnabled ? t('提示词整理器已启用', 'Prompt refiner enabled') : t('提示词整理器已关闭', 'Prompt refiner off')}</span>
                    {modelsLoading ? <span>{t('正在同步模型…', 'Syncing models…')}</span> : modelRefreshAt && <span>{t('上次同步', 'Last synced')} {new Date(modelRefreshAt).toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US')}</span>}
                </div>
                {modelErrors.image && <p role='alert' className='rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-200'>{t('图片模型列表未就绪，请在设置中检查图片 API，再刷新模型。', 'Image models are unavailable. Check the image API in Settings and refresh.')}</p>}
                <WorkflowPanel timing={workflowTiming} state={promptRefinement} refinerEnabled={refinerEnabled} imageModel={mode === 'generate' ? genModel : editModel} textModel={textModel} />
                <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
                    <div className='relative flex h-[70vh] min-h-[600px] flex-col lg:col-span-1'>
                        <div className={mode === 'generate' ? 'block h-full w-full' : 'hidden'}>
                            <GenerationForm
                                onSubmit={handleApiCall}
                                isLoading={isLoading}
                                currentMode={mode}
                                onModeChange={setMode}
                                isPasswordRequiredByBackend={isPasswordRequiredByBackend}
                                clientPasswordHash={clientPasswordHash}
                                onOpenPasswordDialog={handleOpenPasswordDialog}
                                model={genModel}
                                availableModels={availableModels}
                                setModel={setGenModel}
                                prompt={genPrompt}
                                setPrompt={setGenPrompt}
                                n={genN}
                                setN={setGenN}
                                size={genSize}
                                setSize={setGenSize}
                                customWidth={genCustomWidth}
                                setCustomWidth={setGenCustomWidth}
                                customHeight={genCustomHeight}
                                setCustomHeight={setGenCustomHeight}
                                quality={genQuality}
                                setQuality={setGenQuality}
                                outputFormat={genOutputFormat}
                                setOutputFormat={setGenOutputFormat}
                                compression={genCompression}
                                setCompression={setGenCompression}
                                background={genBackground}
                                setBackground={setGenBackground}
                                moderation={genModeration}
                                setModeration={setGenModeration}
                                enableStreaming={enableStreaming}
                                setEnableStreaming={setEnableStreaming}
                                partialImages={partialImages}
                                setPartialImages={setPartialImages}
                            />
                        </div>
                        <div className={mode === 'edit' ? 'block h-full w-full' : 'hidden'}>
                            <EditingForm
                                onSubmit={handleApiCall}
                                isLoading={isLoading || isSendingToEdit}
                                currentMode={mode}
                                onModeChange={setMode}
                                isPasswordRequiredByBackend={isPasswordRequiredByBackend}
                                clientPasswordHash={clientPasswordHash}
                                onOpenPasswordDialog={handleOpenPasswordDialog}
                                editModel={editModel}
                                availableModels={availableModels}
                                setEditModel={setEditModel}
                                imageFiles={editImageFiles}
                                sourceImagePreviewUrls={editSourceImagePreviewUrls}
                                setImageFiles={setEditImageFiles}
                                setSourceImagePreviewUrls={setEditSourceImagePreviewUrls}
                                maxImages={MAX_EDIT_IMAGES}
                                editPrompt={editPrompt}
                                setEditPrompt={setEditPrompt}
                                editN={editN}
                                setEditN={setEditN}
                                editSize={editSize}
                                setEditSize={setEditSize}
                                editCustomWidth={editCustomWidth}
                                setEditCustomWidth={setEditCustomWidth}
                                editCustomHeight={editCustomHeight}
                                setEditCustomHeight={setEditCustomHeight}
                                editQuality={editQuality}
                                setEditQuality={setEditQuality}
                                editBrushSize={editBrushSize}
                                setEditBrushSize={setEditBrushSize}
                                editShowMaskEditor={editShowMaskEditor}
                                setEditShowMaskEditor={setEditShowMaskEditor}
                                editGeneratedMaskFile={editGeneratedMaskFile}
                                setEditGeneratedMaskFile={setEditGeneratedMaskFile}
                                editIsMaskSaved={editIsMaskSaved}
                                setEditIsMaskSaved={setEditIsMaskSaved}
                                editOriginalImageSize={editOriginalImageSize}
                                setEditOriginalImageSize={setEditOriginalImageSize}
                                editDrawnPoints={editDrawnPoints}
                                setEditDrawnPoints={setEditDrawnPoints}
                                editMaskPreviewUrl={editMaskPreviewUrl}
                                setEditMaskPreviewUrl={setEditMaskPreviewUrl}
                                enableStreaming={enableStreaming}
                                setEnableStreaming={setEnableStreaming}
                                partialImages={partialImages}
                                setPartialImages={setPartialImages}
                            />
                        </div>
                    </div>
                    <div className='flex h-[70vh] min-h-[600px] flex-col lg:col-span-1'>
                        {error && (
                            <Alert variant='destructive' className='mb-4 border-red-500/50 bg-red-900/20 text-red-300'>
                                <AlertTitle className='text-red-200'>{t("错误", "Error")}</AlertTitle>
                                <AlertDescription>{t(error)}</AlertDescription>
                            </Alert>
                        )}
                        <ImageOutput
                            imageBatch={latestImageBatch}
                            viewMode={imageOutputView}
                            onViewChange={setImageOutputView}
                            altText={t("生成结果", "Generated image")}
                            isLoading={isLoading || isSendingToEdit}
                            loadingStartTime={generationStartTime}
                            onSendToEdit={handleSendToEdit}
                            currentMode={mode}
                            baseImagePreviewUrl={editSourceImagePreviewUrls[0] || null}
                            streamingPreviewImages={streamingPreviewImages}
                        />
                    </div>
                </div>

                <div className='min-h-[450px]'>
                    <HistoryPanel
                        history={history}
                        onSelectImage={handleHistorySelect}
                        onClearHistory={handleClearHistory}
                        getImageSrc={getImageSrc}
                        onDeleteItemRequest={handleRequestDeleteItem}
                        itemPendingDeleteConfirmation={itemToDeleteConfirm}
                        onConfirmDeletion={handleConfirmDeletion}
                        onCancelDeletion={handleCancelDeletion}
                        deletePreferenceDialogValue={dialogCheckboxStateSkipConfirm}
                        onDeletePreferenceDialogChange={setDialogCheckboxStateSkipConfirm}
                    />
                </div>
            </div>
        </main>
    );
}
