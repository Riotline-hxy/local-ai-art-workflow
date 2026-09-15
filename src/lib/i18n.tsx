'use client';

import * as React from 'react';

export type Language = 'zh' | 'en';

type Translation = { zh: string; en: string };

const DICTIONARY: Record<string, Translation> = {
    '未获取到 API 模型': { zh: '未获取到 API 模型', en: 'No API models available' },
    '实时预览仅支持一次生成一张图片。': {
        zh: '实时预览仅支持一次生成一张图片。',
        en: 'Live preview is available when generating one image at a time.'
    },
    '生成过程中逐步显示预览图。': {
        zh: '生成过程中逐步显示预览图。',
        en: 'Show preview images as generation progresses.'
    },
    '每张预览额外消耗约 100 个输出令牌，估算费用约 0.003 美元。': {
        zh: '每张预览额外消耗约 100 个输出令牌，估算费用约 0.003 美元。',
        en: 'Each preview uses approximately 100 extra output tokens, estimated at $0.003.'
    },
    '例如：一只穿宇航服的猫漂浮在太空，真实摄影风格': {
        zh: '例如：一只穿宇航服的猫漂浮在太空，真实摄影风格',
        en: 'For example: a cat in a spacesuit floating in space, photorealistic'
    },
    '像素（': { zh: '像素（', en: ' pixels (' },
    '% 上限）·': { zh: '% 上限）·', en: '% of limit) · ' },
    '尺寸需为 16 的倍数，单边不超过 3840 像素，长短边比不超过 3:1，总像素介于 655,360 和 8,294,400 之间。': {
        zh: '尺寸需为 16 的倍数，单边不超过 3840 像素，长短边比不超过 3:1，总像素介于 655,360 和 8,294,400 之间。',
        en: 'Dimensions must be multiples of 16, with each edge at most 3840 px, an aspect ratio of at most 3:1, and between 655,360 and 8,294,400 total pixels.'
    },
    '压缩质量：': { zh: '压缩质量：', en: 'Compression quality: ' },
    '蒙版必须使用 PNG 格式。': { zh: '蒙版必须使用 PNG 格式。', en: 'The mask must be a PNG file.' },
    '无法读取蒙版尺寸。': { zh: '无法读取蒙版尺寸。', en: 'Unable to read mask dimensions.' },
    '请至少选择一张参考图片。': { zh: '请至少选择一张参考图片。', en: 'Choose at least one reference image.' },
    '请先保存绘制的蒙版。': { zh: '请先保存绘制的蒙版。', en: 'Save your drawn mask first.' },
    '未选择文件。': { zh: '未选择文件。', en: 'No files selected.' },
    'gpt-image-2 始终以高保真处理参考图片，有助于提升编辑质量，但比 gpt-image-1.5 的默认设置消耗更多图片输入令牌。': {
        zh: 'gpt-image-2 始终以高保真处理参考图片，有助于提升编辑质量，但比 gpt-image-1.5 的默认设置消耗更多图片输入令牌。',
        en: 'gpt-image-2 always processes reference images at high fidelity. This can improve editing quality but uses more image input tokens than the default gpt-image-1.5 setting.'
    },
    '例如：保留人物，把背景换成海边日落': {
        zh: '例如：保留人物，把背景换成海边日落',
        en: 'For example: keep the person and replace the background with a seaside sunset'
    },
    '参考图片（最多 10 张）': { zh: '参考图片（最多 10 张）', en: 'Reference images (up to 10)' },
    关闭蒙版编辑器: { zh: '关闭蒙版编辑器', en: 'Close mask editor' },
    修改已保存蒙版: { zh: '修改已保存蒙版', en: 'Edit saved mask' },
    '（已保存）': { zh: '（已保存）', en: '(Saved)' },
    '在图片上涂抹要修改的区域，涂抹部分会成为蒙版中的透明区域。': {
        zh: '在图片上涂抹要修改的区域，涂抹部分会成为蒙版中的透明区域。',
        en: 'Paint over the areas you want to edit. Painted areas become transparent in the mask.'
    },
    蒙版编辑参考图: { zh: '蒙版编辑参考图', en: 'Mask editing reference' },
    '画笔大小：': { zh: '画笔大小：', en: 'Brush size: ' },
    像素: { zh: '像素', en: ' px' },
    蒙版预览: { zh: '蒙版预览', en: 'Mask preview' },
    '正在生成蒙版预览…': { zh: '正在生成蒙版预览…', en: 'Creating mask preview…' },
    '蒙版已保存！': { zh: '蒙版已保存！', en: 'Mask saved!' },
    '已应用蒙版：': { zh: '已应用蒙版：', en: 'Applied mask: ' },
    查看费用汇总: { zh: '查看费用汇总', en: 'View cost summary' },
    '总费用：$': { zh: '总费用：$', en: 'Total: $' },
    费用汇总: { zh: '费用汇总', en: 'Cost summary' },
    '历史记录中所有图片的估算费用，实际费用以服务商账单为准。': {
        zh: '历史记录中所有图片的估算费用，实际费用以服务商账单为准。',
        en: 'Estimated cost of all images in history. Actual charges depend on your provider.'
    },
    '文字输入：5 美元 / 百万令牌': { zh: '文字输入：5 美元 / 百万令牌', en: 'Text input: $5 / million tokens' },
    '图片输入：8 美元 / 百万令牌': { zh: '图片输入：8 美元 / 百万令牌', en: 'Image input: $8 / million tokens' },
    '图片输出：30 美元 / 百万令牌': { zh: '图片输出：30 美元 / 百万令牌', en: 'Image output: $30 / million tokens' },
    '图片输出：32 美元 / 百万令牌': { zh: '图片输出：32 美元 / 百万令牌', en: 'Image output: $32 / million tokens' },
    '图片输入：10 美元 / 百万令牌': { zh: '图片输入：10 美元 / 百万令牌', en: 'Image input: $10 / million tokens' },
    '图片输出：40 美元 / 百万令牌': { zh: '图片输出：40 美元 / 百万令牌', en: 'Image output: $40 / million tokens' },
    '文字输入：2 美元 / 百万令牌': { zh: '文字输入：2 美元 / 百万令牌', en: 'Text input: $2 / million tokens' },
    '图片输入：2.50 美元 / 百万令牌': {
        zh: '图片输入：2.50 美元 / 百万令牌',
        en: 'Image input: $2.50 / million tokens'
    },
    '图片输出：8 美元 / 百万令牌': { zh: '图片输出：8 美元 / 百万令牌', en: 'Image output: $8 / million tokens' },
    '累计图片：': { zh: '累计图片：', en: 'Total images:' },
    '平均每张费用：': { zh: '平均每张费用：', en: 'Average cost per image:' },
    '总估算费用：': { zh: '总估算费用：', en: 'Total estimated cost:' },
    编辑: { zh: '编辑', en: 'Edit' },
    查看费用明细: { zh: '查看费用明细', en: 'View cost details' },
    费用明细: { zh: '费用明细', en: 'Cost details' },
    '本次生成的估算费用，实际以服务商账单为准。': {
        zh: '本次生成的估算费用，实际以服务商账单为准。',
        en: 'Estimated cost of this generation. Actual charges depend on your provider.'
    },
    '模型计价：': { zh: '模型计价：', en: 'Model pricing: ' },
    '文字输入：$': { zh: '文字输入：$', en: 'Text input: $' },
    '/ 百万令牌': { zh: '/ 百万令牌', en: ' / million tokens' },
    '图片输入：$': { zh: '图片输入：$', en: 'Image input: $' },
    '图片输出：$': { zh: '图片输出：$', en: 'Image output: $' },
    '文字输入令牌：': { zh: '文字输入令牌：', en: 'Text input tokens:' },
    '图片输入令牌：': { zh: '图片输入令牌：', en: 'Image input tokens:' },
    '图片输出令牌：': { zh: '图片输出令牌：', en: 'Image output tokens:' },
    '耗时：': { zh: '耗时：', en: 'Duration:' },
    '模型：': { zh: '模型：', en: 'Model:' },
    '质量：': { zh: '质量：', en: 'Quality:' },
    '背景：': { zh: '背景：', en: 'Background:' },
    '审核：': { zh: '审核：', en: 'Moderation:' },
    '本批图片使用的完整提示词。': {
        zh: '本批图片使用的完整提示词。',
        en: 'The complete prompt used for this batch of images.'
    },
    '未记录提示词。': { zh: '未记录提示词。', en: 'No prompt recorded.' },
    删除历史记录: { zh: '删除历史记录', en: 'Delete history entry' },
    确认删除: { zh: '确认删除', en: 'Confirm deletion' },
    '确定删除这条历史记录吗？将删除': {
        zh: '确定删除这条历史记录吗？将删除',
        en: 'Delete this history entry? This will delete '
    },
    '张图片。此操作无法撤销。': { zh: '张图片。此操作无法撤销。', en: ' image(s). This cannot be undone.' },
    不再询问: { zh: '不再询问', en: 'Do not ask again' },
    生成结果: { zh: '生成结果', en: 'Generated image' },
    '正在生成预览…': { zh: '正在生成预览…', en: 'Generating preview…' },
    编辑参考图: { zh: '编辑参考图', en: 'Editing reference image' },
    '正在编辑图片…': { zh: '正在编辑图片…', en: 'Editing image…' },
    '正在生成图片…': { zh: '正在生成图片…', en: 'Generating image…' },
    切换网格视图: { zh: '切换网格视图', en: 'Switch to grid view' },
    生成图片: { zh: '生成图片', en: 'Generate image' },
    编辑图片: { zh: '编辑图片', en: 'Edit image' },
    '输入描述，生成你想要的图片。': {
        zh: '输入描述，生成你想要的图片。',
        en: 'Describe the image you want to create.'
    },
    '上传参考图，用文字描述你想怎样修改。': {
        zh: '上传参考图，用文字描述你想怎样修改。',
        en: 'Upload reference images and describe the changes.'
    },
    模型: { zh: '模型', en: 'Model' },
    选择模型: { zh: '选择模型', en: 'Select model' },
    实时预览: { zh: '实时预览', en: 'Live preview' },
    提示词: { zh: '提示词', en: 'Prompt' },
    '生成张数：': { zh: '生成张数：', en: 'Number of images: ' },
    预览张数: { zh: '预览张数', en: 'Preview images' },
    尺寸: { zh: '尺寸', en: 'Size' },
    自动: { zh: '自动', en: 'Auto' },
    自定义: { zh: '自定义', en: 'Custom' },
    正方形: { zh: '正方形', en: 'Square' },
    横向: { zh: '横向', en: 'Landscape' },
    纵向: { zh: '纵向', en: 'Portrait' },
    '宽度（像素）': { zh: '宽度（像素）', en: 'Width (px)' },
    '高度（像素）': { zh: '高度（像素）', en: 'Height (px)' },
    质量: { zh: '质量', en: 'Quality' },
    低: { zh: '低', en: 'Low' },
    中: { zh: '中', en: 'Medium' },
    高: { zh: '高', en: 'High' },
    背景: { zh: '背景', en: 'Background' },
    不透明: { zh: '不透明', en: 'Opaque' },
    透明: { zh: '透明', en: 'Transparent' },
    图片格式: { zh: '图片格式', en: 'Image format' },
    内容审核强度: { zh: '内容审核强度', en: 'Moderation' },
    '生成中…': { zh: '生成中…', en: 'Generating…' },
    生成: { zh: '生成', en: 'Generate' },
    '编辑中…': { zh: '编辑中…', en: 'Editing…' },
    上传图片: { zh: '上传图片', en: 'Upload image' },
    '选择图片…': { zh: '选择图片…', en: 'Choose images…' },
    蒙版: { zh: '蒙版', en: 'Mask' },
    绘制蒙版: { zh: '绘制蒙版', en: 'Draw mask' },
    上传蒙版: { zh: '上传蒙版', en: 'Upload mask' },
    清空: { zh: '清空', en: 'Clear' },
    保存蒙版: { zh: '保存蒙版', en: 'Save mask' },
    '蒙版预览：': { zh: '蒙版预览：', en: 'Mask preview:' },
    历史记录: { zh: '历史记录', en: 'History' },
    关闭: { zh: '关闭', en: 'Close' },
    取消: { zh: '取消', en: 'Cancel' },
    删除: { zh: '删除', en: 'Delete' },
    复制: { zh: '复制', en: 'Copy' },
    '已复制！': { zh: '已复制！', en: 'Copied!' },
    查看提示词: { zh: '查看提示词', en: 'View prompt' },
    继续编辑: { zh: '继续编辑', en: 'Continue editing' },
    文生图: { zh: '文生图', en: 'Text to image' },
    图生图: { zh: '图生图', en: 'Image to image' },
    配置密码: { zh: '配置密码', en: 'Configure password' },
    请输入密码: { zh: '请输入密码', en: 'Enter password' },
    保存: { zh: '保存', en: 'Save' },
    '生成的图片会显示在这里。': { zh: '生成的图片会显示在这里。', en: 'Generated images will appear here.' },
    '图片显示失败。': { zh: '图片显示失败。', en: 'Failed to display image.' }
};

const ERROR_TRANSLATIONS: Record<string, string> = {
    "API key is not configured": "尚未配置 API 密钥",
    "Model list unavailable or timed out": "模型列表获取失败或超时",
    "Unable to read local configuration": "无法读取本地配置文件",
    "Unable to read local configuration.": "无法读取本地配置文件。",
    "Invalid configuration or unable to save. Check the URLs and local file permissions.": "配置保存失败，请检查接口地址和本地文件写入权限。",
    "Prompt refiner is disabled.": "提示词整理器已关闭。",
    "Configure the text API key and select a text model in Settings.": "请在设置中填写文本 API 密钥并选择文本模型。",
    "Configure the image API key in Settings.": "请在设置中填写图片 API 密钥。",
    "Prompt is required.": "提示词不能为空。",
    "The text model returned an empty prompt.": "文本模型返回了空提示词。",
    "Prompt refinement failed or timed out.": "提示词整理失败或超时。",
    "Local configuration is available on localhost in development mode only.": "请从 localhost 或 127.0.0.1 打开本地开发网站来配置 API。"
};

type I18nContextValue = {
    language: Language;
    setLanguage: (language: Language) => void;
    t: (zh: string, en?: string) => string;
};
const I18nContext = React.createContext<I18nContextValue | null>(null);

let memoryLanguage: Language = 'zh';
function getLanguageSnapshot(): Language {
    try {
        const saved = window.localStorage.getItem('photo-language');
        if (saved === 'zh' || saved === 'en') return saved;
    } catch {
        /* Storage can be disabled in private browser contexts. */
    }
    return memoryLanguage;
}
function subscribeToLanguage(callback: () => void) {
    window.addEventListener('storage', callback);
    window.addEventListener('photo-language-change', callback);
    return () => {
        window.removeEventListener('storage', callback);
        window.removeEventListener('photo-language-change', callback);
    };
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const language = React.useSyncExternalStore(subscribeToLanguage, getLanguageSnapshot, () => 'zh' as Language);
    const setLanguage = React.useCallback((next: Language) => {
        memoryLanguage = next;
        try {
            window.localStorage.setItem('photo-language', next);
        } catch {
            /* Retain the choice for this visit. */
        }
        window.dispatchEvent(new Event('photo-language-change'));
    }, []);
    React.useEffect(() => {
        document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
        document.title = language === 'en' ? 'GPT Image Playground' : 'GPT 图片工作台';
    }, [language]);
    const t = React.useCallback(
        (zh: string, en?: string) => {
            if (language === 'en') return en ?? DICTIONARY[zh]?.en ?? zh;
            if (zh.startsWith('Model list request failed: ')) return '模型列表请求失败，HTTP 状态码：' + zh.split(': ').pop();
            if (zh.startsWith('Text API request failed (')) return '文本 API 请求失败' + zh.slice(23, zh.indexOf(').') + 1) + '，请检查服务商配置。';
            return ERROR_TRANSLATIONS[zh] ?? zh;
        },
        [language]
    );
    return <I18nContext.Provider value={{ language, setLanguage, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
    const value = React.useContext(I18nContext);
    if (!value) throw new Error('useI18n must be used inside LanguageProvider');
    return value;
}

export const useLanguage = useI18n;
