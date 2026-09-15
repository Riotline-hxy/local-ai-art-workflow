'use client';

import type { HistoryMetadata } from '@/app/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose
} from '@/components/ui/dialog';
import { getModelRates, type GptImageModel } from '@/lib/cost-utils';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
    Copy,
    Check,
    Layers,
    DollarSign,
    Pencil,
    Sparkles as SparklesIcon,
    HardDrive,
    Database,
    FileImage,
    Trash2
} from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

type HistoryPanelProps = {
    history: HistoryMetadata[];
    onSelectImage: (item: HistoryMetadata) => void;
    onClearHistory: () => void;
    getImageSrc: (filename: string) => string | undefined;
    onDeleteItemRequest: (item: HistoryMetadata) => void;
    itemPendingDeleteConfirmation: HistoryMetadata | null;
    onConfirmDeletion: () => void;
    onCancelDeletion: () => void;
    deletePreferenceDialogValue: boolean;
    onDeletePreferenceDialogChange: (isChecked: boolean) => void;
};

const formatDuration = (ms: number): string => {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
};

const calculateCost = (value: number, rate: number): string => {
    const cost = value * rate;
    return isNaN(cost) ? 'N/A' : cost.toFixed(4);
};

function HistoryPanelImpl({
    history,
    onSelectImage,
    onClearHistory,
    getImageSrc,
    onDeleteItemRequest,
    itemPendingDeleteConfirmation,
    onConfirmDeletion,
    onCancelDeletion,
    deletePreferenceDialogValue,
    onDeletePreferenceDialogChange
}: HistoryPanelProps) {
    const { t, language } = useI18n();
    const [openPromptDialogTimestamp, setOpenPromptDialogTimestamp] = React.useState<number | null>(null);
    const [openCostDialogTimestamp, setOpenCostDialogTimestamp] = React.useState<number | null>(null);
    const [isTotalCostDialogOpen, setIsTotalCostDialogOpen] = React.useState(false);
    const [copiedTimestamp, setCopiedTimestamp] = React.useState<number | null>(null);

    const { totalCost, totalImages } = React.useMemo(() => {
        let cost = 0;
        let images = 0;
        history.forEach((item) => {
            if (item.costDetails) {
                cost += item.costDetails.estimated_cost_usd;
            }
            images += item.images?.length ?? 0;
        });

        return { totalCost: Math.round(cost * 10000) / 10000, totalImages: images };
    }, [history]);

    const averageCost = totalImages > 0 ? totalCost / totalImages : 0;

    const handleCopy = async (text: string | null | undefined, timestamp: number) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopiedTimestamp(timestamp);
            setTimeout(() => setCopiedTimestamp(null), 1500);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    return (
        <Card className='flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
            <CardHeader className='flex flex-row items-center justify-between gap-4 border-b border-white/10 px-4 py-3'>
                <div className='flex items-center gap-2'>
                    <CardTitle className='text-lg font-medium text-white'>{t('历史记录')}</CardTitle>
                    {totalCost > 0 && (
                        <Dialog open={isTotalCostDialogOpen} onOpenChange={setIsTotalCostDialogOpen}>
                            <DialogTrigger asChild>
                                <button
                                    className='mt-0.5 flex items-center gap-1 rounded-full bg-green-600/80 px-1.5 py-0.5 text-[12px] text-white transition-colors hover:bg-green-500/90'
                                    aria-label={t('查看费用汇总')}>
                                    {t('总费用：$')}
                                    {totalCost.toFixed(4)}
                                </button>
                            </DialogTrigger>
                            <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-[450px]'>
                                <DialogHeader>
                                    <DialogTitle className='text-white'>{t('费用汇总')}</DialogTitle>
                                    {/* Add sr-only description for accessibility */}
                                    <DialogDescription className='sr-only'>
                                        {t('历史记录中所有图片的估算费用，实际费用以服务商账单为准。')}
                                    </DialogDescription>
                                </DialogHeader>
                                <div className='space-y-1 pt-1 text-xs text-neutral-400'>
                                    <p className='font-medium'>gpt-image-2:</p>
                                    <ul className='list-disc pl-4'>
                                        <li>{t('文字输入：5 美元 / 百万令牌')}</li>
                                        <li>{t('图片输入：8 美元 / 百万令牌')}</li>
                                        <li>{t('图片输出：30 美元 / 百万令牌')}</li>
                                    </ul>
                                    <p className='mt-2 font-medium'>gpt-image-1.5:</p>
                                    <ul className='list-disc pl-4'>
                                        <li>{t('文字输入：5 美元 / 百万令牌')}</li>
                                        <li>{t('图片输入：8 美元 / 百万令牌')}</li>
                                        <li>{t('图片输出：32 美元 / 百万令牌')}</li>
                                    </ul>
                                    <p className='mt-2 font-medium'>gpt-image-1:</p>
                                    <ul className='list-disc pl-4'>
                                        <li>{t('文字输入：5 美元 / 百万令牌')}</li>
                                        <li>{t('图片输入：10 美元 / 百万令牌')}</li>
                                        <li>{t('图片输出：40 美元 / 百万令牌')}</li>
                                    </ul>
                                    <p className='mt-2 font-medium'>gpt-image-1-mini:</p>
                                    <ul className='list-disc pl-4'>
                                        <li>{t('文字输入：2 美元 / 百万令牌')}</li>
                                        <li>{t('图片输入：2.50 美元 / 百万令牌')}</li>
                                        <li>{t('图片输出：8 美元 / 百万令牌')}</li>
                                    </ul>
                                </div>
                                <div className='space-y-2 py-4 text-sm text-neutral-300'>
                                    <div className='flex justify-between'>
                                        <span>{t('累计图片：')}</span> <span>{totalImages.toLocaleString()}</span>
                                    </div>
                                    <div className='flex justify-between'>
                                        <span>{t('平均每张费用：')}</span> <span>${averageCost.toFixed(4)}</span>
                                    </div>
                                    <hr className='my-2 border-neutral-700' />
                                    <div className='flex justify-between font-medium text-white'>
                                        <span>{t('总估算费用：')}</span>
                                        <span>${totalCost.toFixed(4)}</span>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button
                                            type='button'
                                            variant='secondary'
                                            size='sm'
                                            className='bg-neutral-700 text-neutral-200 hover:bg-neutral-600'>
                                            {t('关闭')}
                                        </Button>
                                    </DialogClose>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
                {history.length > 0 && (
                    <Button
                        variant='ghost'
                        size='sm'
                        onClick={onClearHistory}
                        className='h-auto rounded-md px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white'>
                        {t('清空')}
                    </Button>
                )}
            </CardHeader>
            <CardContent className='flex-grow overflow-y-auto p-4'>
                {history.length === 0 ? (
                    <div className='flex h-full items-center justify-center text-white/40'>
                        <p>{t('生成的图片会显示在这里。')}</p>
                    </div>
                ) : (
                    <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'>
                        {[...history].map((item) => {
                            const firstImage = item.images?.[0];
                            const imageCount = item.images?.length ?? 0;
                            const isMultiImage = imageCount > 1;
                            const itemKey = item.timestamp;
                            const originalStorageMode = item.storageModeUsed || 'fs';
                            const outputFormat = item.output_format || 'png';

                            let thumbnailUrl: string | undefined;
                            if (firstImage) {
                                if (originalStorageMode === 'indexeddb') {
                                    thumbnailUrl = getImageSrc(firstImage.filename);
                                } else {
                                    thumbnailUrl = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/image/${firstImage.filename}`;
                                }
                            }

                            return (
                                <div key={itemKey} className='flex flex-col'>
                                    <div className='group relative'>
                                        <button
                                            onClick={() => onSelectImage(item)}
                                            className='relative block aspect-square w-full overflow-hidden rounded-t-md border border-white/20 transition-all duration-150 group-hover:border-white/40 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black focus:outline-none'
                                            aria-label={t(
                                                `查看 ${new Date(item.timestamp).toLocaleString(language === 'en' ? 'en-US' : 'zh-CN')} 的图片`,
                                                `View image batch from ${new Date(item.timestamp).toLocaleString(language === 'en' ? 'en-US' : 'zh-CN')}`
                                            )}>
                                            {thumbnailUrl ? (
                                                <Image
                                                    src={thumbnailUrl}
                                                    alt={t(
                                                        `${new Date(item.timestamp).toLocaleString()} 生成的图片预览`,
                                                        `Preview for batch generated at ${new Date(item.timestamp).toLocaleString()}`
                                                    )}
                                                    width={150}
                                                    height={150}
                                                    className='h-full w-full object-cover'
                                                    unoptimized
                                                />
                                            ) : (
                                                <div className='flex h-full w-full items-center justify-center bg-neutral-800 text-neutral-500'>
                                                    ?
                                                </div>
                                            )}
                                            <div
                                                className={cn(
                                                    'pointer-events-none absolute top-1 left-1 z-10 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] text-white',
                                                    item.mode === 'edit' ? 'bg-orange-600/80' : 'bg-blue-600/80'
                                                )}>
                                                {item.mode === 'edit' ? (
                                                    <Pencil size={12} />
                                                ) : (
                                                    <SparklesIcon size={12} />
                                                )}
                                                {item.mode === 'edit' ? t('编辑') : t('生成')}
                                            </div>
                                            {isMultiImage && (
                                                <div className='pointer-events-none absolute right-1 bottom-1 z-10 flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[12px] text-white'>
                                                    <Layers size={16} />
                                                    {imageCount}
                                                </div>
                                            )}
                                            <div className='pointer-events-none absolute bottom-1 left-1 z-10 flex items-center gap-1'>
                                                <div className='flex items-center gap-1 rounded-full border border-white/10 bg-neutral-900/80 px-1 py-0.5 text-[11px] text-white/70'>
                                                    {originalStorageMode === 'fs' ? (
                                                        <HardDrive size={12} className='text-neutral-400' />
                                                    ) : (
                                                        <Database size={12} className='text-blue-400' />
                                                    )}
                                                    <span>{originalStorageMode === 'fs' ? 'file' : 'db'}</span>
                                                </div>
                                                {item.output_format && (
                                                    <div className='flex items-center gap-1 rounded-full border border-white/10 bg-neutral-900/80 px-1 py-0.5 text-[11px] text-white/70'>
                                                        <FileImage size={12} className='text-neutral-400' />
                                                        <span>{outputFormat.toUpperCase()}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                        {item.costDetails && (
                                            <Dialog
                                                open={openCostDialogTimestamp === itemKey}
                                                onOpenChange={(isOpen) => !isOpen && setOpenCostDialogTimestamp(null)}>
                                                <DialogTrigger asChild>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenCostDialogTimestamp(itemKey);
                                                        }}
                                                        className='absolute top-1 right-1 z-20 flex items-center gap-0.5 rounded-full bg-green-600/80 px-1.5 py-0.5 text-[11px] text-white transition-colors hover:bg-green-500/90'
                                                        aria-label={t('查看费用明细')}>
                                                        <DollarSign size={12} />
                                                        {item.costDetails.estimated_cost_usd.toFixed(4)}
                                                    </button>
                                                </DialogTrigger>
                                                <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-[450px]'>
                                                    <DialogHeader>
                                                        <DialogTitle className='text-white'>
                                                            {t('费用明细')}
                                                        </DialogTitle>
                                                        <DialogDescription className='sr-only'>
                                                            {t('本次生成的估算费用，实际以服务商账单为准。')}
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    {(() => {
                                                        const modelForRates: GptImageModel = (item.model ||
                                                            'gpt-image-1') as GptImageModel;
                                                        const rates = getModelRates(modelForRates);
                                                        return (
                                                            <>
                                                                <div className='space-y-1 pt-1 text-xs text-neutral-400'>
                                                                    <p>
                                                                        {t('模型计价：')}
                                                                        {modelForRates}:
                                                                    </p>
                                                                    <ul className='list-disc pl-4'>
                                                                        <li>
                                                                            {t('文字输入：$')}
                                                                            {rates.textInputPerMillion}{' '}
                                                                            {t('/ 百万令牌')}
                                                                        </li>
                                                                        <li>
                                                                            {t('图片输入：$')}
                                                                            {rates.imageInputPerMillion}{' '}
                                                                            {t('/ 百万令牌')}
                                                                        </li>
                                                                        <li>
                                                                            {t('图片输出：$')}
                                                                            {rates.imageOutputPerMillion}{' '}
                                                                            {t('/ 百万令牌')}
                                                                        </li>
                                                                    </ul>
                                                                </div>
                                                                <div className='space-y-2 py-4 text-sm text-neutral-300'>
                                                                    <div className='flex justify-between'>
                                                                        <span>{t('文字输入令牌：')}</span>{' '}
                                                                        <span>
                                                                            {item.costDetails.text_input_tokens.toLocaleString()}{' '}
                                                                            (~$
                                                                            {calculateCost(
                                                                                item.costDetails.text_input_tokens,
                                                                                rates.textInputPerToken
                                                                            )}
                                                                            )
                                                                        </span>
                                                                    </div>
                                                                    {item.costDetails.image_input_tokens > 0 && (
                                                                        <div className='flex justify-between'>
                                                                            <span>{t('图片输入令牌：')}</span>{' '}
                                                                            <span>
                                                                                {item.costDetails.image_input_tokens.toLocaleString()}{' '}
                                                                                (~$
                                                                                {calculateCost(
                                                                                    item.costDetails.image_input_tokens,
                                                                                    rates.imageInputPerToken
                                                                                )}
                                                                                )
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    <div className='flex justify-between'>
                                                                        <span>{t('图片输出令牌：')}</span>{' '}
                                                                        <span>
                                                                            {item.costDetails.image_output_tokens.toLocaleString()}{' '}
                                                                            (~$
                                                                            {calculateCost(
                                                                                item.costDetails.image_output_tokens,
                                                                                rates.imageOutputPerToken
                                                                            )}
                                                                            )
                                                                        </span>
                                                                    </div>
                                                                    <hr className='my-2 border-neutral-700' />
                                                                    <div className='flex justify-between font-medium text-white'>
                                                                        <span>{t('总估算费用：')}</span>
                                                                        <span>
                                                                            $
                                                                            {item.costDetails.estimated_cost_usd.toFixed(
                                                                                4
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </>
                                                        );
                                                    })()}
                                                    <DialogFooter>
                                                        <DialogClose asChild>
                                                            <Button
                                                                type='button'
                                                                variant='secondary'
                                                                size='sm'
                                                                className='bg-neutral-700 text-neutral-200 hover:bg-neutral-600'>
                                                                {t('关闭')}
                                                            </Button>
                                                        </DialogClose>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        )}
                                    </div>

                                    <div className='space-y-1 rounded-b-md border border-t-0 border-neutral-700 bg-black p-2 text-xs text-white/60'>
                                        <p
                                            title={t(
                                                `生成时间：${new Date(item.timestamp).toLocaleString()}`,
                                                `Generated on: ${new Date(item.timestamp).toLocaleString()}`
                                            )}>
                                            <span className='font-medium text-white/80'>{t('总用时：', 'Total: ')}</span>{' '}
                                            {formatDuration(item.durationMs)}
                                            {item.imageRequestMs !== undefined && <span className='mt-1 block'>
                                                {t('整理：', 'Refinement: ')}{formatDuration(item.refinementMs ?? 0)}
                                                {' · '}{t('图片请求：', 'Image request: ')}{formatDuration(item.imageRequestMs)}
                                            </span>}
                                            {item.imageRequestMs === undefined && <span className='block text-white/40'>{t('旧记录未保存分阶段用时', 'Legacy record: phase timings unavailable')}</span>}
                                        </p>
                                        <p>
                                            <span className='font-medium text-white/80'>{t('模型：')}</span>{' '}
                                            {item.model || 'gpt-image-1'}
                                        </p>
                                        <p>
                                            <span className='font-medium text-white/80'>{t('质量：')}</span>{' '}
                                            {t(
                                                { auto: '自动', low: '低', medium: '中', high: '高' }[
                                                    item.quality ?? ''
                                                ] ??
                                                    item.quality ??
                                                    '',
                                                item.quality
                                            )}
                                        </p>
                                        <p>
                                            <span className='font-medium text-white/80'>{t('背景：')}</span>{' '}
                                            {t(
                                                { auto: '自动', opaque: '不透明', transparent: '透明' }[
                                                    item.background ?? ''
                                                ] ??
                                                    item.background ??
                                                    '',
                                                item.background
                                            )}
                                        </p>
                                        <p>
                                            <span className='font-medium text-white/80'>{t('审核：')}</span>{' '}
                                            {t(
                                                { auto: '自动', low: '低' }[item.moderation ?? ''] ??
                                                    item.moderation ??
                                                    '',
                                                item.moderation
                                            )}
                                        </p>
                                        <div className='mt-2 flex items-center gap-1'>
                                            <Dialog
                                                open={openPromptDialogTimestamp === itemKey}
                                                onOpenChange={(isOpen) =>
                                                    !isOpen && setOpenPromptDialogTimestamp(null)
                                                }>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        variant='outline'
                                                        size='sm'
                                                        className='h-6 flex-grow border-white/20 px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white'
                                                        onClick={() => setOpenPromptDialogTimestamp(itemKey)}>
                                                        {t('查看提示词')}
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-[625px]'>
                                                    <DialogHeader>
                                                        <DialogTitle className='text-white'>{t('提示词')}</DialogTitle>
                                                        <DialogDescription className='sr-only'>
                                                            {t('本批图片使用的完整提示词。')}
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <div className='max-h-[400px] overflow-y-auto rounded-md border border-neutral-600 bg-neutral-800 p-3 py-4 text-sm text-neutral-300'>
                                                        {item.prompt || t('未记录提示词。')}
                                                    </div>
                                                    <DialogFooter>
                                                        <Button
                                                            variant='outline'
                                                            size='sm'
                                                            onClick={() => handleCopy(item.prompt, itemKey)}
                                                            className='border-neutral-600 text-neutral-300 hover:bg-neutral-700 hover:text-white'>
                                                            {copiedTimestamp === itemKey ? (
                                                                <Check className='mr-2 h-4 w-4 text-green-400' />
                                                            ) : (
                                                                <Copy className='mr-2 h-4 w-4' />
                                                            )}
                                                            {copiedTimestamp === itemKey ? t('已复制！') : t('复制')}
                                                        </Button>
                                                        <DialogClose asChild>
                                                            <Button
                                                                type='button'
                                                                variant='secondary'
                                                                size='sm'
                                                                className='bg-neutral-700 text-neutral-200 hover:bg-neutral-600'>
                                                                {t('关闭')}
                                                            </Button>
                                                        </DialogClose>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                            <Dialog
                                                open={itemPendingDeleteConfirmation?.timestamp === item.timestamp}
                                                onOpenChange={(isOpen) => {
                                                    if (!isOpen) onCancelDeletion();
                                                }}>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        className='h-6 w-6 bg-red-700/60 text-white hover:bg-red-600/60'
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDeleteItemRequest(item);
                                                        }}
                                                        aria-label={t('删除历史记录')}>
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-md'>
                                                    <DialogHeader>
                                                        <DialogTitle className='text-white'>
                                                            {t('确认删除')}
                                                        </DialogTitle>
                                                        <DialogDescription className='pt-2 text-neutral-300'>
                                                            {t('确定删除这条历史记录吗？将删除')}
                                                            {item.images.length} {t('张图片。此操作无法撤销。')}
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <div className='flex items-center space-x-2 py-2'>
                                                        <Checkbox
                                                            id={`dont-ask-${item.timestamp}`}
                                                            checked={deletePreferenceDialogValue}
                                                            onCheckedChange={(checked) =>
                                                                onDeletePreferenceDialogChange(!!checked)
                                                            }
                                                            className='border-neutral-400 bg-white data-[state=checked]:border-neutral-700 data-[state=checked]:bg-white data-[state=checked]:text-black dark:border-neutral-500 dark:!bg-white'
                                                        />
                                                        <label
                                                            htmlFor={`dont-ask-${item.timestamp}`}
                                                            className='text-sm leading-none font-medium text-neutral-300 peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>
                                                            {t('不再询问')}
                                                        </label>
                                                    </div>
                                                    <DialogFooter className='gap-2 sm:justify-end'>
                                                        <Button
                                                            type='button'
                                                            variant='outline'
                                                            size='sm'
                                                            onClick={onCancelDeletion}
                                                            className='border-neutral-600 text-neutral-300 hover:bg-neutral-700 hover:text-white'>
                                                            {t('取消')}
                                                        </Button>
                                                        <Button
                                                            type='button'
                                                            variant='destructive'
                                                            size='sm'
                                                            onClick={onConfirmDeletion}
                                                            className='bg-red-600 text-white hover:bg-red-500'>
                                                            {t('删除')}
                                                        </Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export const HistoryPanel = React.memo(HistoryPanelImpl);
