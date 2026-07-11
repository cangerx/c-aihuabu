import { ArrowLeft, ArrowRight, BookOpen, CheckSquare, CircleStop, ClipboardPaste, Download, FolderPlus, History, ImagePlus, LoaderCircle, PenLine, Plus, SlidersHorizontal, Sparkles, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { App, Button, Checkbox, Drawer, Empty, Image, Modal, Tag, Tooltip, Typography } from "antd";
import localforage from "localforage";
import { saveAs } from "file-saver";

import { ImageSettingsPanel } from "@/components/image-settings-panel";
import { ModelPicker } from "@/components/model-picker";
import { PromptSelectDialog } from "@/components/prompts/prompt-select-dialog";
import { AssetPickerModal, type InsertAssetPayload } from "@/app/(user)/canvas/components/asset-picker-modal";
import { CanvasResourceMentionTextarea } from "@/app/(user)/canvas/components/canvas-resource-mention-textarea";
import { canvasThemes } from "@/lib/canvas-theme";
import { imageReferenceLabel } from "@/lib/image-reference-prompt";
import { modelOptionLabel, useConfigStore, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { nanoid } from "nanoid";
import { formatBytes, formatDuration, getDataUrlByteSize } from "@/lib/image-utils";
import { requestEdit, requestGeneration } from "@/services/api/image";
import { deleteStoredImages, persistImageUrl, persistImageUrlInBackground, prepareImageForDisplay, proxiedImageDisplayUrl, resolveImageUrl, uploadImage } from "@/services/image-storage";
import { useAssetStore } from "@/stores/use-asset-store";
import type { ReferenceImage } from "@/types/image";
import type { CanvasResourceReference } from "@/app/(user)/canvas/utils/canvas-resource-references";
import { imageSizeLabel } from "@/components/image-settings-panel";
import { isGrokImagineImageConfig, normalizeGrokImagineImageRatio, normalizeGrokImagineImageResolution } from "@/lib/grok-imagine";
import { isGptImage2StyleConfig, normalizeGptImage2Ratio, normalizeGptImage2Resolution } from "@/lib/gpt-image-2";
import { isStepImageEdit2Config, normalizeStepImageEdit2Size } from "@/lib/step-image";

type GeneratedImage = {
    id: string;
    dataUrl: string;
    storageKey?: string;
    durationMs: number;
    width: number;
    height: number;
    bytes: number;
    mimeType?: string;
};

type GenerationResult = {
    id: string;
    status: "pending" | "success" | "failed";
    image?: GeneratedImage;
    error?: string;
};

type GenerationLog = {
    id: string;
    createdAt: number;
    title: string;
    prompt: string;
    time: string;
    model: string;
    config: GenerationLogConfig;
    references: ReferenceImage[];
    durationMs: number;
    successCount: number;
    failCount: number;
    imageCount: number;
    size: string;
    quality: string;
    status: "生成中" | "成功" | "失败";
    images: GeneratedImage[];
    thumbnails: string[];
    error?: string;
};

type GenerationLogConfig = Pick<AiConfig, "model" | "imageModel" | "quality" | "size" | "count">;

type UpdateAiConfig = <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void;

const LOG_STORE_KEY = "infinite-canvas:image_generation_logs";
const RESULT_ACTION_BUTTON_CLASS = "min-w-0 px-1.5 [&_.ant-btn-icon]:shrink-0 [&>span:last-child]:min-w-0 [&>span:last-child]:truncate";
const logStore = localforage.createInstance({ name: "infinite-canvas", storeName: "image_generation_logs" });

export default function ImagePage() {
    const { message: appMessage } = App.useApp();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const promptInputRef = useRef<HTMLTextAreaElement>(null);
    const generationAbortControllersRef = useRef<Map<string, AbortController>>(new Map());
    const stoppedLogIdsRef = useRef<Set<string>>(new Set());
    const deletedLogIdsRef = useRef<Set<string>>(new Set());
    const config = useConfigStore((state) => state.config);
    const effectiveConfig = useEffectiveConfig();
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const addAsset = useAssetStore((state) => state.addAsset);
    const [prompt, setPrompt] = useState("");
    const [references, setReferences] = useState<ReferenceImage[]>([]);
    const [results, setResults] = useState<GenerationResult[]>([]);
    const [logs, setLogs] = useState<GenerationLog[]>([]);
    const [runningCount, setRunningCount] = useState(0);
    const [logsOpen, setLogsOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [promptDialogOpen, setPromptDialogOpen] = useState(false);
    const [assetPickerOpen, setAssetPickerOpen] = useState(false);
    const [mentionTriggerKey, setMentionTriggerKey] = useState(0);
    const [startedAt, setStartedAt] = useState(0);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
    const [previewLog, setPreviewLog] = useState<GenerationLog | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    const model = effectiveConfig.imageModel || effectiveConfig.model;
    const displayConfig = buildImageConfig(effectiveConfig, model);
    const canGenerate = Boolean(prompt.trim());
    const running = runningCount > 0;
    const generationCount = Math.max(1, Math.min(10, Number(config.count) || 1));
    const promptReferences = buildImagePromptReferences(references);

    useEffect(() => {
        if (!running || !startedAt) return;
        const timer = window.setInterval(() => setElapsedMs(performance.now() - startedAt), 1000);
        return () => window.clearInterval(timer);
    }, [running, startedAt]);

    useEffect(() => {
        void refreshLogs();
    }, []);

    const addReferences = async (files?: FileList | null) => {
        const imageFiles = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
        const nextReferences = await Promise.all(
            imageFiles.map(async (file) => {
                const image = await uploadImage(file);
                return { id: nanoid(), name: file.name, type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
            }),
        );
        setReferences((value) => [...value, ...nextReferences]);
    };

    const addReferencesFromClipboard = async () => {
        try {
            const items = await navigator.clipboard.read();
            const blobs = await Promise.all(items.flatMap((item) => item.types.filter((type) => type.startsWith("image/")).map((type) => item.getType(type))));
            if (!blobs.length) {
                appMessage.error("剪切板里没有可读取的图片");
                return;
            }
            const nextReferences = await Promise.all(
                blobs.map(async (blob, index) => {
                    const image = await uploadImage(blob);
                    return { id: nanoid(), name: `clipboard-${index + 1}.png`, type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
                }),
            );
            setReferences((value) => [...value, ...nextReferences]);
            appMessage.success(`已读取 ${nextReferences.length} 张参考图`);
        } catch {
            appMessage.error("剪切板里没有可读取的图片");
        }
    };

    const persistResultImage = async (image: GeneratedImage, index: number, logId?: string) => {
        const storedImage = await persistGeneratedImage(image);
        if (logId && (deletedLogIdsRef.current.has(logId) || stoppedLogIdsRef.current.has(logId))) return storedImage;
        setResults((value) => updateResultAt(value, index, { status: "success", image: storedImage }));
        return storedImage;
    };

    const showResultImage = async (image: GeneratedImage, index: number, logId?: string, onLocalStored?: (index: number, image: GeneratedImage) => void) => {
        // URL 立即展示；有 storageKey 的 b64 结果已落盘；远程 URL 后台慢慢下载
        if (!logId || (!deletedLogIdsRef.current.has(logId) && !stoppedLogIdsRef.current.has(logId))) {
            setResults((value) => updateResultAt(value, index, { status: "success", image }));
        }
        const remoteSource = /^https?:\/\//i.test(image.dataUrl) ? image.dataUrl : "";
        if (remoteSource && !image.storageKey) {
            persistImageUrlInBackground(remoteSource, (stored) => {
                if (logId && (deletedLogIdsRef.current.has(logId) || stoppedLogIdsRef.current.has(logId))) return;
                const localImage: GeneratedImage = {
                    ...image,
                    dataUrl: stored.url,
                    storageKey: stored.storageKey,
                    width: stored.width || image.width,
                    height: stored.height || image.height,
                    bytes: stored.bytes || image.bytes,
                    mimeType: stored.mimeType || image.mimeType,
                };
                setResults((value) => updateResultAt(value, index, { status: "success", image: localImage }));
                onLocalStored?.(index, localImage);
                if (logId) void patchLogImageLocal(logId, index, localImage);
            });
        }
        return image;
    };

    const generate = async () => {
        const text = prompt.trim();
        if (!text) {
            appMessage.error("请输入生图提示词");
            return;
        }
        if (!isAiConfigReady(effectiveConfig, model)) {
            appMessage.warning("请先完成配置");
            openConfigDialog(true);
            return;
        }

        const snapshot = buildRequestSnapshot();
        if (!snapshot) return;

        setElapsedMs(0);
        setRunningCount((value) => value + 1);
        setPreviewLog(null);
        setResults(Array.from({ length: generationCount }, () => ({ id: nanoid(), status: "pending" })));
        const batchStartedAt = performance.now();
        setStartedAt(batchStartedAt);

        const pendingLog = buildLog({
            prompt: text,
            model,
            config: { ...snapshot.config, count: String(generationCount) },
            references: snapshot.references,
            durationMs: 0,
            successCount: 0,
            failCount: 0,
            status: "生成中",
            images: [],
        });
        generationAbortControllersRef.current.set(pendingLog.id, new AbortController());
        await saveLogAsync(pendingLog);

        const slotImages: Array<GeneratedImage | null> = Array.from({ length: generationCount }, () => null);
        const slotErrors: Array<string | null> = Array.from({ length: generationCount }, () => null);
        const updatePendingLog = async (status: GenerationLog["status"], error?: string) => {
            if (deletedLogIdsRef.current.has(pendingLog.id)) return;
            const images = slotImages.filter((image): image is GeneratedImage => Boolean(image));
            await saveLogAsync({
                ...pendingLog,
                durationMs: performance.now() - batchStartedAt,
                successCount: images.length,
                failCount: slotErrors.filter(Boolean).length,
                status,
                images,
                thumbnails: images.map((image) => image.dataUrl).filter(Boolean),
                error,
            });
        };

        const tasks = Array.from({ length: generationCount }, (_, index) =>
            runGenerationSlot(index, snapshot, pendingLog.id)
                .then(async (image) => {
                    if (deletedLogIdsRef.current.has(pendingLog.id) || stoppedLogIdsRef.current.has(pendingLog.id)) return image;
                    const shown = await showResultImage(image, index, pendingLog.id, (slotIndex, localImage) => {
                        slotImages[slotIndex] = localImage;
                        void updatePendingLog(stoppedLogIdsRef.current.has(pendingLog.id) ? "失败" : "成功");
                    });
                    slotImages[index] = shown;
                    await updatePendingLog("生成中");
                    return shown;
                })
                .catch(async (error) => {
                    slotErrors[index] = error instanceof Error ? error.message : "生成失败";
                    await updatePendingLog("生成中", slotErrors[index] || undefined);
                    throw error;
                }),
        );

        const result = await Promise.allSettled(tasks);
        const successImages = result.filter((item): item is PromiseFulfilledResult<GeneratedImage> => item.status === "fulfilled").map((item) => item.value);
        const successCount = successImages.length;
        const failCount = generationCount - successCount;
        const failed = result.find((item): item is PromiseRejectedResult => item.status === "rejected");
        const stopped = stoppedLogIdsRef.current.has(pendingLog.id) || generationAbortControllersRef.current.get(pendingLog.id)?.signal.aborted;

        try {
            if (!deletedLogIdsRef.current.has(pendingLog.id)) await updatePendingLog(successCount && !stopped ? "成功" : "失败", stopped ? "已停止本地生成" : failed?.reason instanceof Error ? failed.reason.message : undefined);
            if (!stopped) successCount ? appMessage.success("图片已生成") : appMessage.error(failed?.reason instanceof Error ? failed.reason.message : "生成失败");
        } finally {
            generationAbortControllersRef.current.delete(pendingLog.id);
            stoppedLogIdsRef.current.delete(pendingLog.id);
            setRunningCount((value) => Math.max(0, value - 1));
        }
    };

    const downloadImage = (image: GeneratedImage, index: number) => {
        saveAs(image.dataUrl, `image-${index + 1}.png`);
    };

    const addResultToReferences = async (image: GeneratedImage, index: number) => {
        const stored = await persistGeneratedImage(image);
        setReferences((value) => [...value, { id: nanoid(), name: `result-${index + 1}.png`, type: stored.mimeType || "image/png", dataUrl: stored.dataUrl, storageKey: stored.storageKey }]);
        appMessage.success("已加入参考图");
    };

    const saveResultToAssets = async (image: GeneratedImage, index: number) => {
        const stored = await persistGeneratedImage(image);
        addAsset({
            kind: "image",
            title: `生成结果 ${index + 1}`,
            coverUrl: stored.dataUrl,
            tags: [],
            source: "生图工作台",
            data: { dataUrl: stored.dataUrl, storageKey: stored.storageKey, width: stored.width, height: stored.height, bytes: stored.bytes, mimeType: stored.mimeType || "image/png" },
            metadata: { source: "image-page", prompt },
        });
        appMessage.success("已加入我的素材");
    };

    const insertPickedAsset = async (payload: InsertAssetPayload) => {
        if (payload.kind === "text") {
            setPrompt(payload.content);
        } else if (payload.kind === "image") {
            const stored = await tryUploadImage(payload.dataUrl);
            setReferences((value) => [...value, { id: nanoid(), name: payload.title, type: stored?.mimeType || "image/png", dataUrl: stored?.url || payload.dataUrl, storageKey: stored?.storageKey }]);
        } else {
            appMessage.warning("生图工作台只能使用文本或图片素材");
        }
        setAssetPickerOpen(false);
    };

    const createSession = () => {
        setPrompt("");
        setReferences([]);
        setResults([]);
        setElapsedMs(0);
        setStartedAt(0);
        setSelectedLogIds([]);
        setPreviewLog(null);
    };

    const handleAppendMention = () => {
        const input = promptInputRef.current;
        const start = input?.selectionStart ?? prompt.length;
        const end = input?.selectionEnd ?? start;
        const prefix = start > 0 && !/\s/.test(prompt[start - 1] || "") ? " " : "";
        const nextCursor = start + prefix.length + 1;
        setPrompt((value) => {
            const safeStart = Math.min(start, value.length);
            const safeEnd = Math.min(end, value.length);
            return `${value.slice(0, safeStart)}${prefix}@${value.slice(safeEnd)}`;
        });
        window.setTimeout(() => {
            if (!input) return;
            input.focus();
            input.setSelectionRange(nextCursor, nextCursor);
            setMentionTriggerKey((key) => key + 1);
        }, 0);
    };

    const stopLogGeneration = (id: string) => {
        stoppedLogIdsRef.current.add(id);
        generationAbortControllersRef.current.get(id)?.abort();
    };

    const stopSelectedLogs = () => {
        const stoppedLogs = logs.filter((log) => selectedLogIds.includes(log.id) && log.status === "生成中");
        if (!stoppedLogs.length) return;
        stoppedLogs.forEach((log) => stopLogGeneration(log.id));
        void Promise.all(
            stoppedLogs.map((log) =>
                logStore.setItem(
                    log.id,
                    serializeLog({
                        ...log,
                        status: "失败",
                        durationMs: Date.now() - log.createdAt,
                        error: "已停止本地生成",
                    }),
                ),
            ),
        ).then(async () => {
            await refreshLogs();
            if (previewLog && stoppedLogs.some((log) => log.id === previewLog.id)) setResults([{ id: previewLog.id, status: "failed", error: "已停止本地生成" }]);
            appMessage.success(`已停止 ${stoppedLogs.length} 条生成记录`);
        });
    };

    const deleteSelectedLogs = () => {
        const deletingIds = [...selectedLogIds];
        deletingIds.forEach((id) => {
            deletedLogIdsRef.current.add(id);
            stopLogGeneration(id);
        });
        const imageKeys = logs.filter((log) => deletingIds.includes(log.id)).flatMap((log) => log.images.map((image) => image.storageKey).filter((key): key is string => Boolean(key)));
        void Promise.all([deleteStoredImages(imageKeys), ...deletingIds.map((id) => logStore.removeItem(id))]).then(refreshLogs);
        if (previewLog && deletingIds.includes(previewLog.id)) {
            setPreviewLog(null);
            setResults([]);
        }
        setSelectedLogIds([]);
        setDeleteConfirmOpen(false);
    };

    const saveLogAsync = async (log: GenerationLog) => {
        if (deletedLogIdsRef.current.has(log.id)) return;
        await logStore.setItem(log.id, serializeLog(log));
        await refreshLogs();
    };

    const refreshLogs = async () => setLogs(await readStoredLogs());

    const previewGenerationLog = async (log: GenerationLog) => {
        const fullLog = await normalizeLog(log);
        setPreviewLog(fullLog);
        setLogsOpen(false);
        setPrompt(fullLog.prompt);
        setReferences(fullLog.references || []);
        if (fullLog.config.imageModel || fullLog.model) updateConfig("imageModel", fullLog.config.imageModel || fullLog.model);
        if (fullLog.config.quality) updateConfig("quality", fullLog.config.quality);
        if (fullLog.config.size) updateConfig("size", fullLog.config.size);
        if (fullLog.config.count) updateConfig("count", fullLog.config.count);
        setResults(logToResults(fullLog));
    };

    const buildRequestSnapshot = () => {
        const text = prompt.trim();
        if (!text) {
            appMessage.error("请输入生图提示词");
            return null;
        }
        if (!isAiConfigReady(effectiveConfig, model)) {
            appMessage.warning("请先完成配置");
            openConfigDialog(true);
            return null;
        }
        return { text, config: { ...displayConfig, model, imageModel: model, count: "1" }, references: [...references] };
    };

    const runGenerationSlot = async (index: number, snapshot: { text: string; config: AiConfig; references: ReferenceImage[] }, logId?: string) => {
        const itemStartedAt = performance.now();
        const controller = logId ? generationAbortControllersRef.current.get(logId) : undefined;
        try {
            if (controller?.signal.aborted || (logId && stoppedLogIdsRef.current.has(logId))) throw new DOMException("Aborted", "AbortError");
            const result = snapshot.references.length ? await requestEdit(snapshot.config, snapshot.text, snapshot.references, undefined, { signal: controller?.signal }) : await requestGeneration(snapshot.config, snapshot.text, { signal: controller?.signal });
            if (controller?.signal.aborted || (logId && (deletedLogIdsRef.current.has(logId) || stoppedLogIdsRef.current.has(logId)))) throw new DOMException("Aborted", "AbortError");
            const image = result[0];
            if (!image) throw new Error("接口没有返回图片");
            const display = await prepareImageForDisplay(image.dataUrl);
            const nextImage = {
                id: image.id,
                dataUrl: display.url,
                storageKey: display.storageKey,
                durationMs: performance.now() - itemStartedAt,
                width: display.width,
                height: display.height,
                bytes: display.bytes || getDataUrlByteSize(image.dataUrl),
                mimeType: display.mimeType,
            };
            if (!logId || !deletedLogIdsRef.current.has(logId)) setResults((value) => updateResultAt(value, index, { status: "success", image: nextImage }));
            return nextImage;
        } catch (error) {
            const stopped = logId && (stoppedLogIdsRef.current.has(logId) || generationAbortControllersRef.current.get(logId)?.signal.aborted);
            if (!logId || !deletedLogIdsRef.current.has(logId)) setResults((value) => updateResultAt(value, index, { status: "failed", error: stopped ? "已停止本地生成" : error instanceof Error ? error.message : "生成失败" }));
            throw error;
        }
    };

    const retryResult = (index: number) => {
        const snapshot = buildRequestSnapshot();
        if (!snapshot) return;
        setPreviewLog(null);
        setResults((value) => updateResultAt(value, index, { status: "pending", error: undefined, image: undefined }));
        void runGenerationSlot(index, snapshot)
            .then((image) => showResultImage(image, index, undefined))
            .catch(() => {});
    };

    return (
        <div className="flex h-full flex-col overflow-hidden bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
            <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[300px_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[320px_minmax(0,1fr)]">
                <aside className="thin-scrollbar hidden min-h-0 overflow-y-auto rounded-lg border border-stone-200 bg-card p-4 shadow-sm dark:border-stone-800 lg:block">
                    <LogPanel
                        logs={logs}
                        selectedLogIds={selectedLogIds}
                        activeLogId={previewLog?.id}
                        onSelectedLogIdsChange={setSelectedLogIds}
                        onCreateSession={createSession}
                        onStopSelected={stopSelectedLogs}
                        onDeleteSelected={() => setDeleteConfirmOpen(true)}
                        onPreviewLog={(log) => void previewGenerationLog(log)}
                    />
                </aside>

                <section className="grid gap-3 lg:min-h-0 lg:overflow-hidden xl:grid-cols-[420px_minmax(0,1fr)]">
                    <div className="thin-scrollbar flex flex-col rounded-lg border border-stone-200 bg-card p-4 shadow-sm dark:border-stone-800 lg:min-h-0 lg:overflow-y-auto">
                        <div>
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h1 className="text-2xl font-semibold text-stone-950 dark:text-stone-100">生图工作台</h1>
                                </div>
                                <div className="flex shrink-0 gap-2 lg:hidden">
                                    <Button icon={<History className="size-4" />} onClick={() => setLogsOpen(true)}>
                                        记录
                                    </Button>
                                    <Button icon={<SlidersHorizontal className="size-4" />} onClick={() => setSettingsOpen(true)}>
                                        参数
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 space-y-5">
                            <div>
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <span className="text-base font-semibold">提示词</span>
                                    <div className="flex gap-2">
                                        <Button size="small" icon={<BookOpen className="size-3.5" />} onClick={() => setPromptDialogOpen(true)}>
                                            查看提示词库
                                        </Button>
                                        <Button size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => setAssetPickerOpen(true)}>
                                            查看我的素材
                                        </Button>
                                    </div>
                                </div>
                                <div className="relative">
                                    <CanvasResourceMentionTextarea
                                        ref={promptInputRef}
                                        value={prompt}
                                        references={promptReferences}
                                        onChange={setPrompt}
                                        mentionTriggerKey={mentionTriggerKey}
                                        className="thin-scrollbar block min-h-[168px] w-full resize-none rounded-md border border-stone-300 bg-white px-3 py-2 pr-11 text-sm leading-5 text-stone-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:focus:border-blue-400"
                                        placeholder="描述画面主体、风格、构图、光线和用途"
                                    />
                                    <Tooltip title="引用参考图 (@)">
                                        <button
                                            type="button"
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={handleAppendMention}
                                            disabled={!references.length}
                                            className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-md text-sm font-semibold text-stone-400 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-stone-800 dark:hover:text-stone-100"
                                            aria-label="引用参考图"
                                        >
                                            @
                                        </button>
                                    </Tooltip>
                                </div>
                            </div>

                            <div className="min-w-0">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <span className="text-base font-semibold">参考图</span>
                                    <div className="flex gap-2">
                                        <Button size="small" icon={<ClipboardPaste className="size-3.5" />} onClick={() => void addReferencesFromClipboard()}>
                                            剪切板
                                        </Button>
                                        <Button size="small" icon={<Upload className="size-3.5" />} onClick={() => fileInputRef.current?.click()}>
                                            上传
                                        </Button>
                                    </div>
                                </div>
                                <div
                                    className="hover-scrollbar hover-scrollbar-hint flex min-h-24 w-full min-w-0 max-w-full gap-2 overflow-x-scroll overflow-y-hidden rounded-lg border border-dashed border-stone-300 p-2 pb-3 overscroll-x-contain dark:border-stone-700"
                                    onWheel={(event) => {
                                        if (event.currentTarget.scrollWidth <= event.currentTarget.clientWidth) return;
                                        event.preventDefault();
                                        event.currentTarget.scrollLeft += event.deltaY;
                                    }}
                                >
                                    {references.map((item, index) => (
                                        <div key={item.id} className="group relative size-20 shrink-0 overflow-hidden rounded-md border border-stone-200 dark:border-stone-800">
                                            <img src={item.dataUrl} alt={item.name} className="size-full object-cover" />
                                            <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">{imageReferenceLabel(index)}</span>
                                            <ReferenceOrderButtons index={index} total={references.length} onMove={(offset) => setReferences((value) => moveListItem(value, index, offset))} />
                                            <button
                                                type="button"
                                                className="absolute right-1 top-1 hidden size-6 items-center justify-center rounded bg-black/60 text-white group-hover:flex"
                                                onClick={() => setReferences((value) => value.filter((ref) => ref.id !== item.id))}
                                                aria-label="移除参考图"
                                            >
                                                <Trash2 className="size-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    {!references.length ? <div className="flex min-w-full items-center justify-center text-sm text-stone-500">暂无参考图</div> : null}
                                </div>
                            </div>

                            <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm dark:border-stone-800 dark:bg-stone-900 sm:hidden">
                                <span className="truncate text-stone-500 dark:text-stone-400">
                                    {modelOptionLabel(effectiveConfig, model)} · {imageSizeLabel(displayConfig.size)}
                                    {!isStepImageEdit2Config(displayConfig) ? ` · ${displayConfig.quality}` : ""}
                                </span>
                                <Button size="small" type="text" icon={<SlidersHorizontal className="size-4" />} onClick={() => setSettingsOpen(true)}>
                                    调整
                                </Button>
                            </div>

                            <div className="hidden gap-4 sm:grid sm:grid-cols-2">
                                <GenerationSettings config={displayConfig} model={model} updateConfig={updateConfig} openConfigDialog={openConfigDialog} />
                            </div>
                        </div>

                        <div className="mt-auto pt-6">
                            <Button type="primary" size="large" block icon={<Sparkles className="size-4" />} disabled={!canGenerate} onClick={() => void generate()}>
                                {running ? "继续提交新任务" : "开始生成"}
                            </Button>
                        </div>
                    </div>

                    <div className="thin-scrollbar rounded-lg border border-stone-200 bg-card p-4 shadow-sm dark:border-stone-800 lg:min-h-0 lg:overflow-y-auto lg:p-5">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-semibold">生成结果</h2>
                            </div>
                            {running ? <Tag className="m-0 px-2 py-1">等待 {formatDuration(elapsedMs)}</Tag> : null}
                        </div>
                        {results.length ? (
                            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                                {results.map((result, index) =>
                                    result.status === "success" && result.image ? (
                                        <ResultImageCard key={result.id} image={result.image} index={index} onEdit={addResultToReferences} onDownload={downloadImage} onSaveAsset={saveResultToAssets} />
                                    ) : result.status === "failed" ? (
                                        <FailedImageCard key={result.id} error={result.error || "生成失败"} onRetry={() => retryResult(index)} />
                                    ) : (
                                        <PendingImageCard key={result.id} message={result.error} />
                                    ),
                                )}
                            </div>
                        ) : (
                            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 text-center dark:border-stone-700 lg:min-h-[560px]">
                                <ImagePlus className="mb-4 size-11 text-stone-400" />
                                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有生成图片" />
                            </div>
                        )}
                    </div>
                </section>
            </main>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                    void addReferences(event.target.files);
                    event.target.value = "";
                }}
            />
            <Drawer title="生成记录" placement="bottom" size="large" open={logsOpen} onClose={() => setLogsOpen(false)}>
                <LogPanel
                    logs={logs}
                    selectedLogIds={selectedLogIds}
                    activeLogId={previewLog?.id}
                    onSelectedLogIdsChange={setSelectedLogIds}
                    onCreateSession={createSession}
                    onStopSelected={stopSelectedLogs}
                    onDeleteSelected={() => setDeleteConfirmOpen(true)}
                    onPreviewLog={(log) => void previewGenerationLog(log)}
                />
            </Drawer>
            <Drawer title="参数" placement="bottom" size="82vh" open={settingsOpen} onClose={() => setSettingsOpen(false)}>
                <div className="grid grid-cols-2 gap-3 pb-4">
                    <GenerationSettings config={displayConfig} model={model} updateConfig={updateConfig} openConfigDialog={openConfigDialog} />
                </div>
            </Drawer>
            <PromptSelectDialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen} onSelect={setPrompt} />
            <AssetPickerModal open={assetPickerOpen} onInsert={(payload) => void insertPickedAsset(payload)} onClose={() => setAssetPickerOpen(false)} />
            <Modal title="删除生成记录" open={deleteConfirmOpen} onCancel={() => setDeleteConfirmOpen(false)} onOk={deleteSelectedLogs} okText="删除" okButtonProps={{ danger: true }} cancelText="取消">
                确定删除选中的 {selectedLogIds.length} 条生成记录吗？生成中的记录会先停止本地生成再删除。
            </Modal>
        </div>
    );
}

async function persistGeneratedImage(image: GeneratedImage) {
    try {
        if (image.storageKey) {
            const url = await resolveImageUrl(image.storageKey, image.dataUrl);
            return { ...image, dataUrl: url || image.dataUrl };
        }
        const stored = await persistImageUrl(image.dataUrl);
        return { ...image, dataUrl: stored.url, storageKey: stored.storageKey, width: stored.width, height: stored.height, bytes: stored.bytes, mimeType: stored.mimeType };
    } catch {
        return image;
    }
}

async function patchLogImageLocal(logId: string, index: number, localImage: GeneratedImage) {
    try {
        const current = await logStore.getItem<GenerationLog>(logId);
        if (!current) return;
        const images = [...(current.images || [])];
        // 记录里可能只有成功图，按顺序对齐当前槽位
        while (images.length <= index) images.push(localImage);
        images[index] = { ...images[index], ...localImage, dataUrl: localImage.storageKey ? "" : localImage.dataUrl };
        await logStore.setItem(logId, serializeLog({ ...current, images, successCount: images.filter(Boolean).length }));
    } catch {
        // 后台回写失败不影响当前展示
    }
}

async function tryUploadImage(dataUrl: string) {
    try {
        return await uploadImage(dataUrl);
    } catch {
        return null;
    }
}

function GenerationSettings({ config, model, updateConfig, openConfigDialog }: { config: AiConfig; model: string; updateConfig: UpdateAiConfig; openConfigDialog: (shouldPromptContinue?: boolean) => void }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];

    return (
        <>
            <label className="col-span-2 block min-w-0 sm:col-span-1">
                <span className="mb-1.5 block text-sm font-semibold sm:mb-2 sm:text-base">模型</span>
                <ModelPicker config={config} value={model} onChange={(value) => updateConfig("imageModel", value)} capability="image" fullWidth onMissingConfig={() => openConfigDialog(false)} />
            </label>
            <div className="col-span-2">
                <ImageSettingsPanel config={config} onConfigChange={(key, value) => updateConfig(key, value)} theme={theme} showTitle={false} className="space-y-4" maxCount={10} />
            </div>
        </>
    );
}

function ResultImageCard({
    image,
    index,
    onEdit,
    onDownload,
    onSaveAsset,
}: {
    image: GeneratedImage;
    index: number;
    onEdit: (image: GeneratedImage, index: number) => void;
    onDownload: (image: GeneratedImage, index: number) => void;
    onSaveAsset: (image: GeneratedImage, index: number) => void;
}) {
    const [displayUrl, setDisplayUrl] = useState(image.dataUrl || "");

    useEffect(() => {
        let active = true;
        const source = image.dataUrl || "";
        if (source && (source.startsWith("blob:") || source.startsWith("data:") || /^https?:\/\//i.test(source))) {
            setDisplayUrl(proxiedImageDisplayUrl(source));
            return () => {
                active = false;
            };
        }
        void resolveImageUrl(image.storageKey, source).then((url) => {
            if (active && url) setDisplayUrl(proxiedImageDisplayUrl(url));
        });
        return () => {
            active = false;
        };
    }, [image.dataUrl, image.storageKey]);

    return (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-background dark:border-stone-800">
            {displayUrl ? (
                <Image
                    src={displayUrl}
                    alt={`生成结果 ${index + 1}`}
                    className="aspect-square object-cover"
                    onError={() => {
                        void resolveImageUrl(image.storageKey, "").then((url) => {
                            if (url && url !== displayUrl) setDisplayUrl(url);
                        });
                    }}
                />
            ) : (
                <div className="flex aspect-square items-center justify-center bg-stone-50 text-xs text-stone-400 dark:bg-stone-900">加载中</div>
            )}
            <div className="space-y-2 border-t border-stone-200 px-3 py-2.5 dark:border-stone-800">
                <div className="flex min-w-0 gap-x-2 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                    <span>
                        {image.width}x{image.height}
                    </span>
                    <span>{formatBytes(image.bytes)}</span>
                    <span>{formatDuration(image.durationMs)}</span>
                </div>
                <div className="grid min-w-0 grid-cols-3 gap-2">
                    <Tooltip title="添加到素材">
                        <Button className={RESULT_ACTION_BUTTON_CLASS} size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => void onSaveAsset(image, index)}>
                            添加到素材
                        </Button>
                    </Tooltip>
                    <Tooltip title="加入参考图">
                        <Button className={RESULT_ACTION_BUTTON_CLASS} size="small" icon={<PenLine className="size-3.5" />} onClick={() => void onEdit(image, index)}>
                            加入参考图
                        </Button>
                    </Tooltip>
                    <Tooltip title="下载">
                        <Button className={RESULT_ACTION_BUTTON_CLASS} size="small" icon={<Download className="size-3.5" />} onClick={() => onDownload(image, index)}>
                            下载
                        </Button>
                    </Tooltip>
                </div>
            </div>
        </div>
    );
}

function PendingImageCard({ message }: { message?: string }) {
    return (
        <div className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-stone-300 bg-stone-50 dark:border-stone-700 dark:bg-stone-900">
            <div
                className="absolute inset-0 opacity-60"
                style={{
                    backgroundImage: "radial-gradient(circle, rgba(120,113,108,0.35) 1.4px, transparent 1.6px)",
                    backgroundSize: "16px 16px",
                }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-stone-500 dark:text-stone-400">
                <LoaderCircle className="size-6 animate-spin" />
                <span>生成中</span>
                {message ? <span className="max-w-[80%] text-center text-xs text-amber-600 dark:text-amber-300">{message}</span> : null}
            </div>
        </div>
    );
}

function FailedImageCard({ error, onRetry }: { error: string; onRetry: () => void }) {
    return (
        <div className="overflow-hidden rounded-lg border border-red-200 bg-red-50 dark:border-red-950 dark:bg-red-950/20">
            <div className="flex aspect-square flex-col items-center justify-center gap-3 p-5 text-center">
                <div className="text-sm font-medium text-red-600 dark:text-red-300">生成失败</div>
                <Typography.Paragraph ellipsis={{ rows: 4 }} className="!mb-0 !text-xs !text-red-500 dark:!text-red-300">
                    {error}
                </Typography.Paragraph>
            </div>
            <div className="flex justify-end border-t border-red-200 p-3 dark:border-red-950">
                <Button size="small" danger onClick={onRetry}>
                    重试
                </Button>
            </div>
        </div>
    );
}

function updateResultAt(results: GenerationResult[], index: number, next: Partial<GenerationResult>) {
    return results.map((item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item));
}

function buildImagePromptReferences(references: ReferenceImage[]): CanvasResourceReference[] {
    return references.map((image, index) => ({
        id: image.id,
        nodeId: image.id,
        kind: "image",
        label: imageReferenceLabel(index),
        title: image.name || imageReferenceLabel(index),
        previewUrl: image.dataUrl,
        active: true,
    }));
}

function buildImageConfig(config: AiConfig, model: string): AiConfig {
    let nextConfig = {
        ...config,
        model,
        imageModel: model,
    };
    if (isGrokImagineImageConfig(nextConfig)) {
        nextConfig = {
            ...nextConfig,
            quality: normalizeGrokImagineImageResolution(nextConfig.quality),
            size: normalizeGrokImagineImageRatio(nextConfig.size),
        };
    }
    if (isGptImage2StyleConfig(nextConfig)) {
        nextConfig = {
            ...nextConfig,
            quality: normalizeGptImage2Resolution(nextConfig.quality),
            size: normalizeGptImage2Ratio(nextConfig.size),
        };
    }
    if (isStepImageEdit2Config(nextConfig)) {
        nextConfig = {
            ...nextConfig,
            size: normalizeStepImageEdit2Size(nextConfig.size),
        };
    }
    return nextConfig;
}

function LogPanel({
    logs,
    selectedLogIds,
    activeLogId,
    onSelectedLogIdsChange,
    onCreateSession,
    onStopSelected,
    onDeleteSelected,
    onPreviewLog,
}: {
    logs: GenerationLog[];
    selectedLogIds: string[];
    activeLogId?: string;
    onSelectedLogIdsChange: (ids: string[]) => void;
    onCreateSession: () => void;
    onStopSelected: () => void;
    onDeleteSelected: () => void;
    onPreviewLog: (log: GenerationLog) => void;
}) {
    const allSelected = Boolean(logs.length) && selectedLogIds.length === logs.length;
    const hasSelectedRunning = logs.some((log) => selectedLogIds.includes(log.id) && log.status === "生成中");
    const toggleAll = () => onSelectedLogIdsChange(allSelected ? [] : logs.map((log) => log.id));

    return (
        <>
            <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-base font-semibold">生成记录</h2>
                </div>
                <Tag className="m-0">{logs.length}</Tag>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
                <Button size="small" icon={<Plus className="size-3.5" />} onClick={onCreateSession}>
                    新建
                </Button>
                <Button size="small" icon={<CheckSquare className="size-3.5" />} disabled={!logs.length} onClick={toggleAll}>
                    {allSelected ? "取消" : "全选"}
                </Button>
                <Button size="small" icon={<CircleStop className="size-3.5" />} disabled={!hasSelectedRunning} onClick={onStopSelected}>
                    停止
                </Button>
                <Button size="small" danger icon={<Trash2 className="size-3.5" />} disabled={!selectedLogIds.length} onClick={onDeleteSelected}>
                    删除
                </Button>
            </div>
            <div className="space-y-3">
                {logs.map((log) => (
                    <LogCard
                        key={log.id}
                        log={log}
                        selected={selectedLogIds.includes(log.id)}
                        active={activeLogId === log.id}
                        onSelectedChange={(checked) => onSelectedLogIdsChange(checked ? [...selectedLogIds, log.id] : selectedLogIds.filter((id) => id !== log.id))}
                        onClick={() => onPreviewLog(log)}
                    />
                ))}
                {!logs.length ? <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-stone-300 text-center text-sm text-stone-500 dark:border-stone-700">暂无生成记录</div> : null}
            </div>
        </>
    );
}

function LogCard({ log, selected, active, onSelectedChange, onClick }: { log: GenerationLog; selected: boolean; active: boolean; onSelectedChange: (checked: boolean) => void; onClick: () => void }) {
    const [thumbnails, setThumbnails] = useState(() => (log.thumbnails || []).filter(Boolean).slice(0, 4));

    useEffect(() => {
        let active = true;
        const cached = (log.thumbnails || []).filter((url) => url && (url.startsWith("blob:") || url.startsWith("data:") || /^https?:\/\//i.test(url))).slice(0, 4);
        if (cached.length) {
            setThumbnails(cached);
            return () => {
                active = false;
            };
        }
        void Promise.all(
            (log.images || []).slice(0, 4).map(async (image) => {
                const url = await resolveImageUrl(image.storageKey, image.dataUrl);
                if (url && (url.startsWith("blob:") || url.startsWith("data:") || /^https?:\/\//i.test(url))) return url;
                return "";
            }),
        ).then((urls) => {
            if (active) setThumbnails(urls.filter(Boolean));
        });
        return () => {
            active = false;
        };
    }, [log.id, log.images, log.thumbnails]);

    return (
        <button
            type="button"
            className={`block w-full rounded-lg border p-2 text-left transition ${active ? "border-stone-900 bg-blue-50 dark:border-stone-100 dark:bg-blue-950/20" : "border-stone-200 bg-background hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-900"}`}
            onClick={onClick}
        >
            <div className="grid grid-cols-[minmax(128px,1fr)_auto] gap-2">
                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2">
                    <Checkbox className="mt-0.5" checked={selected} onClick={(event) => event.stopPropagation()} onChange={(event) => onSelectedChange(event.target.checked)} />
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold leading-5">{log.title}</div>
                        {thumbnails.length ? (
                            <div className="mt-2 flex gap-1 overflow-hidden">
                                {thumbnails.map((image, index) => (
                                    <img key={`${log.id}-${index}`} src={image} alt="" className="size-8 shrink-0 rounded-md object-cover" />
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
                <div className="grid justify-items-end gap-2">
                    <div className="flex gap-1">
                        <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none" color="blue">
                            成功 {log.successCount ?? log.imageCount}
                        </Tag>
                        {log.failCount ? (
                            <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none" color="red">
                                失败 {log.failCount}
                            </Tag>
                        ) : null}
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                        <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none" color={log.status === "生成中" ? "processing" : log.status === "成功" ? "blue" : "red"}>
                            {log.status}
                        </Tag>
                        <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none">{log.imageCount} 张</Tag>
                        <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none" color="green">
                            {formatDuration(log.durationMs)}
                        </Tag>
                    </div>
                    <div className="flex justify-end">
                        <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none">{log.time}</Tag>
                    </div>
                </div>
            </div>
        </button>
    );
}

async function readStoredLogs() {
    if (typeof window === "undefined") return [];
    try {
        const values: GenerationLog[] = [];
        await logStore.iterate<GenerationLog, void>((value) => {
            values.push(value);
        });
        const logs = await Promise.all(values.map((log) => normalizeLog(log, false)));
        return logs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch {
        return [];
    }
}

async function normalizeLog(log: Partial<GenerationLog>, hydrateMedia = true): Promise<GenerationLog> {
    const references = hydrateMedia
        ? await Promise.all(
              (log.references || []).map(async (item) => ({
                  ...item,
                  dataUrl: await resolveImageUrl(item.storageKey, item.dataUrl),
              })),
          )
        : log.references || [];
    const images = hydrateMedia
        ? await Promise.all(
              (log.images || []).map(async (item) => ({
                  ...item,
                  dataUrl: await resolveImageUrl(item.storageKey, item.dataUrl),
              })),
          )
        : log.images || [];
    const config = normalizeLogConfig(log);
    return {
        id: log.id || nanoid(),
        createdAt: log.createdAt || Date.now(),
        title: log.title || log.model || "未命名",
        prompt: log.prompt || log.title || "",
        time: log.time || new Date().toLocaleString("zh-CN", { hour12: false }),
        model: log.model || config.imageModel || "",
        config,
        references,
        durationMs: log.durationMs || 0,
        successCount: log.successCount ?? log.imageCount ?? 0,
        failCount: log.failCount || 0,
        imageCount: log.imageCount || log.successCount || 0,
        size: log.size || config.size || "",
        quality: log.quality || config.quality || "",
        status: log.status || "成功",
        images,
        thumbnails: hydrateMedia ? images.map((image) => image.dataUrl).filter(Boolean) : (log.thumbnails || images.map((image) => image.dataUrl)).filter(Boolean),
        error: log.error,
    };
}

function logToResults(log: GenerationLog): GenerationResult[] {
    const results = log.images.map((image) => ({ id: image.id, status: "success" as const, image }));
    const missingCount = Math.max(0, (Number(log.config.count) || log.imageCount || results.length) - results.length - log.failCount);
    const pending = Array.from({ length: missingCount }, () => ({ id: nanoid(), status: "pending" as const, error: log.error }));
    const failed = Array.from({ length: log.failCount }, () => ({ id: nanoid(), status: "failed" as const, error: log.error || "生成失败" }));
    return [...results, ...pending, ...failed];
}

function serializeLog(log: GenerationLog): GenerationLog {
    return {
        ...log,
        references: log.references.map((item) => ({ ...item, dataUrl: item.storageKey ? "" : item.dataUrl.startsWith("blob:") ? "" : item.dataUrl })),
        // 只持久化 storageKey / 可长期访问的 URL，避免 blob: 写入后失效导致缩略图空白
        images: log.images.map((image) => ({
            ...image,
            dataUrl: image.storageKey ? "" : image.dataUrl.startsWith("blob:") ? "" : /^https?:\/\//i.test(image.dataUrl) || image.dataUrl.startsWith("data:") ? image.dataUrl : "",
        })),
        thumbnails: [],
    };
}

function normalizeLogConfig(log: Partial<GenerationLog>): GenerationLogConfig {
    return {
        model: log.config?.model || log.model || "",
        imageModel: log.config?.imageModel || log.model || "",
        quality: log.config?.quality || log.quality || "",
        size: log.config?.size || log.size || "",
        count: log.config?.count || String(log.imageCount || log.successCount || 1),
    };
}

function moveListItem<T>(items: T[], index: number, offset: number) {
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= items.length) return items;
    const next = [...items];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    return next;
}

function ReferenceOrderButtons({ index, total, onMove }: { index: number; total: number; onMove: (offset: number) => void }) {
    if (total <= 1) return null;
    return (
        <div className="absolute inset-x-1 bottom-1 flex justify-between">
            <Button size="small" className="!h-6 !w-6 !min-w-6 !rounded-full !bg-white/85 !p-0 !shadow-sm" icon={<ArrowLeft className="size-3" />} disabled={index <= 0} onClick={() => onMove(-1)} />
            <Button size="small" className="!h-6 !w-6 !min-w-6 !rounded-full !bg-white/85 !p-0 !shadow-sm" icon={<ArrowRight className="size-3" />} disabled={index >= total - 1} onClick={() => onMove(1)} />
        </div>
    );
}

function buildLog({
    prompt,
    model,
    config,
    references,
    durationMs,
    successCount,
    failCount,
    status,
    images,
    error,
}: {
    prompt: string;
    model: string;
    config: GenerationLogConfig;
    references: ReferenceImage[];
    durationMs: number;
    successCount: number;
    failCount: number;
    status: GenerationLog["status"];
    images: GeneratedImage[];
    error?: string;
}): GenerationLog {
    const logConfig = {
        model: config.model,
        imageModel: config.imageModel,
        quality: config.quality,
        size: config.size,
        count: config.count,
    };
    return {
        id: nanoid(),
        createdAt: Date.now(),
        title: prompt.slice(0, 12) || "未命名",
        prompt,
        time: new Date().toLocaleString("zh-CN", { hour12: false }),
        model,
        config: logConfig,
        references,
        durationMs,
        successCount,
        failCount,
        imageCount: Number(logConfig.count) || successCount,
        size: logConfig.size,
        quality: logConfig.quality,
        status,
        images,
        thumbnails: images.map((image) => image.dataUrl).filter(Boolean),
        error,
    };
}
