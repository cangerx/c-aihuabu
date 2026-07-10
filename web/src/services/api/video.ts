import axios from "axios";

import { compressImageDataUrl, dataUrlToFile, getDataUrlByteSize } from "@/lib/image-utils";
import { debugError, debugLog, debugWarn, estimatePayloadBytes, summarizeAxiosError } from "@/lib/debug-log";
import { getMediaBlob, uploadMediaFile, type UploadedFile } from "@/services/file-storage";
import { imageToDataUrl } from "@/services/image-storage";
import { isGrokImagineApiFormat, isGrokImagineVideo15Model, isGrokImagineVideoModel, normalizeGrokImagineVideoDuration, normalizeGrokImagineVideoRatio, normalizeGrokImagineVideoResolution } from "@/lib/grok-imagine";
import { boolConfig, buildSeedancePromptText, caiVideoModelCapabilities, isSeedanceVideoConfig, normalizeSeedanceDuration, normalizeSeedanceRatio, normalizeSeedanceResolution, seedanceVideoReferenceError, SEEDANCE_REFERENCE_LIMITS } from "@/lib/seedance-video";
import { buildAiApiUrl, buildProxiedUrl, modelOptionName, resolveModelRequestConfig, type AiConfig } from "@/stores/use-config-store";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio, ReferenceVideo } from "@/types/media";

type VideoResponse = { id?: string; request_id?: string; task_id?: string; status?: string; error?: { message?: string }; [key: string]: any };
type ApiVideoResponse = VideoResponse | { code?: number; data?: VideoResponse | null; msg?: string };
type SeedanceTask = {
    id: string;
    status?: "queued" | "running" | "succeeded" | "failed" | "cancelled" | "expired";
    error?: { code?: string; message?: string } | null;
    content?: { video_url?: string; last_frame_url?: string } | null;
};
type ApiEnvelope<T> = T | { code?: number; data?: T | null; msg?: string };
type RequestOptions = { signal?: AbortSignal; videoMode?: string };
const VIDEO_GENERATION_TIMEOUT_MS = 30 * 60 * 1000;

export type VideoGenerationResult = { blob?: Blob; url?: string; mimeType?: string };
export type VideoGenerationTask = { id: string; provider: "openai" | "seedance"; model: string };
export type VideoGenerationTaskState = { status: "pending" } | { status: "completed"; result: VideoGenerationResult } | { status: "failed"; error: string };

function aiApiUrl(config: AiConfig, path: string) {
    if (config.apiFormat === "duomiapi") return duomiApiUrl(config, path);
    return buildAiApiUrl(config.baseUrl, path, config.aiProxyEnabled);
}

function duomiApiUrl(config: AiConfig, path: string) {
    const baseUrl = config.baseUrl
        .trim()
        .replace(/\/+$/, "")
        .replace(/\/v1$/i, "")
        .replace(/\/api\/v3$/i, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const prefix = normalizedPath.startsWith("/contents/") ? "/api/v3" : "/v1";
    return buildProxiedUrl(`${baseUrl}${prefix}${normalizedPath}`, config.aiProxyEnabled);
}

function aiHeaders(config: AiConfig, contentType?: string) {
    return {
        Authorization: config.apiFormat === "duomiapi" ? config.apiKey : `Bearer ${config.apiKey}`,
        ...(contentType ? { "Content-Type": contentType } : {}),
    };
}

function withSystemPrompt(config: AiConfig, prompt: string) {
    const systemPrompt = config.systemPrompt.trim();
    return systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
}

export async function requestVideoGeneration(config: AiConfig, prompt: string, references: ReferenceImage[] = [], videoReferences: ReferenceVideo[] = [], audioReferences: ReferenceAudio[] = [], options?: RequestOptions): Promise<VideoGenerationResult> {
    const task = await createVideoGenerationTask(config, prompt, references, videoReferences, audioReferences, options);
    const delayMs = task.provider === "seedance" ? 5000 : 2500;
    const maxAttempts = Math.ceil(VIDEO_GENERATION_TIMEOUT_MS / delayMs);
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const state = await pollVideoGenerationTask(config, task, options);
        if (state.status === "completed") return state.result;
        if (state.status === "failed") throw new Error(state.error);
        if (attempt === maxAttempts - 1) throw new Error(`${task.provider === "seedance" ? "Seedance " : ""}视频生成超时，请稍后重试`);
        await delay(delayMs, options?.signal);
    }
    throw new Error("视频生成超时，请稍后重试");
}

export async function createVideoGenerationTask(config: AiConfig, prompt: string, references: ReferenceImage[] = [], videoReferences: ReferenceVideo[] = [], audioReferences: ReferenceAudio[] = [], options?: RequestOptions): Promise<VideoGenerationTask> {
    const selectedModel = (config.model || config.videoModel).trim();
    const requestConfig = resolveModelRequestConfig(config, selectedModel);
    assertVideoConfig(requestConfig, requestConfig.model);
    debugLog("video", "创建视频任务", {
        model: selectedModel,
        resolvedModel: requestConfig.model,
        apiFormat: requestConfig.apiFormat,
        baseUrl: requestConfig.baseUrl,
        proxy: requestConfig.aiProxyEnabled !== false,
        videoMode: options?.videoMode || "text-to-video",
        references: references.length,
        videoReferences: videoReferences.length,
        audioReferences: audioReferences.length,
        promptChars: prompt.length,
    });
    try {
        if (isGrokImagineApiFormat(requestConfig) && isGrokImagineVideoModel(requestConfig.model)) {
            return await createGrokImagineVideoTask(requestConfig, selectedModel, prompt, references, videoReferences, audioReferences, options);
        }
        if (requestConfig.apiFormat === "duomiapi") {
            return await createDuomiVideoTask(requestConfig, selectedModel, prompt, references, videoReferences, audioReferences, options);
        }
        if (requestConfig.apiFormat === "lingdongapi") {
            return await createLingdongVideoTask(requestConfig, selectedModel, prompt, references, videoReferences, audioReferences, options);
        }
        if (requestConfig.apiFormat === "newtoken") {
            return await createNewTokenVideoTask(requestConfig, selectedModel, prompt, references, videoReferences, audioReferences, options);
        }
        if (requestConfig.apiFormat === "volcengine") {
            return await createSeedanceTask(requestConfig, selectedModel, prompt, references, videoReferences, audioReferences, options);
        }
        if (requestConfig.apiFormat === "openai-json" || isLikelyCaiVideoChannel(requestConfig.baseUrl)) {
            return await (isCaiSdModel(requestConfig.model) ? createCaiSdVideoTask(requestConfig, selectedModel, prompt, references, videoReferences, audioReferences, options) : createCaiStandardVideoTask(requestConfig, selectedModel, prompt, references, videoReferences, audioReferences, options));
        }
        if (videoReferences.length || audioReferences.length) {
            throw new Error("当前视频接口不支持参考视频或参考音频，请切换到 Seedance 2.0 / 火山 Agent Plan 模型，或移除参考素材");
        }
        return await createOpenAIVideoTask(requestConfig, selectedModel, prompt, references, options);
    } catch (error) {
        debugError("video", "创建视频任务失败", { model: selectedModel, apiFormat: requestConfig.apiFormat, error: summarizeAxiosError(error), message: error instanceof Error ? error.message : String(error) });
        throw error;
    }
}

export async function pollVideoGenerationTask(config: AiConfig, task: VideoGenerationTask, options?: RequestOptions): Promise<VideoGenerationTaskState> {
    const requestConfig = resolveModelRequestConfig(config, task.model);
    assertVideoConfig(requestConfig, requestConfig.model);
    if (isGrokImagineApiFormat(requestConfig) && isGrokImagineVideoModel(task.model)) return pollGrokImagineVideoTask(requestConfig, task, options);
    if (requestConfig.apiFormat === "duomiapi") return pollDuomiVideoTask(requestConfig, task, options);
    if (requestConfig.apiFormat === "lingdongapi") return pollLingdongVideoTask(requestConfig, task, options);
    if (requestConfig.apiFormat === "newtoken") return pollNewTokenVideoTask(requestConfig, task, options);
    if (requestConfig.apiFormat === "volcengine") return pollSeedanceTask(requestConfig, task, options);
    if (requestConfig.apiFormat === "openai-json" || isLikelyCaiVideoChannel(requestConfig.baseUrl)) return isCaiSdModel(requestConfig.model) ? pollCaiSdVideoTask(requestConfig, task, options) : pollOpenAIVideoTask(requestConfig, task, options);
    return pollOpenAIVideoTask(requestConfig, task, options);
}

export async function storeGeneratedVideo(result: VideoGenerationResult): Promise<UploadedFile> {
    if (result.blob) return uploadMediaFile(result.blob, "video");
    if (result.url) return { url: result.url, storageKey: "", bytes: 0, mimeType: result.mimeType || "video/mp4" };
    throw new Error("视频接口没有返回可播放的视频");
}

async function createOpenAIVideoTask(config: AiConfig, model: string, prompt: string, references: ReferenceImage[], options?: RequestOptions): Promise<VideoGenerationTask> {
    const requestPrompt = buildSeedancePromptText(prompt, references, [], []);
    const body = new FormData();
    body.append("model", modelOptionName(model));
    body.append("prompt", requestPrompt);
    body.append("seconds", normalizeVideoSeconds(config.videoSeconds));
    if (normalizeVideoSize(config.size)) body.append("size", normalizeVideoSize(config.size)!);
    body.append("resolution_name", normalizeVideoResolution(config.vquality));
    body.append("preset", "normal");
    const files = await Promise.all(references.slice(0, 7).map(async (image) => dataUrlToFile({ ...image, dataUrl: await imageToDataUrl(image) })));
    files.forEach((file) => body.append("input_reference[]", file));
    try {
        const created = unwrapVideoResponse((await postWithProxyFallback<ApiVideoResponse>(config, "/videos", body, undefined, options)).data);
        const taskId = readVideoTaskId(created);
        if (!taskId) throw new Error("视频接口没有返回任务 ID");
        return { id: taskId, provider: "openai", model };
    } catch (error) {
        throw new Error(readAxiosError(error, "视频任务创建失败"));
    }
}

async function createGrokImagineVideoTask(config: AiConfig, model: string, prompt: string, references: ReferenceImage[], videoReferences: ReferenceVideo[], audioReferences: ReferenceAudio[], options?: RequestOptions): Promise<VideoGenerationTask> {
    if (videoReferences.length || audioReferences.length) {
        throw new Error("Grok Imagine 视频暂不支持参考视频或参考音频");
    }

    const modelName = modelOptionName(model);
    const requestPrompt = buildSeedancePromptText(prompt, references, [], []);
    const imageUrls = await Promise.all(references.map((image) => resolveGrokImagineImageUrl(image, options)));
    const videoMode = options?.videoMode || "text-to-video";
    const aspectRatio = normalizeGrokImagineVideoRatio(config.size);
    const resolution = normalizeGrokImagineVideoResolution(config.vquality, modelName);
    const duration = normalizeGrokImagineVideoDuration(config.videoSeconds);
    const payload: Record<string, any> = {
        model: modelName,
        prompt: withSystemPrompt(config, requestPrompt),
        aspect_ratio: aspectRatio,
        resolution,
        duration,
    };

    if (isGrokImagineVideo15Model(modelName)) {
        if (videoMode === "image-ref") throw new Error("grok-imagine-video-1.5 不支持参考图生视频");
        assertGrokImagineVideo15Reference(modelName, imageUrls);
        payload.image = { url: imageUrls[0] };
    } else if (videoMode === "image-to-video") {
        if (!imageUrls[0]) throw new Error("图生视频需要先连接 1 张图片");
        if (imageUrls.length > 1) throw new Error("图生视频仅支持 1 张图片输入");
        payload.image = { url: imageUrls[0] };
    } else if (videoMode === "image-ref") {
        if (!imageUrls.length) throw new Error("参考图生视频需要至少 1 张图片");
        payload.reference_images = imageUrls.map((url) => ({ url }));
    } else if (imageUrls.length === 1) {
        payload.image = { url: imageUrls[0] };
    } else if (imageUrls.length > 1) {
        payload.reference_images = imageUrls.map((url) => ({ url }));
    }

    try {
        const created = unwrapVideoResponse((await postWithProxyFallback<ApiVideoResponse>(config, "/videos/generations", payload, "application/json", options)).data);
        const requestId = readVideoTaskId(created);
        if (!requestId) throw new Error("Grok Imagine 接口没有返回 request_id");
        return { id: requestId, provider: "openai", model };
    } catch (error) {
        throw new Error(readAxiosError(error, "Grok Imagine 视频任务创建失败"));
    }
}

async function resolveGrokImagineImageUrl(image: ReferenceImage, options?: RequestOptions) {
    const directUrl = String(image.url || image.dataUrl || "").trim();
    if (isCaiReachableUrl(directUrl)) {
        debugLog("video", "Grok 参考图使用公网 URL", { host: safeHost(directUrl) });
        return directUrl;
    }
    try {
        const file = await dataUrlToFile({ ...image, dataUrl: await imageToDataUrl(image) });
        return await uploadReferenceFile(file, options);
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        // 仅在无上传服务时回退 dataURL；配置错误或上传失败应直接抛出，避免再塞超大 base64。
        if (!/没有参考素材临时上传服务|没有临时上传|404/.test(reason)) throw error instanceof Error ? error : new Error(reason);
        const dataUrl = await imageToDataUrl(image);
        if (!dataUrl) throw error instanceof Error ? error : new Error("参考图读取失败");
        const bytes = getDataUrlByteSize(dataUrl);
        if (bytes <= 1.5 * 1024 * 1024) {
            debugWarn("video", "Grok 参考图回退 dataURL", { bytes, reason });
            return dataUrl;
        }
        const compressed = await compressImageDataUrl(dataUrl, 1280, 0.82);
        debugWarn("video", "Grok 参考图回退压缩 dataURL", { beforeBytes: bytes, afterBytes: getDataUrlByteSize(compressed) });
        return compressed;
    }
}

async function createNewTokenVideoTask(config: AiConfig, model: string, prompt: string, references: ReferenceImage[], videoReferences: ReferenceVideo[], audioReferences: ReferenceAudio[], options?: RequestOptions): Promise<VideoGenerationTask> {
    const imageUrls = await Promise.all(references.map((image) => resolveNewTokenImageUrl(image, options)));
    const videoUrls = await Promise.all(videoReferences.map((video) => resolveNewTokenMediaUrl(video, "参考视频", options)));
    const audioUrls = await Promise.all(audioReferences.map((audio) => resolveNewTokenMediaUrl(audio, "参考音频", options)));
    const requestPrompt = buildSeedancePromptText(prompt, references, videoReferences, audioReferences);
    assertGrokImagineVideo15Reference(model, imageUrls);
    const payload = buildNewTokenVideoPayload(config, model, requestPrompt, imageUrls, videoUrls, audioUrls, options?.videoMode);

    try {
        const created = unwrapVideoResponse((await postWithProxyFallback<ApiVideoResponse>(config, "/videos", payload, "application/json", options)).data);
        const taskId = readVideoTaskId(created);
        if (!taskId) throw new Error("NewToken 接口没有返回任务 ID");
        return { id: taskId, provider: "openai", model };
    } catch (error) {
        throw new Error(readAxiosError(error, "NewToken 视频任务创建失败"));
    }
}

async function createDuomiVideoTask(config: AiConfig, model: string, prompt: string, references: ReferenceImage[], videoReferences: ReferenceVideo[], audioReferences: ReferenceAudio[], options?: RequestOptions): Promise<VideoGenerationTask> {
    const modelName = modelOptionName(model);
    const imageUrls = await Promise.all(references.map((image) => resolveCaiImageUrl(image, options)));
    const videoUrls = await Promise.all(videoReferences.map((video) => resolveCaiMediaUrl(video, "参考视频", options)));
    const audioUrls = await Promise.all(audioReferences.map((audio) => resolveCaiMediaUrl(audio, "参考音频", options)));
    const requestPrompt = buildSeedancePromptText(prompt, references, videoReferences, audioReferences);
    assertGrokImagineVideo15Reference(modelName, imageUrls);
    const videoMode = options?.videoMode || "text-to-video";
    const isGrok = modelName.toLowerCase().includes("grok");
    const payload = isGrok ? buildDuomiGrokPayload(config, modelName, requestPrompt, imageUrls, videoMode) : buildDuomiSeedancePayload(config, modelName, requestPrompt, imageUrls, videoUrls, audioUrls);
    const path = isGrok ? "/videos/generations" : "/contents/generations/tasks";

    try {
        const created = unwrapVideoResponse((await postWithProxyFallback<ApiVideoResponse>(config, path, payload, "application/json", options)).data);
        const taskId = readVideoTaskId(created);
        if (!taskId) throw new Error("duomiapi 接口没有返回任务 ID");
        return { id: taskId, provider: "openai", model };
    } catch (error) {
        throw new Error(readAxiosError(error, "duomiapi 视频任务创建失败"));
    }
}

async function createLingdongVideoTask(config: AiConfig, model: string, prompt: string, references: ReferenceImage[], videoReferences: ReferenceVideo[], audioReferences: ReferenceAudio[], options?: RequestOptions): Promise<VideoGenerationTask> {
    const imageUrls = await Promise.all(references.map((image) => resolveCaiImageUrl(image, options)));
    const videoUrls = await Promise.all(videoReferences.map((video) => resolveCaiMediaUrl(video, "参考视频", options)));
    const audioUrls = await Promise.all(audioReferences.map((audio) => resolveCaiMediaUrl(audio, "参考音频", options)));
    const payload: Record<string, any> = {
        model: modelOptionName(model),
        prompt: buildSeedancePromptText(prompt, references, videoReferences, audioReferences),
        duration: normalizeLingdongDuration(config.videoSeconds, model),
    };
    appendLingdongSize(payload, config, model);
    if (imageUrls.length) payload.images = imageUrls;
    if (videoUrls.length) payload.videos = videoUrls;
    if (audioUrls.length) payload.audios = audioUrls;

    try {
        const created = unwrapVideoResponse((await postWithProxyFallback<ApiVideoResponse>(config, "/video/generations", payload, "application/json", options)).data);
        const taskId = readVideoTaskId(created);
        if (!taskId) throw new Error("Lingdong 接口没有返回任务 ID");
        return { id: taskId, provider: "openai", model };
    } catch (error) {
        throw new Error(readAxiosError(error, "Lingdong 视频任务创建失败"));
    }
}

async function createCaiStandardVideoTask(config: AiConfig, model: string, prompt: string, references: ReferenceImage[], videoReferences: ReferenceVideo[], audioReferences: ReferenceAudio[], options?: RequestOptions): Promise<VideoGenerationTask> {
    const imageUrls = await Promise.all(references.map((image) => resolveCaiImageUrl(image, options)));
    const videoUrls = await Promise.all(videoReferences.map((video) => resolveCaiMediaUrl(video, "参考视频", options)));
    const audioUrls = await Promise.all(audioReferences.map((audio) => resolveCaiMediaUrl(audio, "参考音频", options)));
    const requestPrompt = buildSeedancePromptText(prompt, references, videoReferences, audioReferences);
    assertCaiVideoMode(model, imageUrls, videoUrls, audioUrls, options?.videoMode);
    const ratio = normalizeSeedanceRatio(config.size);
    const payload: Record<string, any> = {
        model: modelOptionName(model),
        prompt: requestPrompt,
        duration: normalizeCaiDuration(config.videoSeconds),
        metadata: {
            resolution: normalizeCaiResolution(config.vquality),
            ratio: ratio === "adaptive" ? "16:9" : ratio,
            prompt_extend: false,
            watermark: boolConfig(config.videoWatermark, false),
        },
    };
    appendCaiReferences(payload, model, imageUrls, videoUrls, audioUrls, options?.videoMode);

    try {
        const created = unwrapVideoResponse((await postWithProxyFallback<ApiVideoResponse>(config, "/videos", payload, "application/json", options)).data);
        const taskId = readVideoTaskId(created);
        if (!taskId) throw new Error("视频接口没有返回任务 ID");
        return { id: taskId, provider: "openai", model };
    } catch (error) {
        throw new Error(readAxiosError(error, "视频任务创建失败"));
    }
}

async function createCaiSdVideoTask(config: AiConfig, model: string, prompt: string, references: ReferenceImage[], videoReferences: ReferenceVideo[], audioReferences: ReferenceAudio[], options?: RequestOptions): Promise<VideoGenerationTask> {
    const imageUrls = await Promise.all(references.map((image) => resolveCaiImageUrl(image, options)));
    const videoUrls = await Promise.all(videoReferences.map((video) => resolveCaiMediaUrl(video, "参考视频", options)));
    const audioUrls = await Promise.all(audioReferences.map((audio) => resolveCaiMediaUrl(audio, "参考音频", options)));
    const requestPrompt = buildSeedancePromptText(prompt, references, videoReferences, audioReferences);
    assertCaiVideoMode(model, imageUrls, videoUrls, audioUrls, options?.videoMode);
    
    const duration = normalizeSeedanceDuration(config.videoSeconds);
    const ratio = normalizeSeedanceRatio(config.size);
    const resolution = normalizeSeedanceResolution(config.vquality, modelOptionName(model));
    const isSeedance = modelOptionName(model).toLowerCase().includes("seedance");
    
    const payload: Record<string, any> = {
        model: modelOptionName(model),
        prompt: requestPrompt,
        duration: duration === -1 ? 10 : duration,
        size: ratio === "adaptive" ? "16:9" : ratio,
    };

    if (isSeedance) {
        payload.metadata = {
            resolution: resolution.toUpperCase().replace("P", "p"),
            aspect_ratio: ratio === "adaptive" ? "16:9" : ratio,
            ratio: ratio === "adaptive" ? "9:16" : ratio,
            prompt_extend: false,
            watermark: boolConfig(config.videoWatermark, false),
        };
    } else {
        payload.ratio = ratio === "adaptive" ? "16:9" : ratio;
        payload.resolution = resolution;
    }

    appendCaiReferences(payload, model, imageUrls, videoUrls, audioUrls, options?.videoMode);

    try {
        const created = unwrapVideoResponse((await postWithProxyFallback<ApiVideoResponse>(config, "/video/generations", payload, "application/json", options)).data);
        const taskId = readVideoTaskId(created);
        if (!taskId) throw new Error("视频接口没有返回任务 ID");
        return { id: taskId, provider: "openai", model };
    } catch (error) {
        throw new Error(readAxiosError(error, "视频任务创建失败"));
    }
}

async function pollNewTokenVideoTask(config: AiConfig, task: VideoGenerationTask, options?: RequestOptions): Promise<VideoGenerationTaskState> {
    try {
        const video = unwrapVideoResponse((await getWithProxyFallback<ApiVideoResponse>(config, `/videos/${task.id}`, options)).data);
        const status = normalizeTaskStatus(video.status || video.state || video.task_status);
        if (status === "completed") {
            const directUrl = readVideoUrl(video);
            if (directUrl) return { status: "completed", result: await videoResultFromUrl(resolveProviderUrl(config, directUrl), options) };
            try {
                const content = await getBlobWithProxyFallback(config, `/videos/${task.id}/content`, options);
                await assertVideoBlob(content.data);
                return { status: "completed", result: { blob: content.data } };
            } catch (err) {
                throw err;
            }
        }
        if (status === "failed") return { status: "failed", error: video.error?.message || "NewToken 视频生成失败" };
        return { status: "pending" };
    } catch (error) {
        throw new Error(readAxiosError(error, "NewToken 视频任务查询失败"));
    }
}

async function pollDuomiVideoTask(config: AiConfig, task: VideoGenerationTask, options?: RequestOptions): Promise<VideoGenerationTaskState> {
    const isGrok = modelOptionName(task.model).toLowerCase().includes("grok");
    const path = isGrok ? `/videos/tasks/${task.id}` : `/contents/generations/tasks/${task.id}`;
    try {
        const video = unwrapVideoResponse((await getWithProxyFallback<ApiVideoResponse>(config, path, options)).data);
        const status = normalizeTaskStatus(video.status || video.state || video.task_status);
        if (status === "completed") {
            const directUrl = readVideoUrl(video);
            if (!directUrl) return { status: "failed", error: "duomiapi 任务成功但没有返回视频 URL" };
            return { status: "completed", result: await videoResultFromUrl(directUrl, options) };
        }
        if (status === "failed") return { status: "failed", error: video.message || video.error?.message || "duomiapi 视频生成失败" };
        return { status: "pending" };
    } catch (error) {
        throw new Error(readAxiosError(error, "duomiapi 视频任务查询失败"));
    }
}

async function pollLingdongVideoTask(config: AiConfig, task: VideoGenerationTask, options?: RequestOptions): Promise<VideoGenerationTaskState> {
    try {
        const video = unwrapVideoResponse((await getWithProxyFallback<ApiVideoResponse>(config, `/video/generations/${task.id}`, options)).data);
        const status = normalizeTaskStatus(video.status || video.state || video.task_status);
        const directUrl = readVideoUrl(video);
        if (status === "completed" || directUrl) {
            if (directUrl) return { status: "completed", result: await videoResultFromUrl(resolveProviderUrl(config, directUrl), options) };
            return { status: "failed", error: "Lingdong 任务成功但没有返回视频 URL" };
        }
        if (status === "failed") return { status: "failed", error: video.message || video.error?.message || "Lingdong 视频生成失败" };
        return { status: "pending" };
    } catch (error) {
        throw new Error(readAxiosError(error, "Lingdong 视频任务查询失败"));
    }
}

async function pollCaiSdVideoTask(config: AiConfig, task: VideoGenerationTask, options?: RequestOptions): Promise<VideoGenerationTaskState> {
    try {
        const video = unwrapVideoResponse((await getWithProxyFallback<ApiVideoResponse>(config, `/video/generations/${task.id}`, options)).data);
        const status = normalizeTaskStatus(video.status);
        if (status === "completed") {
            const directUrl = readVideoUrl(video);
            if (directUrl) return { status: "completed", result: await videoResultFromUrl(directUrl, options) };
            try {
                const content = await getBlobWithProxyFallback(config, `/videos/${task.id}/content`, options);
                await assertVideoBlob(content.data);
                return { status: "completed", result: { blob: content.data } };
            } catch (err) {
                throw err;
            }
        }
        const directUrl = readVideoUrl(video);
        if (directUrl) return { status: "completed", result: await videoResultFromUrl(directUrl, options) };
        if (status === "failed") return { status: "failed", error: video.error?.message || "视频生成失败" };
        return { status: "pending" };
    } catch (error) {
        throw new Error(readAxiosError(error, "Cai 视频任务查询失败"));
    }
}

async function pollOpenAIVideoTask(config: AiConfig, task: VideoGenerationTask, options?: RequestOptions): Promise<VideoGenerationTaskState> {
    try {
        const video = unwrapVideoResponse((await getWithProxyFallback<ApiVideoResponse>(config, `/videos/${task.id}`, options)).data);
        const status = normalizeTaskStatus(video.status);
        if (status === "completed") {
            try {
                const content = await getBlobWithProxyFallback(config, `/videos/${task.id}/content`, options);
                await assertVideoBlob(content.data);
                return { status: "completed", result: { blob: content.data } };
            } catch (err) {
                const directUrl = readVideoUrl(video);
                if (directUrl) {
                    return { status: "completed", result: await videoResultFromUrl(directUrl, options) };
                }
                throw err;
            }
        }
        const directUrl = readVideoUrl(video);
        if (directUrl) return { status: "completed", result: await videoResultFromUrl(directUrl, options) };
        if (status === "failed") return { status: "failed", error: video.error?.message || "视频生成失败" };
        return { status: "pending" };
    } catch (error) {
        throw new Error(readAxiosError(error, "视频任务查询失败"));
    }
}

async function pollGrokImagineVideoTask(config: AiConfig, task: VideoGenerationTask, options?: RequestOptions): Promise<VideoGenerationTaskState> {
    try {
        const video = unwrapVideoResponse((await getWithProxyFallback<ApiVideoResponse>(config, `/videos/${task.id}`, options)).data);
        const status = normalizeTaskStatus(video.status || video.state || video.task_status);
        if (status === "completed") {
            const directUrl = readVideoUrl(video);
            if (directUrl) return { status: "completed", result: await videoResultFromUrl(resolveProviderUrl(config, directUrl), options) };
            try {
                const content = await getBlobWithProxyFallback(config, `/videos/${task.id}/content`, options);
                await assertVideoBlob(content.data);
                return { status: "completed", result: { blob: content.data } };
            } catch (error) {
                const direct = readVideoUrl(video);
                if (direct) return { status: "completed", result: await videoResultFromUrl(resolveProviderUrl(config, direct), options) };
                throw error;
            }
        }
        const directUrl = readVideoUrl(video);
        if (directUrl) return { status: "completed", result: await videoResultFromUrl(resolveProviderUrl(config, directUrl), options) };
        if (status === "failed") return { status: "failed", error: video.error?.message || "Grok Imagine 视频生成失败" };
        return { status: "pending" };
    } catch (error) {
        throw new Error(readAxiosError(error, "Grok Imagine 视频任务查询失败"));
    }
}

async function createSeedanceTask(config: AiConfig, model: string, prompt: string, references: ReferenceImage[], videoReferences: ReferenceVideo[], audioReferences: ReferenceAudio[], options?: RequestOptions): Promise<VideoGenerationTask> {
    if (audioReferences.length && !references.length && !videoReferences.length) {
        throw new Error("Seedance 参考音频不能单独使用，请同时添加参考图或参考视频");
    }
    assertSeedanceVideoReferences(videoReferences);
    assertSeedanceAudioReferences(audioReferences);
    const content = await buildSeedanceContent(config, prompt, references, videoReferences, audioReferences, options);
    if (!content.length) throw new Error("请输入视频提示词，或连接参考图片/视频/音频");
    const payload = {
        model: modelOptionName(model),
        content,
        ratio: normalizeSeedanceRatio(config.size),
        resolution: normalizeSeedanceResolution(config.vquality, modelOptionName(model)).toUpperCase(),
        duration: normalizeSeedanceDuration(config.videoSeconds),
        generate_audio: boolConfig(config.videoGenerateAudio, true),
        watermark: boolConfig(config.videoWatermark, false),
    };

    try {
        const created = unwrapSeedanceTask((await postSeedanceWithProxyFallback(config, payload, options)).data);
        if (!created.id) throw new Error("Seedance 接口没有返回任务 ID");
        return { id: created.id, provider: "seedance", model };
    } catch (error) {
        throw new Error(readAxiosError(error, "Seedance 任务创建失败"));
    }
}

async function pollSeedanceTask(config: AiConfig, task: VideoGenerationTask, options?: RequestOptions): Promise<VideoGenerationTaskState> {
    try {
        const state = unwrapSeedanceTask((await getSeedanceWithProxyFallback(config, task.id, options)).data);
        if (state.status === "succeeded") {
            const url = state.content?.video_url;
            if (!url) return { status: "failed", error: "Seedance 任务成功但没有返回视频 URL" };
            return { status: "completed", result: await videoResultFromUrl(url, options) };
        }
        if (state.status === "failed" || state.status === "cancelled" || state.status === "expired") return { status: "failed", error: state.error?.message || `Seedance 视频生成${state.status === "expired" ? "超时" : "失败"}` };
        return { status: "pending" };
    } catch (error) {
        throw new Error(readAxiosError(error, "Seedance 任务查询失败"));
    }
}

function assertSeedanceVideoReferences(videoReferences: ReferenceVideo[]) {
    const error = seedanceVideoReferenceError(videoReferences);
    if (error) throw new Error(error);
    let total = 0;
    for (const video of videoReferences) {
        if (!video.durationMs) continue;
        if (video.durationMs < 2000 || video.durationMs > 15000) throw new Error("Seedance 参考视频单个时长需要在 2-15 秒之间");
        total += video.durationMs;
    }
    if (total > 15000) throw new Error("Seedance 参考视频总时长不能超过 15 秒");
}

function assertSeedanceAudioReferences(audioReferences: ReferenceAudio[]) {
    let total = 0;
    for (const audio of audioReferences) {
        if (!audio.durationMs) continue;
        if (audio.durationMs < 2000 || audio.durationMs > 15000) throw new Error("Seedance 参考音频单个时长需要在 2-15 秒之间");
        total += audio.durationMs;
    }
    if (total > 15000) throw new Error("Seedance 参考音频总时长不能超过 15 秒");
}

function seedanceApiUrl(config: AiConfig, taskId?: string) {
    return buildAiApiUrl(config.baseUrl, `/contents/generations/tasks${taskId ? `/${encodeURIComponent(taskId)}` : ""}`, config.aiProxyEnabled);
}

async function buildSeedanceContent(config: AiConfig, prompt: string, references: ReferenceImage[], videoReferences: ReferenceVideo[], audioReferences: ReferenceAudio[], options?: RequestOptions) {
    const content: Array<Record<string, unknown>> = [];
    const text = buildSeedancePromptText(prompt, references, videoReferences, audioReferences);
    if (text) content.push({ type: "text", text });
    for (const image of references.slice(0, SEEDANCE_REFERENCE_LIMITS.images)) {
        content.push({ type: "image_url", image_url: { url: await resolveSeedanceImageUrl(image, options) }, role: "reference_image" });
    }
    for (const video of videoReferences.slice(0, SEEDANCE_REFERENCE_LIMITS.videos)) {
        content.push({ type: "video_url", video_url: { url: await resolveSeedanceVideoUrl(video, options) }, role: "reference_video" });
    }
    for (const audio of audioReferences.slice(0, SEEDANCE_REFERENCE_LIMITS.audios)) {
        content.push({ type: "audio_url", audio_url: { url: await resolveSeedanceAudioUrl(audio, options) }, role: "reference_audio" });
    }
    return content;
}

async function resolveSeedanceImageUrl(image: ReferenceImage, options?: RequestOptions) {
    const directUrl = String(image.url || image.dataUrl || "").trim();
    if (directUrl.startsWith("asset://")) return directUrl;
    if (isPublicMediaUrl(directUrl) && isCaiReachableUrl(directUrl)) return assertPublicReferenceReachable(directUrl, image.type || "image/*", "参考图", options);
    const file = await dataUrlToFile({ ...image, dataUrl: await imageToDataUrl(image) });
    return uploadReferenceFile(file, options);
}

async function resolveSeedanceVideoUrl(video: ReferenceVideo, options?: RequestOptions) {
    if (video.url.startsWith("asset://")) return video.url;
    if (isPublicMediaUrl(video.url) && isCaiReachableUrl(video.url)) return assertPublicReferenceReachable(video.url, video.type || "video/*", "参考视频", options);
    let blob: Blob | null = null;
    if (video.storageKey) blob = await getMediaBlob(video.storageKey);
    if (!blob && video.url?.startsWith("blob:")) blob = await (await fetch(video.url)).blob();
    if (!blob) throw new Error("参考视频必须是公网 URL、素材 ID，或本地已保存的视频");
    const file = new File([blob], video.name || "参考视频.mp4", { type: video.type || blob.type || "video/mp4" });
    return uploadReferenceFile(file, options);
}

async function resolveSeedanceAudioUrl(audio: ReferenceAudio, options?: RequestOptions) {
    if (audio.url.startsWith("asset://")) return audio.url;
    if (isPublicMediaUrl(audio.url) && isCaiReachableUrl(audio.url)) return assertPublicReferenceReachable(audio.url, audio.type || "audio/*", "参考音频", options);
    let blob: Blob | null = null;
    if (audio.storageKey) blob = await getMediaBlob(audio.storageKey);
    if (!blob && audio.url?.startsWith("blob:")) blob = await (await fetch(audio.url)).blob();
    if (!blob) throw new Error("参考音频必须是公网 URL、素材 ID，或本地已保存的音频");
    const file = new File([blob], audio.name || "参考音频.mp3", { type: audio.type || blob.type || "audio/mpeg" });
    return uploadReferenceFile(file, options);
}

async function videoResultFromUrl(url: string, options?: RequestOptions): Promise<VideoGenerationResult> {
    if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return { url, mimeType: "video/mp4" };
}

function assertVideoConfig(config: AiConfig, model: string) {
    if (!model) throw new Error("请先配置视频模型");
    if (!config.baseUrl.trim()) throw new Error("请先配置 Base URL");
    if (!config.apiKey.trim()) throw new Error("请先配置 Key");
    if (config.apiFormat === "gemini") throw new Error("Gemini 调用格式暂不支持视频生成，请使用 OpenAI 格式渠道");
}

function normalizeVideoSeconds(value: string) {
    const seconds = Math.floor(Number(value) || 6);
    return String(Math.max(1, Math.min(20, seconds)));
}

function normalizeVideoSize(value: string) {
    if (value === "auto") return null;
    const size = value || "1280x720";
    if (/^\d+x\d+$/.test(size)) return size;
    return ["9:16", "2:3", "3:4"].includes(size) ? "720x1280" : "1280x720";
}

function normalizeVideoResolution(value: string) {
    if (value === "low") return "480p";
    if (value === "auto" || value === "high" || value === "medium") return "720p";
    const resolution = value.replace(/p$/i, "") || "720";
    return `${resolution}p`;
}

function normalizeCaiDuration(value: string) {
    const duration = normalizeSeedanceDuration(value);
    return duration === -1 ? 10 : duration;
}

function normalizeCaiResolution(value: string) {
    const resolution = normalizeSeedanceResolution(value, "").toUpperCase();
    return resolution.endsWith("P") ? resolution : `${resolution.replace(/p$/i, "")}P`;
}

function normalizeLingdongDuration(value: string, model: string) {
    const duration = normalizeCaiDuration(value);
    if (modelOptionName(model).toLowerCase() === "sora-2") {
        if (duration <= 4) return 4;
        if (duration <= 8) return 8;
        return 12;
    }
    return Math.max(5, Math.min(15, duration));
}

function appendLingdongSize(payload: Record<string, any>, config: AiConfig, model: string) {
    const ratio = normalizeNewTokenAspectRatio(config.size);
    if (modelOptionName(model).toLowerCase() === "sora-2") {
        payload.orientation = ratio === "9:16" || ratio === "3:4" ? "portrait" : ratio === "1:1" ? "square" : "landscape";
        return;
    }
    payload.ratio = ratio;
}

function buildNewTokenVideoPayload(config: AiConfig, model: string, prompt: string, imageUrls: string[], videoUrls: string[], audioUrls: string[], videoMode = "text-to-video") {
    const modelName = modelOptionName(model);
    const lowerModel = modelName.toLowerCase();
    const aspectRatio = normalizeNewTokenAspectRatio(config.size);
    const payload: Record<string, any> = {
        model: modelName,
        prompt,
        duration: normalizeNewTokenDuration(config.videoSeconds, lowerModel),
        aspect_ratio: aspectRatio,
    };

    if (lowerModel.includes("grok-imagine-video-1.5")) {
        if (videoMode === "image-ref") throw new Error("Grok Imagine Video 1.5 不支持图片参考模式");
        if (!imageUrls.length) throw new Error("Grok Imagine Video 1.5 需要连接 1 张图片后才能生成视频");
        if (imageUrls.length > 1) throw new Error("Grok Imagine Video 1.5 仅支持 1 张图片输入");
        payload.input_reference = imageUrls[0];
        return payload;
    }

    if (lowerModel.includes("sora-vip3-pro")) {
        payload.seconds = String(normalizeNewTokenDuration(config.videoSeconds, lowerModel));
        payload.resolution = normalizeVideoResolution(config.vquality);
        if (imageUrls[0]) payload.image = imageUrls[0];
        return payload;
    }

    if (lowerModel === "sora-2") {
        if (imageUrls[0]) payload.image = imageUrls[0];
        return payload;
    }

    if (lowerModel === "veo-omni-flash-video-edit") {
        if (!videoUrls[0]) throw new Error("veo-omni-flash-video-edit 需要连接 1 个参考视频");
        payload.video_url = videoUrls[0];
        if (imageUrls.length) payload.Ingredients_images = imageUrls.slice(0, 6);
        return payload;
    }

    if (lowerModel === "veo-omni-flash") {
        if (imageUrls.length) payload.Ingredients_images = imageUrls.slice(0, 6);
        return payload;
    }

    if (lowerModel === "veo-3-1") {
        if (videoMode === "all-around" && imageUrls.length) payload.Ingredients_images = imageUrls.slice(0, 8);
        else if (imageUrls.length) payload.images = imageUrls.slice(0, videoMode === "first-last" ? 2 : 1);
        return payload;
    }

    if (lowerModel === "video-standard-720p" || lowerModel === "video-pro-720p" || lowerModel === "video-fast-720p") {
        if (imageUrls[0]) payload.image_url = imageUrls[0];
        if (imageUrls.length > 1) payload.extra_images = imageUrls.slice(1, 10);
        if (videoUrls.length) payload.extra_videos = videoUrls.slice(0, 3);
        if (audioUrls.length) payload.extra_audios = audioUrls.slice(0, 3);
        if (videoMode && videoMode !== "text-to-video") payload.reference_mode = videoMode;
        return payload;
    }

    if (imageUrls[0]) payload.image_url = imageUrls[0];
    if (imageUrls.length > 1) payload.extra_images = imageUrls.slice(1);
    if (videoUrls.length) payload.extra_videos = videoUrls;
    if (audioUrls.length) payload.extra_audios = audioUrls;
    return payload;
}

function normalizeNewTokenDuration(value: string, model: string) {
    if (model === "video-standard-720p") return 15;
    if (model === "veo-omni-flash" || model === "veo-omni-flash-video-edit") return 10;
    if (model === "veo-3-1") return 8;
    if (model === "sora-2") return 12;
    const seconds = Math.floor(Number(value) || 6);
    return Math.max(4, Math.min(15, seconds));
}

function normalizeNewTokenAspectRatio(value: string) {
    const ratio = normalizeSeedanceRatio(value);
    return ratio === "adaptive" ? "16:9" : ratio;
}

function buildDuomiSeedancePayload(config: AiConfig, model: string, prompt: string, imageUrls: string[], videoUrls: string[], audioUrls: string[]) {
    return {
        model,
        content: [
            { type: "text", text: prompt },
            ...imageUrls.slice(0, SEEDANCE_REFERENCE_LIMITS.images).map((url) => ({ type: "image_url", image_url: { url }, role: "reference_image" })),
            ...videoUrls.slice(0, SEEDANCE_REFERENCE_LIMITS.videos).map((url) => ({ type: "video_url", video_url: { url }, role: "reference_video" })),
            ...audioUrls.slice(0, SEEDANCE_REFERENCE_LIMITS.audios).map((url) => ({ type: "audio_url", audio_url: { url }, role: "reference_audio" })),
        ],
        generate_audio: boolConfig(config.videoGenerateAudio, true),
        ratio: normalizeNewTokenAspectRatio(config.size),
        duration: normalizeCaiDuration(config.videoSeconds),
        resolution: normalizeSeedanceResolution(config.vquality, model).toLowerCase(),
        watermark: boolConfig(config.videoWatermark, false),
    };
}

function buildDuomiGrokPayload(config: AiConfig, model: string, prompt: string, imageUrls: string[], videoMode = "text-to-video") {
    const duration = Math.max(6, Math.min(30, Math.floor(Number(config.videoSeconds) || 10)));
    const payload: Record<string, any> = {
        model,
        prompt,
        aspect_ratio: normalizeNewTokenAspectRatio(config.size),
        duration,
        quality: normalizeGrokImagineVideoResolution(config.vquality, model),
    };
    if (model.toLowerCase().includes("grok-imagine-video-1.5")) {
        if (videoMode === "image-ref") throw new Error("Grok Imagine Video 1.5 不支持图片参考模式");
        if (!imageUrls.length) throw new Error("Grok Imagine Video 1.5 需要连接 1 张图片后才能生成视频");
        if (imageUrls.length > 1) throw new Error("Grok Imagine Video 1.5 仅支持 1 张图片输入");
        payload.input_reference = imageUrls[0];
    } else {
        payload.image_urls = model === "grok-video-1.5" ? imageUrls.slice(0, 1) : imageUrls.slice(0, 7);
    }
    return payload;
}

function unwrapVideoResponse(payload: ApiVideoResponse) {
    return unwrapEnvelope(payload, "接口没有返回视频任务");
}

function unwrapSeedanceTask(payload: ApiEnvelope<SeedanceTask>) {
    return unwrapEnvelope(payload, "Seedance 接口没有返回任务");
}

function unwrapEnvelope<T>(payload: ApiEnvelope<T>, emptyMessage: string): T {
    if (!payload) throw new Error(emptyMessage);
    if (typeof payload === "object" && "code" in payload && typeof payload.code === "number") {
        if (payload.code !== 0 && payload.code !== 200) throw new Error(payload.msg || "请求失败");
        if (!payload.data) throw new Error(emptyMessage);
        return payload.data;
    }
    return payload as T;
}

function readVideoTaskId(payload: VideoResponse) {
    return String(payload.id || payload.request_id || payload.task_id || payload.taskId || payload.data?.id || payload.data?.request_id || payload.data?.task_id || "").trim();
}

function normalizeTaskStatus(status: string | undefined) {
    const value = String(status || "").toLowerCase();
    if (["completed", "complete", "succeeded", "success", "done"].includes(value)) return "completed";
    if (["failed", "failure", "error", "cancelled", "canceled", "expired"].includes(value)) return "failed";
    return "pending";
}

function readVideoUrl(payload: VideoResponse): string {
    const candidates = [
        payload.url,
        payload.video_url,
        payload.image_url,
        payload.output_url,
        payload.result_url,
        payload.content_url,
        payload.content?.video_url,
        payload.video?.url,
        payload.output?.url,
        payload.result?.url,
        payload.metadata?.result_urls?.[0],
        payload.data?.url,
        payload.data?.video_url,
        payload.data?.image_url,
        payload.data?.output_url,
        payload.data?.result_url,
        payload.data?.content_url,
        payload.data?.content?.video_url,
        payload.data?.videos?.[0]?.url,
        payload.data?.video?.url,
        payload.data?.output?.url,
        payload.data?.result?.url,
        payload.data?.metadata?.result_urls?.[0],
        Array.isArray(payload.output) ? payload.output[0]?.url || payload.output[0]?.video_url : undefined,
        Array.isArray(payload.data?.output) ? payload.data.output[0]?.url || payload.data.output[0]?.video_url : undefined,
    ];
    return String(candidates.find((url) => typeof url === "string" && url.trim()) || "").trim();
}

function resolveProviderUrl(config: AiConfig, url: string) {
    const value = url.trim();
    if (/^https?:\/\//i.test(value)) return value;
    const baseUrl = config.baseUrl.trim().replace(/\/+$/, "").replace(/\/v1$/i, "");
    return new URL(value, `${baseUrl}/`).toString();
}

function readAxiosError(error: unknown, fallback: string) {
    if (axios.isCancel(error)) return "请求已取消";
    if (axios.isAxiosError(error)) {
        const data = error.response?.data;
        const message = typeof data === "string" ? data.slice(0, 300) : responseErrorMessage(data);
        if (/origin is not allowed/i.test(message) && String(error.config?.url || "").startsWith("/api/proxy")) {
            return "同域代理拒绝了当前页面来源。请确认通过站点域名访问，或在配置中临时切到浏览器直连。";
        }
        return message || statusMessage(error.response?.status, fallback);
    }
    if (error instanceof DOMException && error.name === "AbortError") return "请求已取消";
    return error instanceof Error ? error.message : fallback;
}

function responseErrorMessage(value: unknown) {
    if (typeof value === "string") return value.slice(0, 300);
    if (!value || typeof value !== "object" || Array.isArray(value)) return "";
    const record = value as Record<string, unknown>;
    const error = record.error && typeof record.error === "object" && !Array.isArray(record.error) ? (record.error as Record<string, unknown>) : undefined;
    const response = record.response && typeof record.response === "object" && !Array.isArray(record.response) ? (record.response as Record<string, unknown>) : undefined;
    const responseError = response?.error && typeof response.error === "object" && !Array.isArray(response.error) ? (response.error as Record<string, unknown>) : undefined;
    return stringValue(record.message) || stringValue(record.msg) || stringValue(error?.message) || stringValue(error?.msg) || stringValue(responseError?.message);
}

function stringValue(value: unknown) {
    return typeof value === "string" ? value : "";
}

function statusMessage(status: number | undefined, fallback: string) {
    if (status === 401 || status === 403) return "鉴权失败，请检查 Key、套餐权限或模型权限";
    if (status === 408) return `${fallback}（408）：Cai 接口请求超时，请确认参考图片/视频/音频是公网 URL，不能使用本地 blob、dataURL 或浏览器本地素材`;
    if (status === 429) return "请求被限流或额度不足，请稍后重试";
    return status ? `${fallback}（${status}）` : fallback;
}

async function resolveCaiPublicUrl(value: string | undefined, label: string, mimeType: string, options?: RequestOptions) {
    const url = String(value || "").trim();
    if (isCaiReachableUrl(url)) return assertPublicReferenceReachable(url, mimeType, label, options);
    if (/^https?:\/\//i.test(url)) throw new Error(`${label}地址不是上游可访问的公网 HTTPS URL。静态前端版本不能代传本地素材，请先上传到对象存储或使用可被上游读取的 HTTPS 链接。`);
    throw new Error(`Cai 专用接口要求${label}必须是服务器可访问的公网 URL，当前本地素材不能直接提交。请先上传到对象存储或使用公网链接。`);
}

async function resolveCaiImageUrl(image: ReferenceImage, options?: RequestOptions) {
    const directUrl = String(image.url || image.dataUrl || "").trim();
    if (isCaiReachableUrl(directUrl)) return assertPublicReferenceReachable(directUrl, image.type || "image/*", "参考图片", options);
    const file = await dataUrlToFile({ ...image, dataUrl: await imageToDataUrl(image) });
    return uploadReferenceFile(file, options);
}

async function resolveCaiMediaUrl(media: ReferenceVideo | ReferenceAudio, label: string, options?: RequestOptions) {
    const directUrl = String(media.url || "").trim();
    if (isCaiReachableUrl(directUrl)) return assertPublicReferenceReachable(directUrl, media.type || (label.includes("音频") ? "audio/*" : "video/*"), label, options);
    let blob: Blob | null = null;
    if (media.storageKey) blob = await getMediaBlob(media.storageKey);
    if (!blob && directUrl.startsWith("blob:")) blob = await (await fetch(directUrl)).blob();
    if (!blob) return resolveCaiPublicUrl(directUrl, label, media.type || (label.includes("音频") ? "audio/*" : "video/*"), options);
    const file = new File([blob], media.name || `${label}.${media.type.includes("audio") ? "mp3" : "mp4"}`, { type: media.type || blob.type || "application/octet-stream" });
    return uploadReferenceFile(file, options);
}

async function resolveNewTokenImageUrl(image: ReferenceImage, options?: RequestOptions) {
    const directUrl = String(image.url || image.dataUrl || "").trim();
    if (isCaiReachableUrl(directUrl)) return assertPublicReferenceReachable(directUrl, image.type || "image/*", "NewToken 参考图片", options);
    const file = await dataUrlToFile({ ...image, dataUrl: await imageToDataUrl(image) });
    return uploadReferenceFile(file, options);
}

async function resolveNewTokenMediaUrl(media: ReferenceVideo | ReferenceAudio, label: string, options?: RequestOptions) {
    const directUrl = String(media.url || "").trim();
    if (isCaiReachableUrl(directUrl)) return assertPublicReferenceReachable(directUrl, media.type || (label.includes("音频") ? "audio/*" : "video/*"), label, options);
    let blob: Blob | null = null;
    if (media.storageKey) blob = await getMediaBlob(media.storageKey);
    if (!blob && directUrl.startsWith("blob:")) blob = await (await fetch(directUrl)).blob();
    if (!blob) return resolveCaiPublicUrl(directUrl, label, media.type || (label.includes("音频") ? "audio/*" : "video/*"), options);
    const file = new File([blob], media.name || `${label}.${media.type.includes("audio") ? "mp3" : "mp4"}`, { type: media.type || blob.type || "application/octet-stream" });
    return uploadReferenceFile(file, options);
}

async function uploadReferenceFile(file: File, options?: RequestOptions): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    debugLog("video", "上传参考素材", { name: file.name, type: file.type, bytes: file.size });
    try {
        const response = await axios.post<{ code?: number; data?: { url?: string }; msg?: string }>("/api/uploads/references", form, { signal: options?.signal });
        const url = response.data?.data?.url;
        if (!url) throw new Error(response.data?.msg || "参考素材上传失败");
        if (!isCaiReachableUrl(url)) throw new Error("参考素材已上传，但返回地址不是公网 HTTPS URL。请配置 C_AI_PUBLIC_BASE_URL 为当前站点公网 HTTPS 域名。");
        debugLog("video", "参考素材上传成功", { host: safeHost(url), bytes: file.size });
        return assertPublicReferenceReachable(url, file.type, "参考素材", options);
    } catch (error) {
        if (axios.isAxiosError(error) && (error.response?.status === 404 || !error.response)) {
            throw new Error("当前部署没有参考素材临时上传服务。Docker 版需启用 /api/uploads，并配置 C_AI_PUBLIC_BASE_URL。");
        }
        throw new Error(readAxiosError(error, "参考素材上传失败"));
    }
}

function safeHost(url: string) {
    try {
        return new URL(url).hostname;
    } catch {
        return "";
    }
}

type DataResponse<T> = { data: T };

function directApiUrl(config: AiConfig, path: string) {
    if (config.apiFormat === "duomiapi") {
        const baseUrl = config.baseUrl
            .trim()
            .replace(/\/+$/, "")
            .replace(/\/v1$/i, "")
            .replace(/\/api\/v3$/i, "");
        const normalizedPath = path.startsWith("/") ? path : `/${path}`;
        const prefix = normalizedPath.startsWith("/contents/") ? "/api/v3" : "/v1";
        return `${baseUrl}${prefix}${normalizedPath}`;
    }
    return buildAiApiUrl(config.baseUrl, path, false);
}

async function postWithProxyFallback<T>(config: AiConfig, path: string, body: unknown, contentType?: string, options?: RequestOptions): Promise<DataResponse<T>> {
    const proxyUrl = aiApiUrl(config, path);
    const directUrl = directApiUrl(config, path);
    debugLog("video", "POST 视频接口", { path, proxyUrl, directUrl, contentType: contentType || "multipart/form-data", payloadBytes: estimatePayloadBytes(body) });
    const request = (url: string): Promise<DataResponse<T>> => axios.post<T>(url, body, { headers: aiHeaders(config, contentType), signal: options?.signal });
    return withDirectFallback(request(proxyUrl), () => request(directUrl), { method: "POST", path });
}

async function getWithProxyFallback<T>(config: AiConfig, path: string, options?: RequestOptions): Promise<DataResponse<T>> {
    const proxyUrl = aiApiUrl(config, path);
    const directUrl = directApiUrl(config, path);
    debugLog("video", "GET 视频接口", { path, proxyUrl, directUrl });
    const request = (url: string): Promise<DataResponse<T>> => axios.get<T>(url, { headers: aiHeaders(config), signal: options?.signal });
    return withDirectFallback(request(proxyUrl), () => request(directUrl), { method: "GET", path });
}

async function getBlobWithProxyFallback(config: AiConfig, path: string, options?: RequestOptions): Promise<DataResponse<Blob>> {
    const proxyUrl = aiApiUrl(config, path);
    const directUrl = directApiUrl(config, path);
    debugLog("video", "GET 视频内容", { path, proxyUrl, directUrl });
    const request = (url: string): Promise<DataResponse<Blob>> => axios.get<Blob>(url, { headers: aiHeaders(config), responseType: "blob", signal: options?.signal });
    return withDirectFallback(request(proxyUrl), () => request(directUrl), { method: "GET-BLOB", path });
}

async function postSeedanceWithProxyFallback(config: AiConfig, payload: unknown, options?: RequestOptions) {
    const proxyUrl = seedanceApiUrl(config);
    const directUrl = seedanceApiUrl({ ...config, aiProxyEnabled: false });
    debugLog("video", "POST Seedance", { proxyUrl, directUrl, payloadBytes: estimatePayloadBytes(payload) });
    const request = (url: string) => axios.post<ApiEnvelope<SeedanceTask>>(url, payload, { headers: aiHeaders(config, "application/json"), signal: options?.signal });
    return withDirectFallback(request(proxyUrl), () => request(directUrl), { method: "POST", path: "seedance" });
}

async function getSeedanceWithProxyFallback(config: AiConfig, taskId: string, options?: RequestOptions) {
    const proxyUrl = seedanceApiUrl(config, taskId);
    const directUrl = seedanceApiUrl({ ...config, aiProxyEnabled: false }, taskId);
    debugLog("video", "GET Seedance", { taskId, proxyUrl, directUrl });
    const request = (url: string) => axios.get<ApiEnvelope<SeedanceTask>>(url, { headers: aiHeaders(config), signal: options?.signal });
    return withDirectFallback(request(proxyUrl), () => request(directUrl), { method: "GET", path: "seedance" });
}

async function withDirectFallback<T>(proxied: Promise<T>, direct: () => Promise<T>, meta?: { method?: string; path?: string }) {
    try {
        const result = await proxied;
        debugLog("video", "请求成功", { ...(meta || {}), via: "proxy-or-direct-url" });
        return result;
    } catch (error) {
        if (!shouldRetryDirect(error)) {
            debugError("video", "请求失败", { ...(meta || {}), error: summarizeAxiosError(error) });
            throw error;
        }
        debugWarn("video", "代理失败，尝试直连", { ...(meta || {}), error: summarizeAxiosError(error) });
        try {
            const result = await direct();
            debugLog("video", "直连成功", { ...(meta || {}) });
            return result;
        } catch (directError) {
            debugError("video", "直连也失败", { ...(meta || {}), proxyError: summarizeAxiosError(error), directError: summarizeAxiosError(directError) });
            if (axios.isAxiosError(directError) && directError.response) throw directError;
            throw error;
        }
    }
}

function shouldRetryDirect(error: unknown) {
    if (!axios.isAxiosError(error)) return false;
    const url = String(error.config?.url || "");
    if (!url.startsWith("/api/proxy")) return false;
    if (!error.response) return true;
    const status = error.response.status;
    return status === 403 || status === 408 || status === 502 || status === 504 || (status >= 520 && status <= 524) || isProxyHtmlError(error);
}

function isProxyHtmlError(error: unknown) {
    if (!axios.isAxiosError(error)) return false;
    const url = String(error.config?.url || "");
    if (!url.startsWith("/api/proxy")) return false;
    const contentType = String(error.response?.headers?.["content-type"] || "");
    return contentType.includes("text/html") || (typeof error.response?.data === "string" && /<html|forbidden|nginx/i.test(error.response.data));
}

async function assertPublicReferenceReachable(url: string, mimeType: string, label: string, options?: RequestOptions): Promise<string> {
    try {
        const response = await axios.head(url, { signal: options?.signal }).catch(async (error) => {
            if (axios.isCancel(error) || options?.signal?.aborted) throw error;
            await probeUploadedReference(url, mimeType, options);
            return null;
        });
        if (!response) return url;
        const contentType = String(response.headers["content-type"] || "").toLowerCase();
        const contentLength = Number(response.headers["content-length"] || 0);
        assertReferenceContentType(contentType, mimeType);
        if (contentLength <= 0) await probeUploadedReference(url, mimeType, options);
        return url;
    } catch (error) {
        if (axios.isCancel(error) || options?.signal?.aborted) throw error;
        const reason = error instanceof Error ? error.message : "无法访问";
        throw new Error(`${label}公网地址自检失败：${reason}。请确认 ${url} 可在公网无登录访问，且反向代理没有拦截 HEAD/GET Range 读取。`);
    }
}

async function probeUploadedReference(url: string, mimeType: string, options?: RequestOptions) {
    const response = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        signal: options?.signal,
        cache: "no-store",
    });
    if (!response.ok && response.status !== 206) throw new Error(`GET=${response.status}`);
    const contentType = response.headers.get("content-type")?.toLowerCase() || "";
    assertReferenceContentType(contentType, mimeType);
    const reader = response.body?.getReader();
    if (!reader) return;
    const result = await reader.read();
    await reader.cancel().catch(() => undefined);
    if (!result.done && result.value?.byteLength) return;
    throw new Error("GET 内容为空");
}

function assertReferenceContentType(contentType: string, mimeType: string) {
    if (!contentType) return;
    const expected = mimeType.toLowerCase();
    if (expected.startsWith("image/") && !contentType.startsWith("image/")) throw new Error(`Content-Type=${contentType}`);
    if (expected.startsWith("video/") && !contentType.startsWith("video/")) throw new Error(`Content-Type=${contentType}`);
    if (expected.startsWith("audio/") && !contentType.startsWith("audio/")) throw new Error(`Content-Type=${contentType}`);
}

function isCaiReachableUrl(value: string) {
    if (!/^https:\/\//i.test(value || "")) return false;
    try {
        const host = new URL(value).hostname.toLowerCase();
        return host !== "localhost" && host !== "127.0.0.1" && !host.endsWith(".local");
    } catch {
        return false;
    }
}

function isCaiSdModel(model: string) {
    const value = modelOptionName(model).toLowerCase();
    return value.includes("seedance") || value.includes("sd") || value === "videos" || value === "videos_stable";
}

function isLikelyCaiVideoChannel(baseUrl: string) {
    try {
        const host = new URL(baseUrl).hostname.toLowerCase();
        return host === "ai.772.ee" || host === "api.772.ee" || host.endsWith(".772.ee");
    } catch {
        return baseUrl.toLowerCase().includes("772.ee");
    }
}

function assertCaiVideoMode(model: string, imageUrls: string[], videoUrls: string[], audioUrls: string[], videoMode = "text-to-video") {
    const capabilities = caiVideoModelCapabilities(model);
    const mode = resolveCaiVideoMode(model, imageUrls, videoUrls, audioUrls, videoMode);
    assertGrokImagineVideo15Reference(model, imageUrls);
    if (mode === "text-to-video" && !capabilities.textToVideo) throw new Error("当前模型不支持纯文字生成视频，请先连接图片素材");
    if (mode === "first-last") {
        if (!capabilities.firstLastFrame) throw new Error("当前模型不支持首尾帧模式，请切换支持首尾帧的模型");
        if (imageUrls.length < 2) throw new Error("首尾帧模式需要连接 2 张图片");
    }
    if (mode === "all-around") {
        if (!capabilities.allAroundReference) throw new Error("当前模型不支持全能参考，请切换支持全能参考的模型");
        if (!imageUrls.length && !videoUrls.length && !audioUrls.length) throw new Error("全能参考需要先连接图片、视频或音频素材");
        if (audioUrls.length && !imageUrls.length && !videoUrls.length) throw new Error("全能参考音频需要配合图片或视频素材使用");
        if (imageUrls.length > 4) throw new Error("全能参考图片最多 4 张");
        if (videoUrls.length > 3) throw new Error("全能参考视频最多 3 个");
        if (imageUrls.length + videoUrls.length > 5) throw new Error("全能参考图片和视频合计最多 5 个");
    }
}

function assertGrokImagineVideo15Reference(model: string, imageUrls: string[]) {
    if (!caiVideoModelCapabilities(model).requiresImage) return;
    if (!imageUrls.length) throw new Error("Grok Imagine Video 1.5 需要连接 1 张图片后才能生成视频");
    if (imageUrls.length > 1) throw new Error("Grok Imagine Video 1.5 仅支持 1 张图片输入");
}

function appendCaiReferences(payload: Record<string, any>, model: string, imageUrls: string[], videoUrls: string[], audioUrls: string[], videoMode = "text-to-video") {
    const capabilities = caiVideoModelCapabilities(model);
    const mode = resolveCaiVideoMode(model, imageUrls, videoUrls, audioUrls, videoMode);
    if (capabilities.allAroundReference && (mode === "all-around" || mode === "first-last")) {
        appendSeedanceCaiReferences(payload, imageUrls, videoUrls, audioUrls, mode);
        return;
    }
    if (capabilities.allAroundReference && imageUrls.length > 0) {
        payload.images = imageUrls;
        payload.input_reference = imageUrls[0];
        return;
    }
    if (capabilities.requiresImage && imageUrls[0]) {
        payload.input_reference = imageUrls[0];
        return;
    }
    if (imageUrls.length > 0) {
        payload.input_reference = imageUrls.length === 1 ? imageUrls[0] : imageUrls.slice(0, 7).map((url) => ({ image_url: url }));
    }
}

function resolveCaiVideoMode(model: string, imageUrls: string[], videoUrls: string[], audioUrls: string[], videoMode: string) {
    if (videoMode && videoMode !== "text-to-video") return videoMode;
    const capabilities = caiVideoModelCapabilities(model);
    if (capabilities.allAroundReference && (videoUrls.length || audioUrls.length)) return "all-around";
    if (capabilities.requiresImage && imageUrls.length) return "image-to-video";
    return videoMode || "text-to-video";
}

function appendSeedanceCaiReferences(payload: Record<string, any>, imageUrls: string[], videoUrls: string[], audioUrls: string[], videoMode: string) {
    if (videoMode === "first-last") {
        payload.metadata = {
            ...(payload.metadata || {}),
            media: [
                { type: "first_frame", url: imageUrls[0] },
                { type: "last_frame", url: imageUrls[1] },
            ],
        };
        return;
    }
    if (videoMode === "all-around") {
        const media = [
            ...imageUrls.slice(0, 4).map((url, index) => ({
                type: "reference_image",
                url,
                ...(index === 0 && audioUrls[0] ? { reference_voice: audioUrls[0] } : {}),
            })),
            ...videoUrls.slice(0, 3).map((url) => ({ type: "reference_video", url })),
        ].slice(0, 5);
        if (media.length) payload.metadata = { ...(payload.metadata || {}), media };
        return;
    }
    if (imageUrls.length > 0) {
        payload.images = imageUrls;
        payload.input_reference = imageUrls[0];
    }
}

async function assertVideoBlob(blob: Blob) {
    if (!blob.type.includes("json")) return;
    let payload: { code?: number; msg?: string; error?: { message?: string } };
    try {
        payload = JSON.parse(await blob.text()) as { code?: number; msg?: string; error?: { message?: string } };
    } catch {
        return;
    }
    if (typeof payload.code === "number" && payload.code !== 0) throw new Error(payload.msg || "视频下载失败");
    if (payload.error?.message) throw new Error(payload.error.message);
}

function isPublicMediaUrl(value: string) {
    return /^https?:\/\//i.test(value || "");
}

function delay(ms: number, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
        }
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener(
            "abort",
            () => {
                clearTimeout(timer);
                reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
        );
    });
}
