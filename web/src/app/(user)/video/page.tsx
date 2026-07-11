import { ArrowLeft, ArrowRight, BookOpen, CheckSquare, CircleStop, ClipboardPaste, Download, FolderPlus, History, LoaderCircle, Music2, Plus, SlidersHorizontal, Sparkles, Trash2, Upload, VideoIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { App, Button, Checkbox, Drawer, Empty, Modal, Tag, Tooltip, Typography } from "antd";
import localforage from "localforage";
import { nanoid } from "nanoid";
import { saveAs } from "file-saver";

import { AssetPickerModal, type InsertAssetPayload } from "@/app/(user)/canvas/components/asset-picker-modal";
import { CanvasResourceMentionTextarea } from "@/app/(user)/canvas/components/canvas-resource-mention-textarea";
import { ModelPicker } from "@/components/model-picker";
import { PromptSelectDialog } from "@/components/prompts/prompt-select-dialog";
import { VideoSettingsPanel, normalizeVideoResolutionValue, normalizeVideoSizeValue, videoSizeLabel } from "@/components/video-settings-panel";
import { canvasThemes } from "@/lib/canvas-theme";
import { formatBytes, formatDuration } from "@/lib/image-utils";
import { boolConfig, isSeedanceVideoConfig, normalizeSeedanceRatio, seedanceReferenceLabel, seedanceVideoReferenceError, seedanceVideoReferenceHint, SEEDANCE_REFERENCE_LIMITS } from "@/lib/seedance-video";
import { deleteStoredMedia, resolveMediaUrl, uploadMediaFile } from "@/services/file-storage";
import { resolveImageUrl, uploadImage } from "@/services/image-storage";
import { createVideoGenerationTask, pollVideoGenerationTask, storeGeneratedVideo, type VideoGenerationTask } from "@/services/api/video";
import { useAssetStore } from "@/stores/use-asset-store";
import { modelOptionLabel, useConfigStore, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio, ReferenceVideo } from "@/types/media";
import type { CanvasResourceReference } from "@/app/(user)/canvas/utils/canvas-resource-references";
import { isGrokImagineVideoModel, normalizeGrokImagineVideoRatio, normalizeGrokImagineVideoResolution } from "@/lib/grok-imagine";

type GeneratedVideo = {
    id: string;
    url: string;
    storageKey: string;
    thumbnailUrl?: string;
    thumbnailStorageKey?: string;
    durationMs: number;
    width: number;
    height: number;
    bytes: number;
    mimeType: string;
};

type GenerationResult = {
    id: string;
    status: "pending" | "success" | "failed";
    video?: GeneratedVideo;
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
    videoReferences: ReferenceVideo[];
    audioReferences: ReferenceAudio[];
    durationMs: number;
    size: string;
    resolution: string;
    seconds: string;
    status: "生成中" | "成功" | "失败";
    task?: VideoGenerationTask;
    video?: GeneratedVideo;
    error?: string;
};

type GenerationLogConfig = Pick<AiConfig, "model" | "videoModel" | "size" | "vquality" | "videoSeconds" | "videoGenerateAudio" | "videoWatermark">;

type UpdateAiConfig = <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void;

const LOG_STORE_KEY = "infinite-canvas:video_generation_logs";
const VIDEO_POLL_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_CONSECUTIVE_POLL_ERRORS = 6;
const logStore = localforage.createInstance({ name: "infinite-canvas", storeName: "video_generation_logs" });

export default function VideoPage() {
    const { message } = App.useApp();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const promptInputRef = useRef<HTMLTextAreaElement>(null);
    const activeLogIdsRef = useRef<Set<string>>(new Set());
    const pollAbortControllersRef = useRef<Map<string, AbortController>>(new Map());
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
    const [videoReferences, setVideoReferences] = useState<ReferenceVideo[]>([]);
    const [audioReferences, setAudioReferences] = useState<ReferenceAudio[]>([]);
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
    const [referenceUploading, setReferenceUploading] = useState(false);
    const [referenceUploadLabel, setReferenceUploadLabel] = useState("");

    const model = effectiveConfig.videoModel || effectiveConfig.model;
    const displayConfig = buildVideoConfig(effectiveConfig, model);
    const canGenerate = Boolean(prompt.trim());
    const running = runningCount > 0;
    const promptReferences = buildVideoPromptReferences(references, videoReferences, audioReferences);

    useEffect(() => {
        if (!running || !startedAt) return;
        const timer = window.setInterval(() => setElapsedMs(performance.now() - startedAt), 1000);
        return () => window.clearInterval(timer);
    }, [running, startedAt]);

    useEffect(() => {
        void refreshLogs();
    }, []);

    useEffect(() => {
        const resume = () => {
            if (document.visibilityState === "visible") void refreshLogs();
        };
        window.addEventListener("online", resume);
        document.addEventListener("visibilitychange", resume);
        return () => {
            window.removeEventListener("online", resume);
            document.removeEventListener("visibilitychange", resume);
        };
    }, []);

    const addReferences = async (files?: FileList | null) => {
        const selectedFiles = Array.from(files || []);
        const unsupported = selectedFiles.filter((file) => !file.type.startsWith("image/") && !file.type.startsWith("video/") && !isSupportedAudioFile(file));
        if (unsupported.length) message.warning("已忽略不支持的参考素材，请使用图片、mp4/mov 视频或 mp3/wav 音频");
        const imageFiles = selectedFiles.filter((file) => file.type.startsWith("image/") && file.size <= SEEDANCE_REFERENCE_LIMITS.imageMaxBytes).slice(0, SEEDANCE_REFERENCE_LIMITS.images - references.length);
        const videoFiles = selectedFiles.filter((file) => file.type.startsWith("video/") && file.size <= SEEDANCE_REFERENCE_LIMITS.videoMaxBytes).slice(0, SEEDANCE_REFERENCE_LIMITS.videos - videoReferences.length);
        const audioFiles = selectedFiles.filter((file) => isSupportedAudioFile(file) && file.size <= SEEDANCE_REFERENCE_LIMITS.audioMaxBytes).slice(0, SEEDANCE_REFERENCE_LIMITS.audios - audioReferences.length);
        if (selectedFiles.some((file) => file.type.startsWith("image/") && file.size > SEEDANCE_REFERENCE_LIMITS.imageMaxBytes)) message.warning("已忽略超过 30MB 的参考图");
        if (selectedFiles.some((file) => file.type.startsWith("video/") && file.size > SEEDANCE_REFERENCE_LIMITS.videoMaxBytes)) message.warning("已忽略超过 50MB 的参考视频");
        if (selectedFiles.some((file) => isSupportedAudioFile(file) && file.size > SEEDANCE_REFERENCE_LIMITS.audioMaxBytes)) message.warning("已忽略超过 15MB 的参考音频");
        setReferenceUploading(true);
        setReferenceUploadLabel("正在上传参考素材");
        try {
            if (imageFiles.length) setReferenceUploadLabel(`正在上传 ${imageFiles.length} 张参考图`);
            const nextReferences = await Promise.all(
                imageFiles.map(async (file) => {
                    const image = await uploadImage(file);
                    return { id: nanoid(), name: file.name, type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
                }),
            );
            if (videoFiles.length) setReferenceUploadLabel(`正在上传 ${videoFiles.length} 个参考视频`);
            const nextVideoReferences = await Promise.all(
                videoFiles.map(async (file) => {
                    const video = await uploadMediaFile(file, "video-reference");
                    return { id: nanoid(), name: file.name, type: video.mimeType, url: video.url, storageKey: video.storageKey, bytes: video.bytes, width: video.width, height: video.height, durationMs: video.durationMs };
                }),
            );
            if (audioFiles.length) setReferenceUploadLabel(`正在上传 ${audioFiles.length} 段参考音频`);
            const nextAudioReferences = filterAudioReferencesByDuration(
                audioReferences,
                await Promise.all(
                    audioFiles.map(async (file) => {
                        const audio = await uploadMediaFile(file, "audio-reference");
                        return { id: nanoid(), name: file.name, type: audio.mimeType, url: audio.url, storageKey: audio.storageKey, durationMs: audio.durationMs };
                    }),
                ),
                message.warning,
            );
            setReferences((value) => [...value, ...nextReferences].slice(0, SEEDANCE_REFERENCE_LIMITS.images));
            setVideoReferences((value) => [...value, ...nextVideoReferences].slice(0, SEEDANCE_REFERENCE_LIMITS.videos));
            setAudioReferences((value) => [...value, ...nextAudioReferences].slice(0, SEEDANCE_REFERENCE_LIMITS.audios));
        } finally {
            setReferenceUploading(false);
            setReferenceUploadLabel("");
        }
    };

    const addReferencesFromClipboard = async () => {
        setReferenceUploading(true);
        setReferenceUploadLabel("正在读取剪切板参考图");
        try {
            const items = await navigator.clipboard.read();
            const blobs = await Promise.all(items.flatMap((item) => item.types.filter((type) => type.startsWith("image/")).map((type) => item.getType(type))));
            if (!blobs.length) {
                message.error("剪切板里没有可读取的图片");
                return;
            }
            const nextReferences = await Promise.all(
                blobs.slice(0, SEEDANCE_REFERENCE_LIMITS.images - references.length).map(async (blob, index) => {
                    const image = await uploadImage(blob);
                    return { id: nanoid(), name: `clipboard-${index + 1}.png`, type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
                }),
            );
            setReferences((value) => [...value, ...nextReferences].slice(0, SEEDANCE_REFERENCE_LIMITS.images));
            message.success(`已读取 ${nextReferences.length} 张参考图`);
        } catch {
            message.error("剪切板里没有可读取的图片");
        } finally {
            setReferenceUploading(false);
            setReferenceUploadLabel("");
        }
    };
    const generate = async () => {
        const snapshot = buildRequestSnapshot();
        if (!snapshot) return;
        setElapsedMs(0);
        setPreviewLog(null);
        setResults([{ id: nanoid(), status: "pending" }]);
        const batchStartedAt = performance.now();
        setStartedAt(batchStartedAt);
        try {
            const task = await createVideoGenerationTask(snapshot.config, snapshot.text, snapshot.references, snapshot.videoReferences, snapshot.audioReferences);
            const log = buildLog({ prompt: snapshot.text, model, config: snapshot.config, references: snapshot.references, videoReferences: snapshot.videoReferences, audioReferences: snapshot.audioReferences, durationMs: 0, status: "生成中", task });
            await saveLog(log);
            void pollGenerationLog(log, snapshot.config);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "生成失败";
            setResults([{ id: nanoid(), status: "failed", error: errorMessage }]);
            await saveLog(buildLog({ prompt: snapshot.text, model, config: snapshot.config, references: snapshot.references, videoReferences: snapshot.videoReferences, audioReferences: snapshot.audioReferences, durationMs: performance.now() - batchStartedAt, status: "失败", error: errorMessage }));
            message.error(errorMessage);
            if (!activeLogIdsRef.current.size) setStartedAt(0);
        }
    };

    const buildRequestSnapshot = () => {
        const text = prompt.trim();
        if (!text) {
            message.error("请输入视频提示词");
            return null;
        }
        if (!isAiConfigReady(effectiveConfig, model)) {
            message.warning("请先完成配置");
            openConfigDialog(true);
            return null;
        }
        const videoReferenceError = seedanceVideoReferenceError(videoReferences);
        if (videoReferenceError) {
            message.error(`${videoReferenceError}。${seedanceVideoReferenceHint}`);
            return null;
        }
        return { text, config: buildVideoConfig(effectiveConfig, model), references: [...references], videoReferences: [...videoReferences], audioReferences: [...audioReferences] };
    };

    const retryResult = () => {
        void generate();
    };

    const downloadVideo = (video: GeneratedVideo) => {
        saveAs(video.url, "video.mp4");
    };

    const saveResultToAssets = (video: GeneratedVideo) => {
        addAsset({
            kind: "video",
            title: "生成视频",
            coverUrl: video.thumbnailUrl || "",
            tags: [],
            source: "视频创作台",
            data: { url: video.url, storageKey: video.storageKey, width: video.width, height: video.height, bytes: video.bytes, mimeType: video.mimeType },
            metadata: { source: "video-page", prompt, thumbnailStorageKey: video.thumbnailStorageKey },
        });
        message.success("已加入我的素材");
    };

    const insertPickedAsset = async (payload: InsertAssetPayload) => {
        if (payload.kind === "text") {
            setPrompt(payload.content);
        } else if (payload.kind === "image") {
            setReferenceUploading(true);
            setReferenceUploadLabel("正在加入参考图");
            try {
                const stored = await uploadImage(payload.dataUrl);
                setReferences((value) => [...value, { id: nanoid(), name: payload.title, type: stored.mimeType, dataUrl: stored.url, storageKey: stored.storageKey }].slice(0, SEEDANCE_REFERENCE_LIMITS.images));
            } finally {
                setReferenceUploading(false);
                setReferenceUploadLabel("");
            }
        } else if (payload.kind === "video") {
            setReferenceUploading(true);
            setReferenceUploadLabel("正在加入参考视频");
            try {
                setVideoReferences((value) => [...value, { id: nanoid(), name: payload.title, type: "video/mp4", url: payload.url, storageKey: payload.storageKey, width: payload.width, height: payload.height }].slice(0, SEEDANCE_REFERENCE_LIMITS.videos));
            } finally {
                setReferenceUploading(false);
                setReferenceUploadLabel("");
            }
        }
        setAssetPickerOpen(false);
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

    const createSession = () => {
        setPrompt("");
        setReferences([]);
        setVideoReferences([]);
        setAudioReferences([]);
        setResults([]);
        setElapsedMs(0);
        setStartedAt(0);
        setSelectedLogIds([]);
        setPreviewLog(null);
    };

    const stopLogPolling = (id: string) => {
        stoppedLogIdsRef.current.add(id);
        pollAbortControllersRef.current.get(id)?.abort();
    };

    const stopSelectedLogs = () => {
        const stoppedLogs = logs.filter((log) => selectedLogIds.includes(log.id) && log.status === "生成中");
        if (!stoppedLogs.length) return;
        stoppedLogs.forEach((log) => stopLogPolling(log.id));
        void Promise.all(
            stoppedLogs.map((log) =>
                logStore.setItem(
                    log.id,
                    serializeLog({
                        ...log,
                        status: "失败",
                        durationMs: Date.now() - log.createdAt,
                        error: "已停止本地轮询",
                    }),
                ),
            ),
        ).then(async () => {
            await refreshLogs();
            if (previewLog && stoppedLogs.some((log) => log.id === previewLog.id)) setResults([{ id: previewLog.id, status: "failed", error: "已停止本地轮询" }]);
            message.success(`已停止 ${stoppedLogs.length} 条生成任务`);
        });
    };

    const deleteSelectedLogs = () => {
        const deletingIds = [...selectedLogIds];
        deletingIds.forEach((id) => {
            deletedLogIdsRef.current.add(id);
            stopLogPolling(id);
        });
        const mediaKeys = logs
            .filter((log) => deletingIds.includes(log.id))
            .flatMap((log) => [log.video?.storageKey, log.video?.thumbnailStorageKey])
            .filter((key): key is string => Boolean(key));
        void Promise.all([deleteStoredMedia(mediaKeys), ...deletingIds.map((id) => logStore.removeItem(id))]).then(refreshLogs);
        if (previewLog && deletingIds.includes(previewLog.id)) {
            setPreviewLog(null);
            setResults([]);
        }
        setSelectedLogIds([]);
        setDeleteConfirmOpen(false);
    };

    const saveLog = async (log: GenerationLog) => {
        await logStore.setItem(log.id, serializeLog(log));
        await refreshLogs();
    };

    const refreshLogs = async () => {
        const nextLogs = await readStoredLogs();
        setLogs(nextLogs);
        resumePendingLogs(nextLogs);
        return nextLogs;
    };

    const resumePendingLogs = (items: GenerationLog[]) => {
        for (const log of items) {
            if (log.status === "生成中" && log.task && !deletedLogIdsRef.current.has(log.id) && !stoppedLogIdsRef.current.has(log.id)) void pollGenerationLog(log);
        }
    };

    const pollGenerationLog = async (log: GenerationLog, configOverride?: AiConfig) => {
        if (!log.task || activeLogIdsRef.current.has(log.id) || deletedLogIdsRef.current.has(log.id) || stoppedLogIdsRef.current.has(log.id)) return;
        const abortController = new AbortController();
        pollAbortControllersRef.current.set(log.id, abortController);
        activeLogIdsRef.current.add(log.id);
        setRunningCount((value) => value + 1);
        setStartedAt((value) => value || performance.now());
        setResults((value) => (value.length ? value : [{ id: log.id, status: "pending" }]));
        const taskConfig = buildVideoConfig({ ...effectiveConfig, ...log.config }, log.task.model || log.model);
        let latestLog = log;
        let consecutiveErrors = 0;
        const baseDelay = log.task.provider === "seedance" ? 5000 : 2500;
        const maxAttempts = Math.ceil(VIDEO_POLL_TIMEOUT_MS / baseDelay);
        try {
            for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
                if (deletedLogIdsRef.current.has(log.id)) return;
                if (stoppedLogIdsRef.current.has(log.id) || abortController.signal.aborted) throw new DOMException("Aborted", "AbortError");
                let state: Awaited<ReturnType<typeof pollVideoGenerationTask>>;
                try {
                    state = await pollVideoGenerationTask(configOverride || taskConfig, log.task, { signal: abortController.signal });
                    consecutiveErrors = 0;
                } catch (error) {
                    if (deletedLogIdsRef.current.has(log.id)) return;
                    if (stoppedLogIdsRef.current.has(log.id) || abortController.signal.aborted) throw error;
                    consecutiveErrors += 1;
                    const errorMessage = error instanceof Error ? error.message : "网络异常，任务查询失败";
                    latestLog = { ...latestLog, status: "生成中", durationMs: Date.now() - latestLog.createdAt, error: `轮询暂时中断：${errorMessage}` };
                    setResults([{ id: latestLog.id, status: "pending", error: latestLog.error }]);
                    await saveLog(latestLog);
                    if (consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
                        message.warning("网络中断，视频任务已保留为生成中，稍后打开页面会继续查询");
                        return;
                    }
                    await delay(Math.min(baseDelay * consecutiveErrors, 30000), abortController.signal);
                    continue;
                }
                if (deletedLogIdsRef.current.has(log.id)) return;
                if (state.status === "completed") {
                    const stored = await storeGeneratedVideo(state.result);
                    const thumbnail = await createStoredVideoThumbnail(stored.url);
                    const nextVideo: GeneratedVideo = {
                        id: nanoid(),
                        url: stored.url,
                        storageKey: stored.storageKey,
                        thumbnailUrl: thumbnail?.url,
                        thumbnailStorageKey: thumbnail?.storageKey,
                        durationMs: Date.now() - latestLog.createdAt,
                        width: stored.width || 1280,
                        height: stored.height || 720,
                        bytes: stored.bytes,
                        mimeType: stored.mimeType,
                    };
                    setResults([{ id: nextVideo.id, status: "success", video: nextVideo }]);
                    await saveLog({ ...latestLog, status: "成功", durationMs: nextVideo.durationMs, video: nextVideo, error: undefined });
                    message.success("视频已生成");
                    return;
                }
                if (state.status === "failed") throw new Error(state.error);
                if (attempt === maxAttempts - 1) {
                    latestLog = { ...latestLog, status: "生成中", durationMs: Date.now() - latestLog.createdAt, error: "任务仍在生成中，稍后打开页面会继续查询" };
                    setResults([{ id: latestLog.id, status: "pending", error: latestLog.error }]);
                    await saveLog(latestLog);
                    message.warning("视频任务耗时较长，已保留为生成中");
                    return;
                }
                await delay(baseDelay, abortController.signal);
            }
        } catch (error) {
            if (deletedLogIdsRef.current.has(log.id)) return;
            const stopped = stoppedLogIdsRef.current.has(log.id) || abortController.signal.aborted;
            const errorMessage = stopped ? "已停止本地轮询" : error instanceof Error ? error.message : "生成失败";
            setResults([{ id: latestLog.id, status: "failed", error: errorMessage }]);
            await saveLog({ ...latestLog, status: "失败", durationMs: Date.now() - latestLog.createdAt, error: errorMessage });
            if (!stopped) message.error(errorMessage);
        } finally {
            pollAbortControllersRef.current.delete(log.id);
            stoppedLogIdsRef.current.delete(log.id);
            activeLogIdsRef.current.delete(log.id);
            setRunningCount((value) => Math.max(0, value - 1));
            if (!activeLogIdsRef.current.size) {
                setStartedAt(0);
            }
        }
    };

    const previewGenerationLog = (log: GenerationLog) => {
        setPreviewLog(log);
        setLogsOpen(false);
        setPrompt(log.prompt);
        setReferences(log.references || []);
        setVideoReferences(log.videoReferences || []);
        setAudioReferences(log.audioReferences || []);
        if (log.config.videoModel || log.model) updateConfig("videoModel", log.config.videoModel || log.model);
        if (log.config.size) updateConfig("size", log.config.size);
        if (log.config.vquality) updateConfig("vquality", log.config.vquality);
        if (log.config.videoSeconds) updateConfig("videoSeconds", log.config.videoSeconds);
        if (log.config.videoGenerateAudio) updateConfig("videoGenerateAudio", log.config.videoGenerateAudio);
        if (log.config.videoWatermark) updateConfig("videoWatermark", log.config.videoWatermark);
        setResults(log.status === "生成中" ? [{ id: log.id, status: "pending" }] : log.video ? [{ id: log.video.id, status: "success", video: log.video }] : [{ id: log.id, status: "failed", error: log.error || "生成失败" }]);
        if (log.status === "生成中" && log.task) void pollGenerationLog(log);
    };

    return (
        <div className="flex h-full flex-col overflow-hidden bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
            <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[300px_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[320px_minmax(0,1fr)]">
                <aside className="thin-scrollbar hidden min-h-0 overflow-y-auto rounded-lg border border-stone-200 bg-card p-4 shadow-sm dark:border-stone-800 lg:block">
                    <LogPanel logs={logs} selectedLogIds={selectedLogIds} activeLogId={previewLog?.id} onSelectedLogIdsChange={setSelectedLogIds} onCreateSession={createSession} onStopSelected={stopSelectedLogs} onDeleteSelected={() => setDeleteConfirmOpen(true)} onPreviewLog={previewGenerationLog} />
                </aside>

                <section className="grid gap-3 lg:min-h-0 lg:overflow-hidden xl:grid-cols-[420px_minmax(0,1fr)]">
                    <div className="thin-scrollbar flex flex-col rounded-lg border border-stone-200 bg-card p-4 shadow-sm dark:border-stone-800 lg:min-h-0 lg:overflow-y-auto">
                        <div className="flex items-start justify-between gap-3">
                            <h1 className="text-2xl font-semibold text-stone-950 dark:text-stone-100">视频创作台</h1>
                            <div className="flex shrink-0 gap-2 lg:hidden">
                                <Button icon={<History className="size-4" />} onClick={() => setLogsOpen(true)}>
                                    记录
                                </Button>
                                <Button icon={<SlidersHorizontal className="size-4" />} onClick={() => setSettingsOpen(true)}>
                                    参数
                                </Button>
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
                                        placeholder="描述镜头运动、主体动作、场景氛围和画面风格"
                                    />
                                    <Tooltip title="引用参考素材 (@)">
                                        <button
                                            type="button"
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={handleAppendMention}
                                            disabled={!promptReferences.length}
                                            className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-md text-sm font-semibold text-stone-400 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-stone-800 dark:hover:text-stone-100"
                                            aria-label="引用参考素材"
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
                                        <Button size="small" icon={<ClipboardPaste className="size-3.5" />} loading={referenceUploading} disabled={referenceUploading} onClick={() => void addReferencesFromClipboard()}>
                                            剪切板
                                        </Button>
                                        <Button size="small" icon={<Upload className="size-3.5" />} loading={referenceUploading} disabled={referenceUploading} onClick={() => fileInputRef.current?.click()}>
                                            上传
                                        </Button>
                                    </div>
                                </div>
                                <div className="hover-scrollbar hover-scrollbar-hint flex min-h-24 w-full min-w-0 max-w-full gap-2 overflow-x-scroll overflow-y-hidden rounded-lg border border-dashed border-stone-300 p-2 pb-3 overscroll-x-contain dark:border-stone-700">
                                    {references.map((item, index) => (
                                        <div key={item.id} className="group relative size-20 shrink-0 overflow-hidden rounded-md border border-stone-200 dark:border-stone-800">
                                            <img src={item.dataUrl} alt={item.name} className="size-full object-cover" />
                                            <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">{seedanceReferenceLabel("image", index)}</span>
                                            <ReferenceOrderButtons index={index} total={references.length} onMove={(offset) => setReferences((value) => moveListItem(value, index, offset))} />
                                            <button type="button" className="absolute right-1 top-1 hidden size-6 items-center justify-center rounded bg-black/60 text-white group-hover:flex" onClick={() => setReferences((value) => value.filter((ref) => ref.id !== item.id))} aria-label="移除参考图">
                                                <Trash2 className="size-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    {!references.length ? <div className="flex min-w-full items-center justify-center text-sm text-stone-500">暂无参考图，最多 9 张</div> : null}
                                </div>
                            </div>

                            <div className="min-w-0">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <span className="text-base font-semibold">参考视频</span>
                                    <Button size="small" icon={<Upload className="size-3.5" />} loading={referenceUploading} disabled={referenceUploading} onClick={() => fileInputRef.current?.click()}>
                                        上传
                                    </Button>
                                </div>
                                <div className="hover-scrollbar hover-scrollbar-hint flex min-h-24 w-full min-w-0 max-w-full gap-2 overflow-x-scroll overflow-y-hidden rounded-lg border border-dashed border-stone-300 p-2 pb-3 overscroll-x-contain dark:border-stone-700">
                                    {videoReferences.map((item, index) => (
                                        <div key={item.id} className="group relative h-20 w-32 shrink-0 overflow-hidden rounded-md border border-stone-200 bg-black dark:border-stone-800">
                                            <video src={item.url} className="size-full object-cover" muted preload="metadata" />
                                            <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">{seedanceReferenceLabel("video", index)}</span>
                                            <ReferenceOrderButtons index={index} total={videoReferences.length} onMove={(offset) => setVideoReferences((value) => moveListItem(value, index, offset))} />
                                            <button type="button" className="absolute right-1 top-1 hidden size-6 items-center justify-center rounded bg-black/60 text-white group-hover:flex" onClick={() => setVideoReferences((value) => value.filter((ref) => ref.id !== item.id))} aria-label="移除参考视频">
                                                <Trash2 className="size-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    {!videoReferences.length ? <div className="flex min-w-full items-center justify-center text-sm text-stone-500">暂无参考视频，最多 3 个</div> : null}
                                </div>
                            </div>

                            <div className="min-w-0">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <span className="text-base font-semibold">参考音频</span>
                                    <Button size="small" icon={<Upload className="size-3.5" />} loading={referenceUploading} disabled={referenceUploading} onClick={() => fileInputRef.current?.click()}>
                                        上传
                                    </Button>
                                </div>
                                <div className="hover-scrollbar hover-scrollbar-hint flex min-h-24 w-full min-w-0 max-w-full gap-2 overflow-x-scroll overflow-y-hidden rounded-lg border border-dashed border-stone-300 p-2 pb-3 overscroll-x-contain dark:border-stone-700">
                                    {audioReferences.map((item, index) => (
                                        <div key={item.id} className="group relative flex h-20 w-48 shrink-0 flex-col justify-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-2 dark:border-stone-800 dark:bg-stone-900">
                                            <div className="flex min-w-0 items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                                                <Music2 className="size-4 shrink-0" />
                                                <span className="shrink-0 rounded bg-stone-200 px-1 text-[10px] text-stone-700 dark:bg-stone-800 dark:text-stone-200">{seedanceReferenceLabel("audio", index)}</span>
                                                <span className="truncate">{item.name}</span>
                                            </div>
                                            <audio src={item.url} controls className="h-8 w-full" preload="metadata" />
                                            <ReferenceOrderButtons index={index} total={audioReferences.length} onMove={(offset) => setAudioReferences((value) => moveListItem(value, index, offset))} />
                                            <button type="button" className="absolute right-1 top-1 hidden size-6 items-center justify-center rounded bg-black/60 text-white group-hover:flex" onClick={() => setAudioReferences((value) => value.filter((ref) => ref.id !== item.id))} aria-label="移除参考音频">
                                                <Trash2 className="size-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    {!audioReferences.length ? <div className="flex min-w-full items-center justify-center text-center text-sm text-stone-500">暂无参考音频，最多 3 个，mp3/wav，单个 15MB 内</div> : null}
                                </div>
                            </div>

                            <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm dark:border-stone-800 dark:bg-stone-900 sm:hidden">
                                <span className="truncate text-stone-500 dark:text-stone-400">
                                    {modelOptionLabel(effectiveConfig, model)} · {normalizeResolution(displayConfig.vquality)}p · {videoSizeLabel(displayConfig.size)} · {normalizeVideoSeconds(displayConfig.videoSeconds)}s
                                </span>
                                <Button size="small" type="text" icon={<SlidersHorizontal className="size-4" />} onClick={() => setSettingsOpen(true)}>
                                    调整
                                </Button>
                            </div>

                            <div className="hidden gap-4 sm:grid sm:grid-cols-2">
                                <GenerationSettings config={effectiveConfig} model={model} updateConfig={updateConfig} openConfigDialog={openConfigDialog} />
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
                            <h2 className="text-xl font-semibold">生成结果</h2>
                            {running ? <Tag className="m-0 px-2 py-1">等待 {formatDuration(elapsedMs)}</Tag> : null}
                        </div>
                        {results.length ? (
                            <div className="grid gap-4">
                                {referenceUploading ? (
                                    <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                                        <LoaderCircle className="size-3.5 animate-spin" />
                                        <span>{referenceUploadLabel || "正在上传参考素材"}</span>
                                    </div>
                                ) : null}
                                {results.map((result) => (result.status === "success" && result.video ? <ResultVideoCard key={result.id} video={result.video} onDownload={downloadVideo} onSaveAsset={saveResultToAssets} /> : result.status === "failed" ? <FailedVideoCard key={result.id} error={result.error || "生成失败"} onRetry={retryResult} /> : <PendingVideoCard key={result.id} message={result.error} />))}
                            </div>
                        ) : (
                            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 text-center dark:border-stone-700 lg:min-h-[560px]">
                                <VideoIcon className="mb-4 size-11 text-stone-400" />
                                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有生成视频" />
                            </div>
                        )}
                    </div>
                </section>
            </main>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/mp4,video/quicktime,audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav"
                multiple
                className="hidden"
                onChange={(event) => {
                    void addReferences(event.target.files);
                    event.target.value = "";
                }}
            />
            <Drawer title="生成记录" placement="bottom" size="large" open={logsOpen} onClose={() => setLogsOpen(false)}>
                <LogPanel logs={logs} selectedLogIds={selectedLogIds} activeLogId={previewLog?.id} onSelectedLogIdsChange={setSelectedLogIds} onCreateSession={createSession} onStopSelected={stopSelectedLogs} onDeleteSelected={() => setDeleteConfirmOpen(true)} onPreviewLog={previewGenerationLog} />
            </Drawer>
            <Drawer title="参数" placement="bottom" height="82vh" open={settingsOpen} onClose={() => setSettingsOpen(false)}>
                <div className="grid grid-cols-2 gap-3 pb-4">
                    <GenerationSettings config={effectiveConfig} model={model} updateConfig={updateConfig} openConfigDialog={openConfigDialog} />
                </div>
            </Drawer>
            <PromptSelectDialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen} onSelect={setPrompt} />
            <AssetPickerModal open={assetPickerOpen} onInsert={(payload) => void insertPickedAsset(payload)} onClose={() => setAssetPickerOpen(false)} />
            <Modal title="删除生成记录" open={deleteConfirmOpen} onCancel={() => setDeleteConfirmOpen(false)} onOk={deleteSelectedLogs} okText="删除" okButtonProps={{ danger: true }} cancelText="取消">
                确定删除选中的 {selectedLogIds.length} 条生成记录吗？生成中的记录会先停止本地轮询再删除。
            </Modal>
        </div>
    );
}

function GenerationSettings({ config, model, updateConfig, openConfigDialog }: { config: AiConfig; model: string; updateConfig: UpdateAiConfig; openConfigDialog: (shouldPromptContinue?: boolean) => void }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];

    return (
        <>
            <label className="col-span-2 block min-w-0 sm:col-span-1">
                <span className="mb-1.5 block text-sm font-semibold sm:mb-2 sm:text-base">模型</span>
                <ModelPicker config={config} value={model} onChange={(value) => updateConfig("videoModel", value)} capability="video" fullWidth onMissingConfig={() => openConfigDialog(false)} />
            </label>
            <div className="col-span-2">
                <VideoSettingsPanel config={config} onConfigChange={(key, value) => updateConfig(key, value)} theme={theme} showTitle={false} className="space-y-4" />
            </div>
        </>
    );
}

function ResultVideoCard({ video, onDownload, onSaveAsset }: { video: GeneratedVideo; onDownload: (video: GeneratedVideo) => void; onSaveAsset: (video: GeneratedVideo) => void }) {
    return (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-background dark:border-stone-800">
            <video src={video.url} controls className="aspect-video w-full bg-black object-contain" />
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-stone-200 px-3 py-2.5 dark:border-stone-800">
                <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                    <span>
                        {video.width}x{video.height}
                    </span>
                    <span>{formatBytes(video.bytes)}</span>
                    <span>{formatDuration(video.durationMs)}</span>
                </div>
                <div className="flex shrink-0 gap-1">
                    <Button size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => onSaveAsset(video)}>
                        添加到素材
                    </Button>
                    <Button size="small" icon={<Download className="size-3.5" />} onClick={() => onDownload(video)}>
                        下载
                    </Button>
                </div>
            </div>
        </div>
    );
}

function PendingVideoCard({ message }: { message?: string }) {
    return (
        <div className="relative aspect-video overflow-hidden rounded-lg border border-dashed border-stone-300 bg-stone-50 dark:border-stone-700 dark:bg-stone-900">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-stone-500 dark:text-stone-400">
                <LoaderCircle className="size-6 animate-spin" />
                <span>生成中</span>
                {message ? <span className="max-w-[80%] text-center text-xs text-amber-600 dark:text-amber-300">{message}</span> : null}
            </div>
        </div>
    );
}

function FailedVideoCard({ error, onRetry }: { error: string; onRetry: () => void }) {
    return (
        <div className="overflow-hidden rounded-lg border border-red-200 bg-red-50 dark:border-red-950 dark:bg-red-950/20">
            <div className="flex aspect-video flex-col items-center justify-center gap-3 p-5 text-center">
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
                <h2 className="text-base font-semibold">生成记录</h2>
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
                    <LogCard key={log.id} log={log} selected={selectedLogIds.includes(log.id)} active={activeLogId === log.id} onSelectedChange={(checked) => onSelectedLogIdsChange(checked ? [...selectedLogIds, log.id] : selectedLogIds.filter((id) => id !== log.id))} onClick={() => onPreviewLog(log)} />
                ))}
                {!logs.length ? <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-stone-300 text-center text-sm text-stone-500 dark:border-stone-700">暂无生成记录</div> : null}
            </div>
        </>
    );
}

function LogCard({ log, selected, active, onSelectedChange, onClick }: { log: GenerationLog; selected: boolean; active: boolean; onSelectedChange: (checked: boolean) => void; onClick: () => void }) {
    const previewUrl = log.video?.thumbnailUrl || log.video?.url;

    return (
        <button type="button" className={`block w-full rounded-lg border p-2 text-left transition ${active ? "border-stone-900 bg-blue-50 dark:border-stone-100 dark:bg-blue-950/20" : "border-stone-200 bg-background hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-900"}`} onClick={onClick}>
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
                <Checkbox className="mt-0.5" checked={selected} onClick={(event) => event.stopPropagation()} onChange={(event) => onSelectedChange(event.target.checked)} />
                <div className="min-w-0">
                    <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-2">
                        <div className="flex aspect-video w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-black/90">
                            {previewUrl ? log.video?.thumbnailUrl ? <img src={previewUrl} alt="" className="size-full object-cover" /> : <video src={previewUrl} className="size-full object-cover" muted preload="metadata" /> : <VideoIcon className="size-4 text-white/55" />}
                        </div>
                        <div className="min-w-0">
                            <div className="truncate text-sm font-semibold leading-5">{log.title}</div>
                            <div className="mt-2 flex flex-wrap gap-1">
                                <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none">{log.size}</Tag>
                                <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none">{log.resolution}p</Tag>
                                <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none">{log.seconds}s</Tag>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="grid justify-items-end gap-2">
                    <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none" color={log.status === "成功" ? "blue" : log.status === "生成中" ? "processing" : "red"}>
                        {log.status}
                    </Tag>
                    <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none" color="green">
                        {formatDuration(log.durationMs)}
                    </Tag>
                    <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none">{log.time || formatLogTime(log.createdAt)}</Tag>
                </div>
            </div>
        </button>
    );
}

function formatLogTime(createdAt: number) {
    return new Date(createdAt || Date.now()).toLocaleString("zh-CN", { hour12: false });
}

async function readStoredLogs() {
    if (typeof window === "undefined") return [];
    try {
        const logs: GenerationLog[] = [];
        await logStore.iterate<GenerationLog, void>((value) => {
            logs.push(value);
        });
        return (await Promise.all(logs.map(normalizeLog))).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch {
        return [];
    }
}

async function normalizeLog(log: Partial<GenerationLog>): Promise<GenerationLog> {
    const video = log.video
        ? {
              ...log.video,
              url: log.video.storageKey ? await resolveMediaUrl(log.video.storageKey, log.video.url) : log.video.url,
              thumbnailUrl: log.video.thumbnailStorageKey ? await resolveMediaUrl(log.video.thumbnailStorageKey, log.video.thumbnailUrl) : log.video.thumbnailUrl,
          }
        : log.video;
    const videoReferences = await Promise.all(
        (log.videoReferences || []).map(async (item) => ({
            ...item,
            url: item.storageKey ? await resolveMediaUrl(item.storageKey, item.url) : item.url,
        })),
    );
    const audioReferences = await Promise.all(
        (log.audioReferences || []).map(async (item) => ({
            ...item,
            url: item.storageKey ? await resolveMediaUrl(item.storageKey, item.url) : item.url,
        })),
    );
    const references = await Promise.all(
        (log.references || []).map(async (item) => ({
            ...item,
            dataUrl: await resolveImageUrl(item.storageKey, item.dataUrl),
        })),
    );
    const config = normalizeLogConfig(log);
    return {
        id: log.id || nanoid(),
        createdAt: log.createdAt || Date.now(),
        title: log.title || log.model || "未命名",
        prompt: log.prompt || "",
        time: log.time || new Date().toLocaleString("zh-CN", { hour12: false }),
        model: log.model || config.videoModel || "",
        config,
        references,
        videoReferences,
        audioReferences,
        durationMs: log.durationMs || 0,
        size: log.size || config.size || "",
        resolution: normalizeResolution(log.resolution || config.vquality || ""),
        seconds: log.seconds || config.videoSeconds || "",
        status: log.status || "成功",
        task: log.task,
        video,
        error: log.error,
    };
}

function serializeLog(log: GenerationLog): GenerationLog {
    return {
        ...log,
        references: log.references.map((item) => ({ ...item, dataUrl: item.storageKey ? "" : item.dataUrl })),
        videoReferences: log.videoReferences.map((item) => (item.storageKey ? { ...item, url: "" } : item)),
        audioReferences: log.audioReferences.map((item) => (item.storageKey ? { ...item, url: "" } : item)),
        video: log.video ? { ...log.video, url: log.video.storageKey ? "" : log.video.url, thumbnailUrl: log.video.thumbnailStorageKey ? "" : log.video.thumbnailUrl } : log.video,
    };
}

async function createStoredVideoThumbnail(url: string) {
    try {
        const blob = await captureVideoFrame(url);
        if (!blob) return undefined;
        return uploadMediaFile(blob, "video-thumbnail");
    } catch {
        return undefined;
    }
}

function captureVideoFrame(url: string) {
    return new Promise<Blob | undefined>((resolve) => {
        const video = document.createElement("video");
        let settled = false;
        const finish = (blob?: Blob) => {
            if (settled) return;
            settled = true;
            video.pause();
            video.removeAttribute("src");
            video.load();
            resolve(blob);
        };
        const draw = () => {
            try {
                const width = video.videoWidth || 1280;
                const height = video.videoHeight || 720;
                const canvas = document.createElement("canvas");
                const scale = Math.min(1, 320 / width);
                canvas.width = Math.max(1, Math.round(width * scale));
                canvas.height = Math.max(1, Math.round(height * scale));
                canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => finish(blob || undefined), "image/jpeg", 0.72);
            } catch {
                finish();
            }
        };
        video.crossOrigin = "anonymous";
        video.muted = true;
        video.playsInline = true;
        video.preload = "metadata";
        video.onloadeddata = () => {
            if (Number.isFinite(video.duration) && video.duration > 0.2) {
                video.currentTime = 0.1;
                return;
            }
            draw();
        };
        video.onseeked = draw;
        video.onerror = () => finish();
        video.src = url;
        video.load();
    });
}

function isSupportedAudioFile(file: File) {
    return file.type === "audio/mpeg" || file.type === "audio/mp3" || file.type === "audio/wav" || file.type === "audio/x-wav" || /\.(mp3|wav)$/i.test(file.name);
}

function filterAudioReferencesByDuration(existing: ReferenceAudio[], next: ReferenceAudio[], warn: (content: string) => void) {
    let total = existing.reduce((sum, item) => sum + (item.durationMs || 0), 0);
    const accepted: ReferenceAudio[] = [];
    let skipped = false;
    for (const item of next) {
        if (item.durationMs && (item.durationMs < 2000 || item.durationMs > 15000)) {
            skipped = true;
            continue;
        }
        if (item.durationMs && total + item.durationMs > 15000) {
            skipped = true;
            continue;
        }
        total += item.durationMs || 0;
        accepted.push(item);
    }
    if (skipped) warn("已忽略不符合时长要求的参考音频：单个 2-15 秒，总时长不超过 15 秒");
    return accepted;
}

function moveListItem<T>(items: T[], index: number, offset: number) {
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= items.length) return items;
    const next = [...items];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    return next;
}

function buildVideoPromptReferences(images: ReferenceImage[], videos: ReferenceVideo[], audios: ReferenceAudio[]): CanvasResourceReference[] {
    return [
        ...images.map((image, index) => ({
            id: image.id,
            nodeId: image.id,
            kind: "image" as const,
            label: seedanceReferenceLabel("image", index),
            title: image.name || seedanceReferenceLabel("image", index),
            previewUrl: image.dataUrl,
            active: true,
        })),
        ...videos.map((video, index) => ({
            id: video.id,
            nodeId: video.id,
            kind: "video" as const,
            label: seedanceReferenceLabel("video", index),
            title: video.name || seedanceReferenceLabel("video", index),
            previewUrl: video.url,
            active: true,
        })),
        ...audios.map((audio, index) => ({
            id: audio.id,
            nodeId: audio.id,
            kind: "audio" as const,
            label: seedanceReferenceLabel("audio", index),
            title: audio.name || seedanceReferenceLabel("audio", index),
            previewUrl: audio.url,
            active: true,
        })),
    ];
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

function normalizeLogConfig(log: Partial<GenerationLog>): GenerationLogConfig {
    return {
        model: log.config?.model || log.model || "",
        videoModel: log.config?.videoModel || log.model || "",
        size: log.config?.size || log.size || "",
        vquality: normalizeResolution(log.config?.vquality || log.resolution || ""),
        videoSeconds: log.config?.videoSeconds || log.seconds || "",
        videoGenerateAudio: log.config?.videoGenerateAudio || "true",
        videoWatermark: log.config?.videoWatermark || "false",
    };
}

function buildLog({ prompt, model, config, references, videoReferences, audioReferences, durationMs, status, task, video, error }: { prompt: string; model: string; config: AiConfig; references: ReferenceImage[]; videoReferences: ReferenceVideo[]; audioReferences: ReferenceAudio[]; durationMs: number; status: GenerationLog["status"]; task?: VideoGenerationTask; video?: GeneratedVideo; error?: string }): GenerationLog {
    const logConfig = {
        model: config.model,
        videoModel: config.videoModel,
        size: config.size,
        vquality: normalizeResolution(config.vquality),
        videoSeconds: config.videoSeconds,
        videoGenerateAudio: config.videoGenerateAudio,
        videoWatermark: config.videoWatermark,
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
        videoReferences,
        audioReferences,
        durationMs,
        size: logConfig.size,
        resolution: logConfig.vquality,
        seconds: logConfig.videoSeconds,
        status,
        task,
        video,
        error,
    };
}

function buildVideoConfig(config: AiConfig, model: string): AiConfig {
    const isGrokImagineVideo = isGrokImagineVideoModel(model);
    const seedance = isSeedanceVideoConfig({ ...config, model });
    const asyncJson = config.apiFormat === "newtoken" || config.apiFormat === "duomiapi" || config.apiFormat === "lingdongapi" || config.apiFormat === "cai2";
    return {
        ...config,
        model,
        videoModel: model,
        size: isGrokImagineVideo ? normalizeGrokImagineVideoRatio(config.size) : seedance || asyncJson ? normalizeSeedanceRatio(config.size) : normalizeVideoSize(config.size),
        videoSeconds: normalizeVideoSeconds(config.videoSeconds),
        vquality: isGrokImagineVideo ? normalizeGrokImagineVideoResolution(config.vquality, model) : normalizeResolution(config.vquality),
        videoGenerateAudio: String(boolConfig(config.videoGenerateAudio, true)),
        videoWatermark: String(boolConfig(config.videoWatermark, false)),
    };
}

function normalizeVideoSeconds(value: string) {
    if (String(value).trim() === "-1") return "-1";
    const seconds = Math.floor(Number(value) || 6);
    return String(Math.max(1, Math.min(15, seconds)));
}

function normalizeVideoSize(value: string) {
    return normalizeVideoSizeValue(value);
}

function normalizeResolution(value: string) {
    return normalizeVideoResolutionValue(value);
}

function delay(ms: number, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
        }
        const timer = window.setTimeout(resolve, ms);
        signal?.addEventListener(
            "abort",
            () => {
                window.clearTimeout(timer);
                reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
        );
    });
}
