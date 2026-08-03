import axios from "axios";

import { compressImageDataUrl, dataUrlToFile, getDataUrlByteSize } from "@/lib/image-utils";
import { debugError, debugLog, debugWarn, estimatePayloadBytes, summarizeAxiosError } from "@/lib/debug-log";
import { getMediaBlob, uploadMediaFile, type UploadedFile } from "@/services/file-storage";
import { imageToDataUrl } from "@/services/image-storage";
import { isGrokImagineVideo15Model, isGrokImagineVideoModel, normalizeGrokImagineVideoDuration, normalizeGrokImagineVideoRatio, normalizeGrokImagineVideoResolution } from "@/lib/grok-imagine";
import { buildSeedancePromptText, caiVideoModelCapabilities } from "@/lib/seedance-video";
import { isVideos4VideoModel, normalizeVideos4Duration, normalizeVideos4Ratio, normalizeVideos4Resolution, VIDEOS4_POLL_INTERVAL_MS, VIDEOS4_REFERENCE_LIMITS } from "@/lib/videos4-video";
import { buildAiApiUrl, modelOptionName, resolveModelRequestConfig, type AiConfig } from "@/stores/use-config-store";
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
export type VideoGenerationTask = { id: string; provider: "openai" | "seedance" | "videos4"; model: string };
export type VideoGenerationTaskState = { status: "pending" } | { status: "completed"; result: VideoGenerationResult } | { status: "failed"; error: string };

function aiApiUrl(config: AiConfig, path: string) {
    return buildAiApiUrl(config.baseUrl, path, config.aiProxyEnabled);
}

function aiHeaders(config: AiConfig, contentType?: string) {
    return {
        Authorization: `Bearer ${config.apiKey}`,
        ...(contentType ? { "Content-Type": contentType } : {}),
    };
}

function withSystemPrompt(config: AiConfig, prompt: string) {
    const systemPrompt = config.systemPrompt.trim();
    return systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
}

export async function requestVideoGeneration(config: AiConfig, prompt: string, references: ReferenceImage[] = [], videoReferences: ReferenceVideo[] = [], audioReferences: ReferenceAudio[] = [], options?: RequestOptions): Promise<VideoGenerationResult> {
    const task = await createVideoGenerationTask(config, prompt, references, videoReferences, audioReferences, options);
    const delayMs = task.provider === "seedance" ? 5000 : task.provider === "videos4" ? VIDEOS4_POLL_INTERVAL_MS : 2500;
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
        if (isVideos4VideoModel(requestConfig.model)) {
            return await createVideos4VideoTask(requestConfig, selectedModel, prompt, references, videoReferences, audioReferences, options);
        }
        if (isGrokImagineVideoModel(requestConfig.model)) {
            return await createGrokImagineVideoTask(requestConfig, selectedModel, prompt, references, videoReferences, audioReferences, options);
        }
        if (videoReferences.length || audioReferences.length) {
            throw new Error("当前视频接口不支持参考视频或参考音频，请移除参考素材");
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
    if (isGrokImagineVideoModel(task.model)) return pollGrokImagineVideoTask(requestConfig, task, options);
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

async function createVideos4VideoTask(config: AiConfig, model: string, prompt: string, references: ReferenceImage[], videoReferences: ReferenceVideo[], audioReferences: ReferenceAudio[], options?: RequestOptions): Promise<VideoGenerationTask> {
    const modelName = modelOptionName(model);
    if (options?.videoMode === "first-last") throw new Error("videos-4 系列暂不支持首尾帧生成");
    if (references.length > VIDEOS4_REFERENCE_LIMITS.images) throw new Error(`参考图片最多 ${VIDEOS4_REFERENCE_LIMITS.images} 张`);
    if (videoReferences.length > VIDEOS4_REFERENCE_LIMITS.videos) throw new Error(`参考视频最多 ${VIDEOS4_REFERENCE_LIMITS.videos} 个`);
    if (audioReferences.length > VIDEOS4_REFERENCE_LIMITS.audios) throw new Error(`参考音频最多 ${VIDEOS4_REFERENCE_LIMITS.audios} 个`);

    const requestPrompt = buildSeedancePromptText(prompt, references, videoReferences, audioReferences);
    const [imageUrls, videoUrls, audioUrls] = await Promise.all([
        Promise.all(references.map((image) => resolveVideos4ImageUrl(image, options))),
        Promise.all(videoReferences.map((video) => resolveVideos4MediaUrl(video, "参考视频", options))),
        Promise.all(audioReferences.map((audio) => resolveVideos4MediaUrl(audio, "参考音频", options))),
    ]);

    const payload: Record<string, any> = {
        model: modelName,
        prompt: withSystemPrompt(config, requestPrompt),
        duration: normalizeVideos4Duration(config.videoSeconds),
        ratio: normalizeVideos4Ratio(config.size),
        resolution: normalizeVideos4Resolution(config.vquality, modelName),
    };
    if (imageUrls.length) payload.referenceImages = imageUrls;
    if (videoUrls.length) payload.referenceVideos = videoUrls;
    if (audioUrls.length) payload.referenceAudios = audioUrls;

    try {
        const created = unwrapVideoResponse((await postWithProxyFallback<ApiVideoResponse>(config, "/videos", payload, "application/json", options)).data);
        const taskId = readVideoTaskId(created);
        if (!taskId) throw new Error("视频接口没有返回任务 ID");
        return { id: taskId, provider: "videos4", model };
    } catch (error) {
        throw new Error(readAxiosError(error, "视频任务创建失败"));
    }
}

/** videos-4 参考素材只接受公网 http/https，本地素材需先上传。 */
async function resolveVideos4ImageUrl(image: ReferenceImage, options?: RequestOptions) {
    const directUrl = String(image.url || "").trim();
    if (isCaiReachableUrl(directUrl)) return directUrl;
    const file = await dataUrlToFile({ ...image, dataUrl: await imageToDataUrl(image) });
    return uploadReferenceFile(file, options);
}

async function resolveVideos4MediaUrl(media: ReferenceVideo | ReferenceAudio, label: string, options?: RequestOptions) {
    const directUrl = String(media.url || "").trim();
    if (isCaiReachableUrl(directUrl)) return directUrl;
    const blob = media.storageKey ? await getMediaBlob(media.storageKey) : undefined;
    if (!blob) throw new Error(`${label}需要公网 HTTPS 地址，请先上传后再提交`);
    const file = new File([blob], media.name || label, { type: media.type || blob.type });
    return uploadReferenceFile(file, options);
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

async function videoResultFromUrl(url: string, options?: RequestOptions): Promise<VideoGenerationResult> {
    if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return { url, mimeType: "video/mp4" };
}

function assertVideoConfig(config: AiConfig, model: string) {
    if (!model) throw new Error("请先配置视频模型");
    if (!config.baseUrl.trim()) throw new Error("请先配置 Base URL");
    if (!config.apiKey.trim()) throw new Error("请先配置 Key");
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

function unwrapVideoResponse(payload: ApiVideoResponse) {
    return unwrapEnvelope(payload, "接口没有返回视频任务");
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
        payload.metadata?.content_url,
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

function assertGrokImagineVideo15Reference(model: string, imageUrls: string[]) {
    if (!caiVideoModelCapabilities(model).requiresImage) return;
    if (!imageUrls.length) throw new Error("Grok Imagine Video 1.5 需要连接 1 张图片后才能生成视频");
    if (imageUrls.length > 1) throw new Error("Grok Imagine Video 1.5 仅支持 1 张图片输入");
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
