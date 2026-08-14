import { normalizeVideoResolutionValue, normalizeVideoSizeValue } from "@/components/video-settings-panel";
import { isGptImage2StyleConfig, normalizeGptImage2Ratio, normalizeGptImage2Resolution } from "@/lib/gpt-image-2";
import { isGrokImagineImageConfig, isGrokImagineVideoModel, normalizeGrokImagineImageCount, normalizeGrokImagineImageRatio, normalizeGrokImagineImageResolution, normalizeGrokImagineVideoRatio, normalizeGrokImagineVideoResolution } from "@/lib/grok-imagine";
import { boolConfig, isSeedanceVideoModel, normalizeSeedanceRatio } from "@/lib/seedance-video";
import { isStepImageEdit2Config, normalizeStepImageEdit2Size } from "@/lib/step-image";
import { isVideos4VideoModel, normalizeVideos4Duration, normalizeVideos4Ratio, normalizeVideos4Resolution } from "@/lib/videos4-video";
import { pollVideoGenerationTask, videoPollIntervalMs, type VideoGenerationTask, type VideoGenerationTaskState } from "@/services/api/video";
import { resolveMediaUrl, type UploadedFile } from "@/services/file-storage";
import { persistImageUrl, resolveImageUrl, type UploadedImage } from "@/services/image-storage";
import { defaultConfig, modelOptionName, type AiConfig } from "@/stores/use-config-store";
import type { ReferenceImage } from "@/types/image";

import { CanvasNodeType, type CanvasAssistantSession, type CanvasConnection, type CanvasGenerationMode, type CanvasImageGenerationType, type CanvasNodeData, type CanvasNodeMetadata } from "../types";

const CANVAS_VIDEO_POLL_TIMEOUT_MS = 30 * 60 * 1000;

export function imageMetadata(image: UploadedImage): CanvasNodeMetadata {
    return { content: image.url, storageKey: image.storageKey, status: "success", naturalWidth: image.width, naturalHeight: image.height, bytes: image.bytes, mimeType: image.mimeType };
}

export function videoMetadata(video: UploadedFile): CanvasNodeMetadata {
    return { content: video.url, storageKey: video.storageKey, status: "success", naturalWidth: video.width, naturalHeight: video.height, bytes: video.bytes, mimeType: video.mimeType || "video/mp4", durationMs: video.durationMs };
}

export function audioMetadata(audio: UploadedFile): CanvasNodeMetadata {
    return { content: audio.url, storageKey: audio.storageKey, status: "success", bytes: audio.bytes, mimeType: audio.mimeType || "audio/mpeg", durationMs: audio.durationMs };
}

export function buildImageGenerationMetadata(type: CanvasImageGenerationType, config: AiConfig, count: number, references: ReferenceImage[]): CanvasNodeMetadata {
    return {
        generationType: type,
        model: config.model,
        size: config.size,
        quality: config.quality,
        count,
        references: references.map(referenceUrl).filter((url): url is string => Boolean(url)),
    };
}

export function buildAudioGenerationMetadata(config: AiConfig): CanvasNodeMetadata {
    return {
        model: config.model,
        audioVoice: config.audioVoice,
        audioFormat: config.audioFormat,
        audioSpeed: config.audioSpeed,
        audioInstructions: config.audioInstructions,
    };
}

export function videoTaskMetadata(task: VideoGenerationTask): CanvasNodeMetadata {
    return { videoTaskId: task.id, videoTaskProvider: task.provider, videoTaskModel: task.model };
}

export function videoTaskFromMetadata(node: CanvasNodeData): VideoGenerationTask | null {
    const id = node.metadata?.videoTaskId?.trim();
    if (!id) return null;
    return {
        id,
        provider: node.metadata?.videoTaskProvider || "openai",
        model: node.metadata?.videoTaskModel || node.metadata?.model || "",
    };
}

export async function waitCanvasVideoTask(config: AiConfig, task: VideoGenerationTask, options?: { signal?: AbortSignal; onProgress?: (progress?: number, message?: string) => void }): Promise<VideoGenerationTaskState> {
    const delayMs = videoPollIntervalMs(task.provider);
    const maxAttempts = Math.ceil(CANVAS_VIDEO_POLL_TIMEOUT_MS / delayMs);
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const state = await pollVideoGenerationTask(config, task, options);
        if (state.status !== "pending") return state;
        if (state.progress !== undefined || state.message) options?.onProgress?.(state.progress, state.message);
        if (attempt < maxAttempts - 1) await delay(delayMs, options?.signal);
    }
    return { status: "pending" };
}

function delay(ms: number, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
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

function referenceUrl(image: ReferenceImage) {
    return image.storageKey || image.url || (!image.dataUrl.startsWith("data:") ? image.dataUrl : undefined);
}

export function generationReferenceUrls(context: { referenceImages: ReferenceImage[]; referenceVideos: Array<{ storageKey?: string; url?: string }>; referenceAudios?: Array<{ storageKey?: string; url?: string }> }) {
    return [
        ...context.referenceImages.map(referenceUrl).filter((url): url is string => Boolean(url)),
        ...context.referenceVideos.map((video) => video.storageKey || video.url).filter((url): url is string => Boolean(url)),
        ...(context.referenceAudios || []).map((audio) => audio.storageKey || audio.url).filter((url): url is string => Boolean(url)),
    ];
}

export async function resolveMetadataReferences(metadata: CanvasNodeMetadata): Promise<ReferenceImage[] | null> {
    if (metadata.generationType !== "edit") return [];
    if (!metadata.references?.length) return null;
    const references = await Promise.all(
        metadata.references.map(async (url, index) => {
            const dataUrl = url.startsWith("image:") ? await resolveImageUrl(url, "") : url;
            return dataUrl ? { id: `${index}`, name: `reference-${index}.png`, type: "image/png", dataUrl, storageKey: url.startsWith("image:") ? url : undefined } : null;
        }),
    );
    return references.every(Boolean) ? (references as ReferenceImage[]) : null;
}

export async function hydrateCanvasImages(nodes: CanvasNodeData[]): Promise<CanvasNodeData[]> {
    return Promise.all(
        nodes.map(async (node): Promise<CanvasNodeData> => {
            const content = node.metadata?.content || "";
            if ((node.type === CanvasNodeType.Video || node.type === CanvasNodeType.Audio) && node.metadata?.storageKey) {
                return { ...node, metadata: { ...node.metadata, content: await resolveMediaUrl(node.metadata.storageKey, content) } };
            }
            if (node.type !== CanvasNodeType.Image) return node;

            if (node.metadata?.storageKey) {
                const local = await resolveImageUrl(node.metadata.storageKey, content);
                if (local) {
                    return { ...node, metadata: { ...node.metadata, content: local, status: node.metadata.status === "loading" ? "success" : node.metadata.status } };
                }
            }
            if (!content) return node;
            if (content.startsWith("blob:") && !node.metadata?.storageKey) {
                return { ...node, metadata: { ...node.metadata, content: "", status: "error", errorDetails: "本地图片缓存已失效，请重新生成" } };
            }
            if (content.startsWith("data:image/")) {
                return { ...node, metadata: { ...node.metadata, ...imageMetadata(await persistImageUrl(content)) } };
            }
            if (/^https?:\/\//i.test(content) || content.startsWith("/api/proxy?")) {
                return { ...node, metadata: { ...node.metadata, status: node.metadata?.status === "loading" ? "success" : node.metadata?.status || "success" } };
            }
            return node;
        }),
    );
}

export async function hydrateAssistantImages(sessions: CanvasAssistantSession[]) {
    const hydrateItem = async <T extends { dataUrl?: string; storageKey?: string }>(item: T) => {
        if (item.storageKey) return { ...item, dataUrl: await resolveImageUrl(item.storageKey, item.dataUrl) };
        if (item.dataUrl?.startsWith("data:image/")) {
            const image = await persistImageUrl(item.dataUrl);
            return { ...item, dataUrl: image.url, storageKey: image.storageKey };
        }
        return item;
    };
    return Promise.all(
        sessions.map(async (session) => ({
            ...session,
            messages: await Promise.all(
                session.messages.map(async (message) => ({
                    ...message,
                    references: await Promise.all((message.references || []).map(hydrateItem)),
                })),
            ),
        })),
    );
}

export function getGenerationCount(count: string) {
    return Math.max(1, Math.min(15, Math.floor(Math.abs(Number(count)) || 1)));
}

export function buildGenerationConfig(config: AiConfig, node: CanvasNodeData | undefined, mode: CanvasGenerationMode): AiConfig {
    const defaultModel = mode === "image" ? config.imageModel : mode === "video" ? config.videoModel : mode === "audio" ? config.audioModel : config.textModel;
    const nextConfig = {
        ...config,
        model: node?.metadata?.model || defaultModel || (mode === "audio" ? defaultConfig.audioModel : config.model || defaultConfig.model),
        quality: node?.metadata?.quality || config.quality || defaultConfig.quality,
        size: node?.metadata?.size || config.size || defaultConfig.size,
        videoSeconds: node?.metadata?.seconds || config.videoSeconds || defaultConfig.videoSeconds,
        vquality: node?.metadata?.vquality || config.vquality || defaultConfig.vquality,
        videoGenerateAudio: node?.metadata?.generateAudio || config.videoGenerateAudio || defaultConfig.videoGenerateAudio,
        videoWatermark: node?.metadata?.watermark || config.videoWatermark || defaultConfig.videoWatermark,
        audioVoice: node?.metadata?.audioVoice || config.audioVoice || defaultConfig.audioVoice,
        audioFormat: node?.metadata?.audioFormat || config.audioFormat || defaultConfig.audioFormat,
        audioSpeed: node?.metadata?.audioSpeed || config.audioSpeed || defaultConfig.audioSpeed,
        audioInstructions: node?.metadata?.audioInstructions || config.audioInstructions || defaultConfig.audioInstructions,
        count: String(node?.metadata?.count || (mode === "image" ? config.canvasImageCount || config.count : config.count) || defaultConfig.count),
    };
    if (mode === "image" && isGrokImagineImageConfig(nextConfig)) {
        return { ...nextConfig, quality: normalizeGrokImagineImageResolution(nextConfig.quality), size: normalizeGrokImagineImageRatio(nextConfig.size), count: String(normalizeGrokImagineImageCount(nextConfig.count)) };
    }
    if (mode === "image" && isGptImage2StyleConfig(nextConfig)) {
        return { ...nextConfig, quality: normalizeGptImage2Resolution(nextConfig.quality), size: normalizeGptImage2Ratio(nextConfig.size) };
    }
    if (mode === "image" && isStepImageEdit2Config(nextConfig)) {
        return { ...nextConfig, size: normalizeStepImageEdit2Size(nextConfig.size) };
    }
    if (mode !== "video") return nextConfig;
    const grokImagineVideo = isGrokImagineVideoModel(nextConfig.model);
    const seedance = isSeedanceVideoConfig(nextConfig);
    const videos4 = isVideos4VideoModel(nextConfig.model);
    return {
        ...nextConfig,
        videoModel: nextConfig.model,
        size: grokImagineVideo ? normalizeGrokImagineVideoRatio(nextConfig.size) : videos4 ? normalizeVideos4Ratio(nextConfig.size) : seedance ? normalizeSeedanceRatio(nextConfig.size) : normalizeVideoSizeValue(nextConfig.size),
        videoSeconds: videos4 ? String(normalizeVideos4Duration(nextConfig.videoSeconds)) : normalizeCanvasVideoSeconds(nextConfig.videoSeconds),
        vquality: grokImagineVideo ? normalizeGrokImagineVideoResolution(nextConfig.vquality, nextConfig.model) : videos4 ? normalizeVideos4Resolution(nextConfig.vquality, nextConfig.model) : normalizeVideoResolutionValue(nextConfig.vquality),
        videoGenerateAudio: String(boolConfig(nextConfig.videoGenerateAudio, true)),
        videoWatermark: String(boolConfig(nextConfig.videoWatermark, false)),
    };
}

function normalizeCanvasVideoSeconds(value: string) {
    if (String(value).trim() === "-1") return "-1";
    const seconds = Math.floor(Number(value) || 6);
    return String(Math.max(1, Math.min(15, seconds)));
}

function isSeedanceVideoConfig(config: AiConfig) {
    return isSeedanceVideoModel(modelOptionName(config.model || config.videoModel));
}

export function supportsRichVideoReferences(config: AiConfig) {
    return isSeedanceVideoConfig(config) || isVideos4VideoModel(config.model || config.videoModel);
}

export function resetInterruptedGeneration(nodes: CanvasNodeData[]): CanvasNodeData[] {
    return nodes.map((node): CanvasNodeData => {
        if (node.metadata?.status !== "loading") return node;
        if (node.type === CanvasNodeType.Image && node.metadata?.content && !node.metadata.content.startsWith("blob:")) {
            return { ...node, metadata: { ...node.metadata, status: "success", errorDetails: undefined } };
        }
        return {
            ...node,
            metadata: {
                ...node.metadata,
                status: "error",
                errorDetails: node.type === CanvasNodeType.Video && node.metadata.videoTaskId ? "页面刷新后生成轮询已中断，可手动拉取结果。" : "页面刷新后生成已中断，请重新生成。",
            },
        };
    });
}

export function isGenerationCanceled(error: unknown) {
    return error instanceof Error && (error.message === "请求已取消" || error.name === "AbortError");
}

export function findRetrySourceNode(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    const queue = connections.filter((connection) => connection.toNodeId === nodeId).map((connection) => connection.fromNodeId);
    const visited = new Set<string>();
    while (queue.length) {
        const id = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        const node = nodes.find((item) => item.id === id);
        if (node?.type === CanvasNodeType.Config) return node;
        connections.filter((connection) => connection.toNodeId === id).forEach((connection) => queue.push(connection.fromNodeId));
    }
    return null;
}

export function sourceNodeReferenceImages(node: CanvasNodeData | null): ReferenceImage[] {
    if (!node || node.type !== CanvasNodeType.Image || !node.metadata?.content) return [];
    return [{ id: node.id, name: `${node.title || node.id}.png`, type: node.metadata.mimeType || "image/png", dataUrl: node.metadata.content, storageKey: node.metadata.storageKey }];
}
