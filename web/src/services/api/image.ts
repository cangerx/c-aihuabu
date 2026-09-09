import axios from "axios";

import { grokImagineImageEditMaxCount, grokImagineImageMaxCount, isGrokImagineImageModel, normalizeGrokImagineImageRatio, normalizeGrokImagineImageResolution } from "@/lib/grok-imagine";
import { isGeminiImagePreviewModel, isGptImage2Model, normalizeGeminiImageRatio, normalizeGeminiImageResolution, normalizeGptImage2Ratio, normalizeGptImage2Resolution, resolveGptImage2Size } from "@/lib/gpt-image-2";
import { isStepImageEdit2Model, normalizeStepImageEdit2Size } from "@/lib/step-image";
import { glmImageApiDimensions, isGlmImageModel, isZImageTurboModel, normalizeGlmImageSteps } from "@/lib/glm-image";
import { debugError, debugLog, debugWarn, estimatePayloadBytes, summarizeAxiosError } from "@/lib/debug-log";
import { buildAiApiUrl, buildApiUrl, buildProxiedUrl, modelOptionName, resolveModelRequestConfig, type AiConfig, type ModelChannel } from "@/stores/use-config-store";
import { nanoid } from "nanoid";
import { dataUrlToFile } from "@/lib/image-utils";
import { buildImageReferencePromptText } from "@/lib/image-reference-prompt";
import { imageToDataUrl } from "@/services/image-storage";
import type { ReferenceImage } from "@/types/image";

export type AiTextMessage = {
    role: "system" | "user" | "assistant";
    content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
};

export type ResponseToolCall = {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
    thoughtSignature?: string;
};

export type ResponseInputMessage =
    | AiTextMessage
    | { type: "function_call"; call_id: string; name: string; arguments: string; thoughtSignature?: string }
    | { role: "tool"; tool_call_id: string; content: string };

export type ResponseFunctionTool = {
    type: "function";
    function: {
        name: string;
        description?: string;
        parameters: Record<string, unknown>;
        strict?: boolean;
    };
};

export type ToolResponseResult = {
    content: string;
    toolCalls: ResponseToolCall[];
};

type ToolChoice = "auto" | "required" | { type: "function"; name: string };
type ResponseMessageContent = AiTextMessage["content"] | string;
type ResponseInputContent = { type: "input_text"; text: string } | { type: "input_image"; image_url: string };
type ResponseInputItem =
    | { role: "system" | "user" | "assistant"; content: string | ResponseInputContent[] }
    | { type: "function_call"; call_id: string; name: string; arguments: string }
    | { type: "function_call_output"; call_id: string; output: string };
type ResponseApiToolDefinition = {
    type: "function";
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
    strict?: boolean;
};
type ResponseApiOutputItem =
    | { type?: "message"; content?: Array<{ type?: string; text?: string }> }
    | { type?: "function_call"; id?: string; call_id?: string; name?: string; arguments?: string };
type ResponseApiPayload = {
    id?: string;
    output?: ResponseApiOutputItem[];
    output_text?: string;
    error?: { message?: string };
    code?: number;
    msg?: string;
};
type ChatInputMessage =
    | AiTextMessage
    | { role: "assistant"; content: string | null; tool_calls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> }
    | { role: "tool"; tool_call_id: string; content: string };
type ChatToolDefinition = {
    type: "function";
    function: {
        name: string;
        description?: string;
        parameters: Record<string, unknown>;
        strict?: boolean;
    };
};
type ChatCompletionPayload = {
    choices?: Array<{
        message?: { content?: string | null; images?: Array<{ image_url?: { url?: string } }>; tool_calls?: Array<{ id?: string; type?: string; function?: { name?: string; arguments?: string } }> };
    }>;
    error?: { message?: string };
    code?: number;
    msg?: string;
};
type ResponseStreamState = { buffer: string; text: string; payload?: ResponseApiPayload; error?: string };

type ImageApiResponse = {
    data?: Array<Record<string, unknown>> | Record<string, unknown>;
    images?: Array<Record<string, unknown>>;
    output?: Array<Record<string, unknown>> | Record<string, unknown>;
    result?: { data?: Array<Record<string, unknown>>; images?: Array<Record<string, unknown>> };
    url?: string;
    image_url?: string;
    b64_json?: string;
    error?: string | { message?: string; msg?: string };
    code?: number | string;
    msg?: string;
    message?: string;
};
type ImageTaskResponse = {
    id?: string;
    task_id?: string;
    taskId?: string;
    status?: string;
    state?: string;
    task_status?: string;
    url?: string;
    image_url?: string;
    output_url?: string;
    metadata?: { result_urls?: string[] };
    output?: { url?: string; image_url?: string }[] | { url?: string; image_url?: string };
    data?: ImageTaskResponse | null;
    error?: { message?: string };
    code?: number;
    msg?: string;
};
type GeminiPart = {
    text?: string;
    inlineData?: { mimeType?: string; data?: string };
    inline_data?: { mime_type?: string; mimeType?: string; data?: string };
    fileData?: { mimeType?: string; fileUri?: string };
    functionCall?: { id?: string; name?: string; args?: Record<string, unknown> };
    functionResponse?: { id?: string; name?: string; response?: Record<string, unknown> };
    thoughtSignature?: string;
    thought_signature?: string;
};
type GeminiContent = { role?: "user" | "model"; parts: GeminiPart[] };
type GeminiPayload = {
    candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
    models?: Array<{ name?: string }>;
    error?: { message?: string };
    promptFeedback?: { blockReason?: string };
};
type GeminiStreamState = { buffer: string; text: string; toolCalls: ResponseToolCall[]; error?: string };
type RequestOptions = { signal?: AbortSignal };

const QUALITY_BASE: Record<string, number> = {
    low: 1024,
    medium: 2048,
    high: 2880,
    standard: 1024,
    hd: 2048,
};
const QUALITY_ALIASES: Record<string, string> = {
    "1k": "low",
    "2k": "medium",
    "4k": "high",
};
const DEFAULT_IMAGE_SHORT_SIDE = 1024;
const IMAGE_SIZE_STEP = 16;
const IMAGE_MIN_PIXELS = 655360;
const IMAGE_MAX_PIXELS = 8294400;
const IMAGE_MAX_EDGE = 3840;
const IMAGE_MAX_RATIO = 3;
const IMAGE_OUTPUT_FORMAT = "png";
const NEW_TOKEN_IMAGE_TIMEOUT_MS = 30 * 60 * 1000;
const NEW_TOKEN_IMAGE_POLL_MS = 2500;

function normalizeQuality(quality: string) {
    const value = quality.trim().toLowerCase();
    const normalized = QUALITY_ALIASES[value] || value;
    return QUALITY_BASE[normalized] ? normalized : undefined;
}

/** Map "quality + ratio" to an explicit pixel dimension like "3840x2160". */
function resolveSize(quality: string | undefined, ratio: string): string {
    const parsedRatio = parseImageRatio(ratio);
    const basePixels = quality ? QUALITY_BASE[quality] : undefined;
    const isLandscape = parsedRatio.width >= parsedRatio.height;
    const longRatio = isLandscape ? parsedRatio.width / parsedRatio.height : parsedRatio.height / parsedRatio.width;
    let longSide: number;
    let shortSide: number;

    if (basePixels) {
        const targetPixels = basePixels * basePixels;
        const longSideRaw = Math.sqrt(targetPixels * longRatio);
        longSide = Math.floor(longSideRaw / IMAGE_SIZE_STEP) * IMAGE_SIZE_STEP;
        shortSide = Math.round(longSide / longRatio / IMAGE_SIZE_STEP) * IMAGE_SIZE_STEP;
    } else {
        shortSide = DEFAULT_IMAGE_SHORT_SIDE;
        longSide = Math.round((shortSide * longRatio) / IMAGE_SIZE_STEP) * IMAGE_SIZE_STEP;
    }

    const width = isLandscape ? longSide : shortSide;
    const height = isLandscape ? shortSide : longSide;
    validateImageSize(width, height);
    return `${width}x${height}`;
}

function parseImageRatio(value: string) {
    const parts = value.split(":");
    if (parts.length !== 2) throw new Error("图像尺寸格式不支持，请使用 auto、9:16 或 1024x1024");
    const w = Number(parts[0]);
    const h = Number(parts[1]);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) throw new Error("图像比例必须是正数，例如 9:16");
    if (Math.max(w, h) / Math.min(w, h) > IMAGE_MAX_RATIO) throw new Error("图像宽高比不能超过 3:1，请调整尺寸");
    return { width: w, height: h };
}

function parseImageDimensions(value: string) {
    const match = value.match(/^(\d+)x(\d+)$/i);
    if (!match) return null;
    return { width: Number(match[1]), height: Number(match[2]) };
}

function validateImageSize(width: number, height: number) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) throw new Error("图像尺寸必须是正整数，例如 1024x1024");
    if (width % IMAGE_SIZE_STEP !== 0 || height % IMAGE_SIZE_STEP !== 0) throw new Error("图像尺寸的宽高必须是 16 的倍数，请调整尺寸");
    if (Math.max(width, height) > IMAGE_MAX_EDGE) throw new Error("图像尺寸最长边不能超过 3840px，请调整尺寸");
    if (Math.max(width, height) / Math.min(width, height) > IMAGE_MAX_RATIO) throw new Error("图像宽高比不能超过 3:1，请调整尺寸");
    const pixels = width * height;
    if (pixels < IMAGE_MIN_PIXELS || pixels > IMAGE_MAX_PIXELS) throw new Error("图像总像素需在 655360 到 8294400 之间，请调整尺寸");
}

function resolveRequestSize(quality: string | undefined, size: string) {
    const value = size.trim();
    if (!value || value.toLowerCase() === "auto") return undefined;
    const dimensions = parseImageDimensions(value);
    if (dimensions) {
        validateImageSize(dimensions.width, dimensions.height);
        return `${dimensions.width}x${dimensions.height}`;
    }
    if (value.includes(":")) return resolveSize(quality, value);
    throw new Error("图像尺寸格式不支持，请使用 auto、9:16 或 1024x1024");
}

function resolveImageDataUrl(item: Record<string, unknown>) {
    // URL 优先：原生接口 12s 出图后响应体小，可立刻展示；b64 作补充。
    const url = pickString(item.url) || pickString(item.image_url) || pickString(item.output_url) || pickString(item.image_base64) || pickNestedString(item, ["image", "url"]) || pickNestedString(item, ["image_url", "url"]);
    if (url && (/^https?:\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:"))) return url;
    const b64 = pickString(item.b64_json) || pickString(item.b64) || pickString(item.base64) || pickString(item.image_base64) || pickNestedString(item, ["image", "b64_json"]) || pickNestedString(item, ["image", "b64"]) || (typeof item.image === "string" ? item.image : "");
    if (b64) return b64.startsWith("data:") ? b64 : b64;
    return null;
}

function pickString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : "";
}

function pickNestedString(item: Record<string, unknown>, path: string[]) {
    let current: unknown = item;
    for (const key of path) {
        if (!current || typeof current !== "object" || Array.isArray(current)) return "";
        current = (current as Record<string, unknown>)[key];
    }
    return pickString(current);
}

function asImageRows(value: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
    if (value && typeof value === "object") return [value as Record<string, unknown>];
    return [];
}

function readImageApiError(payload: ImageApiResponse) {
    if (typeof payload.error === "string" && payload.error.trim()) return payload.error.trim();
    if (payload.error && typeof payload.error === "object") {
        const message = pickString(payload.error.message) || pickString(payload.error.msg);
        if (message) return message;
    }
    if (typeof payload.code === "number" && payload.code !== 0) return pickString(payload.msg) || pickString(payload.message) || "请求失败";
    if (typeof payload.code === "string" && payload.code && !/^(0|ok|success)$/i.test(payload.code)) {
        return pickString(payload.msg) || pickString(payload.message) || payload.code;
    }
    return "";
}

function parseImagePayload(payload: ImageApiResponse) {
    const apiError = readImageApiError(payload);
    if (apiError) throw new Error(apiError);
    const rows = [
        ...asImageRows(payload.data),
        ...asImageRows(payload.images),
        ...asImageRows(payload.output),
        ...asImageRows(payload.result?.data),
        ...asImageRows(payload.result?.images),
    ];
    if (!rows.length && (payload.url || payload.image_url || payload.b64_json)) {
        rows.push(payload as unknown as Record<string, unknown>);
    }
    const images = rows
        .map(resolveImageDataUrl)
        .filter((value): value is string => Boolean(value))
        .map((dataUrl) => ({ id: nanoid(), dataUrl }));

    if (images.length === 0) {
        throw new Error("接口没有返回图片");
    }

    return images;
}

function unwrapImageTask(payload: ImageTaskResponse): ImageTaskResponse {
    if (typeof payload.code === "number" && payload.code !== 0) throw new Error(payload.msg || "请求失败");
    if (payload.error?.message) throw new Error(payload.error.message);
    return payload.data && typeof payload.data === "object" ? payload.data : payload;
}

function readImageTaskId(payload: ImageTaskResponse) {
    return String(payload.id || payload.task_id || payload.taskId || "").trim();
}

function normalizeImageTaskStatus(status: string | undefined) {
    const value = String(status || "").toLowerCase();
    if (["completed", "complete", "succeeded", "success", "done"].includes(value)) return "completed";
    if (["failed", "failure", "error", "cancelled", "canceled", "expired", "rejected", "content_filter"].includes(value)) return "failed";
    return "pending";
}

function readAsyncImageUrl(payload: ImageTaskResponse): string {
    const output = Array.isArray(payload.output) ? payload.output[0] : payload.output;
    const candidates = [
        payload.image_url,
        payload.url,
        payload.output_url,
        payload.metadata?.result_urls?.[0],
        output?.image_url,
        output?.url,
        payload.data?.image_url,
        payload.data?.url,
        payload.data?.output_url,
        payload.data?.metadata?.result_urls?.[0],
    ];
    return String(candidates.find((url) => typeof url === "string" && url.trim()) || "").trim();
}

function readAxiosError(error: unknown, fallback: string) {
    if (axios.isCancel(error)) return "请求已取消";
    if (axios.isAxiosError<{ error?: { message?: string }; msg?: string; code?: number }>(error)) {
        const responseData = error.response?.data;
        if (isProxyOriginDenied(error)) return "同域代理拒绝了当前页面来源。请确认通过站点域名访问，或在配置中临时切到浏览器直连。";
        if (isProxyHtmlError(error)) return "同域代理请求被拦截，请切换为浏览器直连或更新代理服务";
        return responseErrorMessage(responseData) || readStatusError(error.response?.status, fallback, error);
    }
    if (error instanceof DOMException && error.name === "AbortError") return "请求已取消";
    return error instanceof Error ? error.message : fallback;
}

function readStatusError(status: number | undefined, fallback: string, error?: unknown) {
    if ((status === 401 || status === 403) && isProxyRequest(error)) {
        return "同域代理请求失败（401/403）。若刚升级过代理，请重新部署；也可临时切到浏览器直连排查。";
    }
    if (status === 401 || status === 403) return "鉴权失败，请检查 Key、套餐权限或模型权限";
    if (status === 429) return "请求被限流或额度不足，请稍后重试";
    return status ? `${fallback}：${status}` : fallback;
}

function isProxyRequest(error: unknown) {
    if (!axios.isAxiosError(error)) return false;
    return String(error.config?.url || "").startsWith("/api/proxy");
}

function isProxyOriginDenied(error: unknown) {
    if (!isProxyRequest(error) || !axios.isAxiosError(error)) return false;
    const data = error.response?.data;
    const text = typeof data === "string" ? data : responseErrorMessage(data);
    return /origin is not allowed/i.test(text);
}

function withSystemPrompt(config: AiConfig, prompt: string) {
    const systemPrompt = config.systemPrompt.trim();
    return systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
}

function aiApiUrl(config: AiConfig, path: string) {
    return buildAiApiUrl(config.baseUrl, path, config.aiProxyEnabled);
}

function aiHeaders(config: AiConfig, contentType?: string) {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("c-aihuabu:member-token") || "" : "";
    return {
        Authorization: `Bearer ${config.apiKey}`,
        ...(contentType ? { "Content-Type": contentType } : {}),
        ...(token ? { "X-C-AI-User-Token": token } : {}),
        "X-C-AI-Model": modelOptionName(config.model),
        "X-C-AI-Media-Type": "image",
    };
}

function geminiBaseUrl(config: Pick<AiConfig, "baseUrl">) {
    const normalizedBaseUrl = config.baseUrl.trim().replace(/\/+$/, "");
    const lowerBaseUrl = normalizedBaseUrl.toLowerCase();
    // 兼容 aicost/Cai：Base 以 /v1 结尾时改为 /v1beta
    if (lowerBaseUrl.endsWith("/v1beta")) return normalizedBaseUrl;
    if (lowerBaseUrl.endsWith("/v1")) return `${normalizedBaseUrl.slice(0, -3)}/v1beta`;
    return `${normalizedBaseUrl}/v1beta`;
}

function geminiModelName(model: string) {
    return model.trim().replace(/^models\//, "");
}

function geminiApiUrl(config: Pick<AiConfig, "baseUrl" | "model"> & Partial<Pick<AiConfig, "aiProxyEnabled">>, action?: "generateContent" | "streamGenerateContent") {
    const baseUrl = geminiBaseUrl(config);
    const targetUrl = !action ? `${baseUrl}/models` : `${baseUrl}/models/${encodeURIComponent(geminiModelName(config.model))}:${action}`;
    return buildProxiedUrl(targetUrl, config.aiProxyEnabled);
}

function geminiHeaders(config: Pick<AiConfig, "apiKey" | "baseUrl">): Record<string, string> {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("c-aihuabu:member-token") || "" : "";
    if (config.baseUrl.toLowerCase().includes("generativelanguage.googleapis.com")) {
        return { "x-goog-api-key": config.apiKey, "Content-Type": "application/json", ...(token ? { "X-C-AI-User-Token": token } : {}) };
    }
    return {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        ...(token ? { "X-C-AI-User-Token": token } : {}),
    };
}

function withSystemMessage<T extends ResponseInputMessage>(config: AiConfig, messages: T[]): ResponseInputMessage[] {
    const systemPrompt = config.systemPrompt.trim();
    return systemPrompt ? [{ role: "system" as const, content: systemPrompt }, ...messages] : messages;
}

function toResponseInput(messages: ResponseInputMessage[]): ResponseInputItem[] {
    return messages.flatMap((message): ResponseInputItem[] => {
        if ("type" in message) return [message];
        if (message.role === "tool") return [{ type: "function_call_output", call_id: message.tool_call_id, output: message.content }];
        return [{ role: message.role, content: toResponseContent(message.content || "") }];
    });
}

function toChatMessages(messages: ResponseInputMessage[]): ChatInputMessage[] {
    return messages.flatMap((message): ChatInputMessage[] => {
        if ("type" in message) {
            return [{ role: "assistant", content: null, tool_calls: [{ id: message.call_id, type: "function", function: { name: message.name, arguments: message.arguments } }] }];
        }
        if (message.role === "tool") return [message];
        return [{ role: message.role, content: message.content }];
    });
}

function toResponseContent(content: ResponseMessageContent): string | ResponseInputContent[] {
    if (!Array.isArray(content)) return String(content || "");
    return content.map((item) => (item.type === "text" ? { type: "input_text" as const, text: item.text } : { type: "input_image" as const, image_url: item.image_url.url }));
}

function toResponseTool(tool: ResponseFunctionTool): ResponseApiToolDefinition {
    return {
        type: "function",
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
        strict: tool.function.strict,
    };
}

function toChatTool(tool: ResponseFunctionTool): ChatToolDefinition {
    return {
        type: "function",
        function: {
            name: tool.function.name,
            description: tool.function.description,
            parameters: tool.function.parameters,
            strict: tool.function.strict,
        },
    };
}

function parseToolResponse(payload: ResponseApiPayload): ToolResponseResult {
    const output = payload.output || [];
    const content =
        payload.output_text ||
        output
            .flatMap((item) => (item.type === "message" ? item.content || [] : []))
            .map((item) => item.text || "")
            .join("");
    const toolCalls = output
        .filter((item): item is Extract<ResponseApiOutputItem, { type?: "function_call" }> => item.type === "function_call")
        .map((item) => ({
            id: item.call_id || item.id || "",
            type: "function" as const,
            function: { name: item.name || "", arguments: item.arguments || "{}" },
        }))
        .filter((item) => item.id && item.function.name);
    return { content, toolCalls };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function responseErrorMessage(value: unknown) {
    if (!isRecord(value)) return typeof value === "string" ? value.slice(0, 300) : "";
    if (typeof value.error === "string" && value.error.trim()) return value.error.trim().slice(0, 300);
    const error = isRecord(value.error) ? value.error : undefined;
    const response = isRecord(value.response) ? value.response : undefined;
    const responseError = response && isRecord(response.error) ? response.error : undefined;
    return stringValue(value.message) || stringValue(value.msg) || stringValue(error?.message) || stringValue(error?.msg) || stringValue(responseError?.message) || (typeof value.code === "string" ? value.code : "");
}

function stringValue(value: unknown) {
    return typeof value === "string" ? value : "";
}

function validateResponsePayload(payload: ResponseApiPayload) {
    if (typeof payload.code === "number" && payload.code !== 0) throw new Error(payload.msg || "请求失败");
    if (payload.error?.message) throw new Error(payload.error.message);
}

function validateGeminiPayload(payload: GeminiPayload) {
    if (payload.error?.message) throw new Error(payload.error.message);
    if (payload.promptFeedback?.blockReason) throw new Error(`Gemini 拒绝了本次请求：${payload.promptFeedback.blockReason}`);
}

async function readFetchError(response: Response, fallback: string) {
    const text = await response.text();
    if (!text) return readStatusError(response.status, fallback);
    try {
        return responseErrorMessage(JSON.parse(text)) || readStatusError(response.status, fallback);
    } catch {
        return text.slice(0, 300) || readStatusError(response.status, fallback);
    }
}

function consumeResponseStreamBlock(block: string, state: ResponseStreamState, onDelta?: (text: string) => void) {
    const data = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).replace(/^ /, ""))
        .join("\n")
        .trim();
    if (!data || data === "[DONE]") return;
    const event = JSON.parse(data) as Record<string, unknown>;
    const type = stringValue(event.type);
    const errorMessage = responseErrorMessage(event);
    if (errorMessage) state.error = errorMessage;
    if (type === "response.output_text.delta" && typeof event.delta === "string") {
        state.text += event.delta;
        onDelta?.(state.text);
    }
    if (type === "response.output_text.done" && !state.text && typeof event.text === "string") {
        state.text = event.text;
        onDelta?.(state.text);
    }
    if (type === "response.completed" && isRecord(event.response)) {
        state.payload = event.response as ResponseApiPayload;
    } else if (Array.isArray(event.output)) {
        state.payload = event as ResponseApiPayload;
    }
}

function consumeResponseStreamText(state: ResponseStreamState, text: string, onDelta?: (text: string) => void, flush = false) {
    state.buffer += text;
    for (;;) {
        const match = state.buffer.match(/\r?\n\r?\n/);
        if (!match) break;
        const index = match.index ?? 0;
        consumeResponseStreamBlock(state.buffer.slice(0, index), state, onDelta);
        state.buffer = state.buffer.slice(index + match[0].length);
    }
    if (flush && state.buffer.trim()) {
        consumeResponseStreamBlock(state.buffer, state, onDelta);
        state.buffer = "";
    }
}

async function requestStreamingResponse(config: AiConfig, body: Record<string, unknown>, onDelta?: (text: string) => void, options?: RequestOptions): Promise<ToolResponseResult> {
    const response = await fetch(aiApiUrl(config, "/responses"), {
        method: "POST",
        headers: { ...aiHeaders(config, "application/json"), Accept: "text/event-stream" },
        body: JSON.stringify({ ...body, stream: true }),
        signal: options?.signal,
    });
    if (!response.ok) throw new Error(await readFetchError(response, "请求失败"));
    if (!response.body) {
        const payload = (await response.json()) as ResponseApiPayload;
        validateResponsePayload(payload);
        return parseToolResponse(payload);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const state: ResponseStreamState = { buffer: "", text: "" };
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        consumeResponseStreamText(state, decoder.decode(value, { stream: true }), onDelta);
        if (state.error) throw new Error(state.error);
    }
    consumeResponseStreamText(state, decoder.decode(), onDelta, true);
    if (state.error) throw new Error(state.error);
    if (!state.payload) return { content: state.text, toolCalls: [] };
    validateResponsePayload(state.payload);
    const result = parseToolResponse(state.payload);
    return { ...result, content: state.text || result.content };
}

async function requestChatToolResponse(config: AiConfig, messages: ResponseInputMessage[], tools: ResponseFunctionTool[], toolChoice: ToolChoice, onDelta?: (text: string) => void, options?: RequestOptions): Promise<ToolResponseResult> {
    const response = await fetch(aiApiUrl(config, "/chat/completions"), {
        method: "POST",
        headers: aiHeaders(config, "application/json"),
        body: JSON.stringify({
            model: config.model,
            messages: toChatMessages(withSystemMessage(config, messages)),
            tools: tools.map(toChatTool),
            tool_choice: toChatToolChoice(toolChoice),
            parallel_tool_calls: false,
        }),
        signal: options?.signal,
    });
    if (!response.ok) throw new Error(await readFetchError(response, "请求失败"));
    const payload = (await response.json()) as ChatCompletionPayload;
    validateChatPayload(payload);
    const result = parseChatToolResponse(payload);
    if (result.content) onDelta?.(result.content);
    return result;
}

function toChatToolChoice(toolChoice: ToolChoice) {
    if (typeof toolChoice !== "object") return toolChoice;
    return { type: "function", function: { name: toolChoice.name } };
}

function validateChatPayload(payload: ChatCompletionPayload) {
    if (typeof payload.code === "number" && payload.code !== 0) throw new Error(payload.msg || "请求失败");
    if (payload.error?.message) throw new Error(payload.error.message);
}

function parseChatToolResponse(payload: ChatCompletionPayload): ToolResponseResult {
    const message = payload.choices?.[0]?.message;
    const toolCalls = (message?.tool_calls || [])
        .filter((item) => item.type === "function" && item.function?.name)
        .map((item) => ({
            id: item.id || nanoid(),
            type: "function" as const,
            function: { name: item.function?.name || "", arguments: item.function?.arguments || "{}" },
        }));
    return { content: message?.content || "", toolCalls };
}

function toGeminiBody(config: AiConfig, messages: ResponseInputMessage[], extra?: Record<string, unknown>) {
    const systemText = [
        config.systemPrompt.trim(),
        ...messages.flatMap((message) => (!("type" in message) && message.role === "system" ? [geminiTextContent(message.content)] : [])),
    ]
        .filter(Boolean)
        .join("\n\n");
    const contents = toGeminiContents(messages.filter((message) => ("type" in message ? true : message.role !== "system")));
    return {
        contents,
        ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
        ...extra,
    };
}

function toGeminiContents(messages: ResponseInputMessage[]): GeminiContent[] {
    const callNameById = new Map<string, string>();
    return messages.flatMap((message): GeminiContent[] => {
        if ("type" in message) {
            callNameById.set(message.call_id, message.name);
            return [{ role: "model", parts: [{ functionCall: { id: message.call_id, name: message.name, args: jsonObject(message.arguments) }, ...(message.thoughtSignature ? { thoughtSignature: message.thoughtSignature } : {}) }] }];
        }
        if (message.role === "tool") {
            const name = callNameById.get(message.tool_call_id) || "tool_result";
            return [{ role: "user", parts: [{ functionResponse: { id: message.tool_call_id, name, response: { result: jsonValue(message.content) } } }] }];
        }
        return [{ role: message.role === "assistant" ? "model" : "user", parts: toGeminiParts(message.content) }];
    });
}

function toGeminiParts(content: ResponseMessageContent): GeminiPart[] {
    if (!Array.isArray(content)) return [{ text: String(content || "") }];
    return content.map((item) => (item.type === "text" ? { text: item.text } : toGeminiImagePart(item.image_url.url)));
}

function toGeminiImagePart(url: string): GeminiPart {
    const match = url.match(/^data:([^;,]+);base64,(.+)$/);
    if (match) return { inlineData: { mimeType: match[1], data: match[2] } };
    return { fileData: { fileUri: url, mimeType: "image/png" } };
}

function geminiTextContent(content: ResponseMessageContent) {
    if (!Array.isArray(content)) return String(content || "");
    return content.map((item) => (item.type === "text" ? item.text : item.image_url.url)).join("\n");
}

function jsonObject(value: string): Record<string, unknown> {
    const parsed = jsonValue(value);
    return isRecord(parsed) ? parsed : {};
}

function jsonValue(value: string): unknown {
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

async function requestGeminiImages(config: AiConfig, prompt: string, references: ReferenceImage[], count: number, options?: RequestOptions) {
    const requests = Array.from({ length: count }, () => requestGeminiImagesOnce(config, prompt, references, options));
    return (await Promise.all(requests)).flat();
}

async function requestGeminiImagesOnce(config: AiConfig, prompt: string, references: ReferenceImage[], options?: RequestOptions) {
    const parts: GeminiPart[] = [{ text: withSystemPrompt(config, prompt) }];
    for (const image of references) {
        parts.push(toGeminiImagePart(await imageToDataUrl(image)));
    }
    const imageSize = normalizeGeminiImageResolution(config.quality).toUpperCase();
    const aspectRatio = normalizeGeminiImageRatio(config.size);
    debugLog("image", "Gemini 生图", { model: modelOptionName(config.model), imageSize, aspectRatio, references: references.length });
    try {
        const response = await requestGeminiWithProxyFallback<GeminiPayload>(
            config,
            {
                ...toGeminiBody(config, [{ role: "user", content: prompt }], {
                    generationConfig: {
                        responseModalities: ["TEXT", "IMAGE"],
                        imageConfig: { imageSize, aspectRatio },
                    },
                }),
                contents: [{ role: "user", parts }],
            },
            options,
        );
        return parseGeminiImagePayload(response.data);
    } catch (error) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        if (!axios.isAxiosError(error) || ![404, 405, 500, 502, 503, 504].includes(status || 0)) throw error;
        debugWarn("image", "Gemini 原生接口不可用，回退兼容接口", { model: modelOptionName(config.model), status });
        const content = [{ type: "text", text: withSystemPrompt(config, prompt) }, ...await Promise.all(references.map(async (image) => ({ type: "image_url", image_url: { url: await imageToDataUrl(image) } })))] as Array<{ type: string; text?: string; image_url?: { url: string } }>;
        const response = await postWithProxyFallback<ChatCompletionPayload>(config, "/chat/completions", {
            model: modelOptionName(config.model),
            messages: [{ role: "user", content }],
            extra_body: { google: { image_config: { image_size: imageSize, aspect_ratio: aspectRatio } } },
        }, "application/json", options);
        const message = response.data.choices?.[0]?.message;
        const urls = [...(message?.images || []).map((item) => item.image_url?.url || ""), ...extractMarkdownImageUrls(message?.content || "")].filter(Boolean);
        if (!urls.length) throw new Error("Gemini 兼容接口没有返回图片");
        return urls.map((dataUrl) => ({ id: nanoid(), dataUrl }));
    }
}

async function requestGeminiWithProxyFallback<T>(config: AiConfig, body: unknown, options?: RequestOptions) {
    const targetUrl = geminiApiUrl(config, "generateContent");
    const directUrl = geminiDirectApiUrl(config, "generateContent");
    const request = (url: string) => axios.post<T>(url, body, { headers: geminiHeaders(config), signal: options?.signal });
    return withDirectFallback(request(targetUrl), () => request(directUrl), { method: "POST", path: "/gemini:generateContent", retryStatuses: [500, 501, 502, 503, 504] });
}

function geminiDirectApiUrl(config: Pick<AiConfig, "baseUrl" | "model">, action: "generateContent" | "streamGenerateContent") {
    const baseUrl = geminiBaseUrl(config);
    return `${baseUrl}/models/${encodeURIComponent(geminiModelName(config.model))}:${action}`;
}

function extractMarkdownImageUrls(content: string) {
    return Array.from(content.matchAll(/!\[[^\]]*\]\((data:image\/[^;]+;base64,[A-Za-z0-9+/=_-]+|https?:\/\/[^\s)]+)\)/g), (match) => match[1]);
}

async function requestGptImage2Generation(config: AiConfig, prompt: string, count: number, options?: RequestOptions) {
    const size = resolveGptImage2Size(config.quality, config.size);
    const body = {
        model: modelOptionName(config.model),
        prompt: withSystemPrompt(config, prompt),
        n: Math.max(1, Math.min(count, 1)),
        size,
        quality: "auto",
        output_format: "jpeg",
        moderation: "auto",
    };
    debugLog("image", "gpt-image-2 文生图", { size, model: body.model });
    try {
        const response = await postWithProxyFallback<ImageApiResponse>(config, "/images/generations", body, "application/json", options);
        return await parseImagePayloadOrPoll(config, response.data, options);
    } catch (error) {
        throw new Error(readAxiosError(error, "gpt-image-2 图片生成失败"));
    }
}

async function requestGptImage2Edit(config: AiConfig, prompt: string, references: ReferenceImage[], count: number, options?: RequestOptions) {
    if (!references.length) throw new Error("gpt-image-2 图片编辑需要至少 1 张参考图");
    const size = resolveGptImage2Size(config.quality, config.size);
    const formData = new FormData();
    formData.set("model", modelOptionName(config.model));
    formData.set("prompt", withSystemPrompt(config, prompt));
    formData.set("n", String(Math.max(1, Math.min(count, 1))));
    formData.set("size", size);
    formData.set("quality", "auto");
    formData.set("output_format", "jpeg");
    formData.set("moderation", "auto");
    const files = await Promise.all(references.map(async (image) => dataUrlToFile({ ...image, dataUrl: await imageToDataUrl(image) })));
    files.forEach((file) => formData.append("image[]", file));
    debugLog("image", "gpt-image-2 图片编辑", { size, references: files.length });
    try {
        const response = await postWithProxyFallback<ImageApiResponse>(config, "/images/edits", formData, undefined, options);
        return await parseImagePayloadOrPoll(config, response.data, options);
    } catch (error) {
        // 部分中转只接受 image 字段
        if (axios.isAxiosError(error) && error.response?.status && error.response.status >= 400 && error.response.status < 500) {
            const retry = new FormData();
            formData.forEach((value, key) => {
                if (key !== "image[]") retry.append(key, value);
            });
            files.forEach((file) => retry.append("image", file));
            try {
                const response = await postWithProxyFallback<ImageApiResponse>(config, "/images/edits", retry, undefined, options);
                return await parseImagePayloadOrPoll(config, response.data, options);
            } catch (retryError) {
                throw new Error(readAxiosError(retryError, "gpt-image-2 图片编辑失败"));
            }
        }
        throw new Error(readAxiosError(error, "gpt-image-2 图片编辑失败"));
    }
}

async function parseImagePayloadOrPoll(config: AiConfig, payload: ImageApiResponse | ImageTaskResponse, options?: RequestOptions) {
    try {
        return parseImagePayload(payload as ImageApiResponse);
    } catch (error) {
        const task = unwrapImageTask(payload as ImageTaskResponse);
        const taskId = readImageTaskId(task);
        if (!taskId) throw error;
        const imageUrl = await pollOpenAiCompatibleImageTask(config, taskId, options);
        return [{ id: nanoid(), dataUrl: imageUrl }];
    }
}

async function pollOpenAiCompatibleImageTask(config: AiConfig, taskId: string, options?: RequestOptions) {
    const maxAttempts = Math.ceil(NEW_TOKEN_IMAGE_TIMEOUT_MS / NEW_TOKEN_IMAGE_POLL_MS);
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const task = unwrapImageTask((await getWithProxyFallback<ImageTaskResponse>(config, `/images/generations/${taskId}`, options)).data);
        const status = normalizeImageTaskStatus(task.status || task.state || task.task_status);
        const imageUrl = readAsyncImageUrl(task);
        if (status === "completed") {
            try {
                return await readImageTaskContent(config, taskId, options);
            } catch (contentError) {
                if (options?.signal?.aborted) throw contentError;
                if (imageUrl) return resolveImageProviderUrl(config, imageUrl);
                throw contentError;
            }
        }
        if (imageUrl) return resolveImageProviderUrl(config, imageUrl);
        if (status === "failed") throw new Error(task.error?.message || task.msg || "图片生成失败");
        if (attempt === maxAttempts - 1) throw new Error("图片生成超时，请稍后重试");
        await delay(NEW_TOKEN_IMAGE_POLL_MS, options?.signal);
    }
    throw new Error("图片生成超时，请稍后重试");
}

async function readImageTaskContent(config: AiConfig, taskId: string, options?: RequestOptions) {
    const response = await getBlobWithProxyFallback(config, `/images/generations/${taskId}/content`, options);
    const blob = response.data;
    const contentType = blob.type.toLowerCase();
    if (!blob.size || contentType.includes("json") || contentType.includes("html") || contentType.startsWith("text/")) {
        throw new Error("图片内容接口没有返回有效图片");
    }
    return blobToDataUrl(blob);
}

function resolveImageProviderUrl(config: AiConfig, url: string) {
    const value = url.trim();
    if (/^https?:\/\//i.test(value) || value.startsWith("data:") || value.startsWith("blob:")) return value;
    return new URL(value, `${config.baseUrl.trim().replace(/\/+$/, "")}/`).toString();
}

function blobToDataUrl(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("读取图片内容失败"));
        reader.readAsDataURL(blob);
    });
}

function parseGeminiImagePayload(payload: GeminiPayload) {
    validateGeminiPayload(payload);
    const images =
        payload.candidates
            ?.flatMap((candidate) => candidate.content?.parts || [])
            .map((part) => {
                const inlineData = part.inlineData || (part.inline_data ? { mimeType: part.inline_data.mimeType || part.inline_data.mime_type, data: part.inline_data.data } : undefined);
                if (inlineData?.data) return `data:${inlineData.mimeType || "image/png"};base64,${inlineData.data}`;
                return part.fileData?.fileUri || null;
            })
            .filter((value): value is string => Boolean(value))
            .map((dataUrl) => ({ id: nanoid(), dataUrl })) || [];
    if (!images.length) throw new Error("Gemini 接口没有返回图片");
    return images;
}

export async function requestGeneration(config: AiConfig, prompt: string, options?: RequestOptions) {
    const requestConfig = resolveModelRequestConfig(config, config.model || config.imageModel);
    const isGrokImagine = isGrokImagineImageModel(requestConfig.model);
    const isStepImageEdit2 = isStepImageEdit2Model(requestConfig.model);
    const isGlmImage = isGlmImageModel(requestConfig.model);
    const isZImageTurbo = isZImageTurboModel(requestConfig.model);
    const isGptImage2 = isGptImage2Model(requestConfig.model);
    const isGeminiPreview = isGeminiImagePreviewModel(requestConfig.model);
    const n = Math.max(1, Math.min(isGrokImagine ? grokImagineImageMaxCount : 15, Math.floor(Math.abs(Number(config.count)) || 1)));
    if (isGeminiPreview) {
        try {
            return await requestGeminiImages(requestConfig, prompt, [], n, options);
        } catch (error) {
            throw new Error(readAxiosError(error, "请求失败"));
        }
    }
    if (isStepImageEdit2) {
        return requestStepImageGenerate(requestConfig, prompt, n, options);
    }
    if (isGrokImagine) {
        return requestGrokImagineImages(requestConfig, prompt, n, options);
    }
    if (isGptImage2) {
        return requestGptImage2Generation(requestConfig, prompt, n, options);
    }
    const quality = normalizeQuality(config.quality);
    const requestSize = resolveRequestSize(quality, config.size);
    try {
        const response = await postWithProxyFallback<ImageApiResponse>(
            requestConfig,
            "/images/generations",
            {
                model: requestConfig.model,
                prompt: withSystemPrompt(requestConfig, prompt),
                n,
                ...(quality ? { quality } : {}),
                ...(isGlmImage || isZImageTurbo ? glmImageApiDimensions(config.size) : requestSize ? { size: requestSize } : {}),
                ...(isGlmImage || isZImageTurbo ? { num_inference_steps: normalizeGlmImageSteps(config.imageSteps) } : {}),
                // 多数中转对 url 格式不稳定；统一要 b64，前端快速转 blob 展示
                response_format: "b64_json",
                output_format: IMAGE_OUTPUT_FORMAT,
            },
            "application/json",
            options,
        );
        return await parseImagePayloadOrPoll(requestConfig, response.data, options);
    } catch (error) {
        throw new Error(readAxiosError(error, "请求失败"));
    }
}

export async function requestEdit(config: AiConfig, prompt: string, references: ReferenceImage[], mask?: ReferenceImage, options?: RequestOptions) {
    const requestConfig = resolveModelRequestConfig(config, config.model || config.imageModel);
    const isGrokImagine = isGrokImagineImageModel(requestConfig.model);
    const isStepImageEdit2 = isStepImageEdit2Model(requestConfig.model);
    const isGlmImage = isGlmImageModel(requestConfig.model);
    const isZImageTurbo = isZImageTurboModel(requestConfig.model);
    const isGptImage2 = isGptImage2Model(requestConfig.model);
    const isGeminiPreview = isGeminiImagePreviewModel(requestConfig.model);
    const n = Math.max(1, Math.min(isGrokImagine ? grokImagineImageMaxCount : 15, Math.floor(Math.abs(Number(config.count)) || 1)));
    const requestPrompt = buildImageReferencePromptText(prompt, references);
    if (isGeminiPreview) {
        if (mask) throw new Error("Gemini 预览模型暂不支持蒙版编辑");
        try {
            return await requestGeminiImages(requestConfig, requestPrompt, references, n, options);
        } catch (error) {
            throw new Error(readAxiosError(error, "请求失败"));
        }
    }
    if (isStepImageEdit2) {
        return requestStepImageEdit(requestConfig, requestPrompt, references, mask, n, options);
    }
    if (isGrokImagine) {
        if (mask) throw new Error("Grok Imagine 图像编辑暂不支持蒙版编辑");
        return requestGrokImagineImageEdits(requestConfig, requestPrompt, references, n, options);
    }
    if (isGptImage2) {
        if (mask) throw new Error("gpt-image-2 文档编辑接口暂不支持蒙版字段，请去掉蒙版后重试");
        return requestGptImage2Edit(requestConfig, requestPrompt, references, n, options);
    }
    const quality = normalizeQuality(config.quality);
    const requestSize = resolveRequestSize(quality, config.size);
    const formData = new FormData();
    formData.set("model", requestConfig.model);
    formData.set("prompt", withSystemPrompt(requestConfig, requestPrompt));
    formData.set("n", String(n));
    formData.set("response_format", "b64_json");
    formData.set("output_format", IMAGE_OUTPUT_FORMAT);
    if (quality) {
        formData.set("quality", quality);
    }
    if (isGlmImage || isZImageTurbo) {
        const dimensions = glmImageApiDimensions(config.size);
        formData.set("width", String(dimensions.width));
        formData.set("height", String(dimensions.height));
        formData.set("num_inference_steps", String(normalizeGlmImageSteps(config.imageSteps)));
    } else if (requestSize) formData.set("size", requestSize);
    const files = await Promise.all(references.map(async (image) => dataUrlToFile({ ...image, dataUrl: await imageToDataUrl(image) })));
    files.forEach((file) => formData.append("image", file));
    if (mask) formData.set("mask", dataUrlToFile(mask));

    try {
        const response = await postWithProxyFallback<ImageApiResponse>(requestConfig, "/images/edits", formData, undefined, options);
        return await parseImagePayloadOrPoll(requestConfig, response.data, options);
    } catch (error) {
        throw new Error(readAxiosError(error, "请求失败"));
    }
}

async function requestGrokImagineImages(config: AiConfig, prompt: string, count: number, options?: RequestOptions) {
    const aspectRatio = normalizeGrokImagineImageRatio(config.size);
    // 原生接口优先 url：上游 12s 出图后响应体小，避免 b64 大包传输导致本地一直“生成中”
    const body = {
        model: config.model,
        prompt: withSystemPrompt(config, prompt),
        n: count,
        ...(aspectRatio === "auto" ? {} : { aspect_ratio: aspectRatio }),
        resolution: normalizeGrokImagineImageResolution(config.quality),
        response_format: "url",
    };
    try {
        const response = await postWithProxyFallback<ImageApiResponse>(config, "/images/generations", body, "application/json", options);
        return parseImagePayload(response.data);
    } catch (error) {
        throw new Error(readAxiosError(error, "Grok Imagine 图片生成失败"));
    }
}

async function requestGrokImagineImageEdits(config: AiConfig, prompt: string, references: ReferenceImage[], count: number, options?: RequestOptions) {
    const aspectRatio = normalizeGrokImagineImageRatio(config.size);
    if (references.length > grokImagineImageEditMaxCount) throw new Error("Grok Imagine 图像编辑最多支持 3 张参考图");
    const imagePayloads = await Promise.all(references.map(async (image) => ({ url: await imageToDataUrl(image) })));
    const body: Record<string, unknown> = {
        model: config.model,
        prompt: withSystemPrompt(config, prompt),
        n: count,
        response_format: "url",
        resolution: normalizeGrokImagineImageResolution(config.quality),
    };
    if (aspectRatio !== "auto") body.aspect_ratio = aspectRatio;
    if (imagePayloads.length === 1) body.image = imagePayloads[0];
    else if (imagePayloads.length > 1) body.images = imagePayloads;

    try {
        const response = await postWithProxyFallback<ImageApiResponse>(config, "/images/edits", body, "application/json", options);
        return parseImagePayload(response.data);
    } catch (error) {
        throw new Error(readAxiosError(error, "Grok Imagine 图片编辑失败"));
    }
}

async function requestStepImageGenerate(config: AiConfig, prompt: string, count: number, options?: RequestOptions) {
    const body = {
        model: config.model,
        prompt: withSystemPrompt(config, prompt),
        n: count,
        response_format: "b64_json",
        size: normalizeStepImageEdit2Size(config.size),
        cfg_scale: 1.0,
        steps: 8,
    };
    try {
        const response = await postWithProxyFallback<ImageApiResponse>(config, "/images/generations", body, "application/json", options);
        return parseImagePayload(response.data);
    } catch (error) {
        throw new Error(readAxiosError(error, "Step Image Edit 2 图片生成失败"));
    }
}

async function requestStepImageEdit(config: AiConfig, prompt: string, references: ReferenceImage[], mask: ReferenceImage | undefined, count: number, options?: RequestOptions) {
    if (mask) throw new Error("step-image-edit-2 暂不支持蒙版编辑");
    if (!references.length) throw new Error("step-image-edit-2 需要 1 张参考图");
    if (references.length > 1) throw new Error("step-image-edit-2 仅支持 1 张参考图");
    const formData = new FormData();
    formData.set("model", config.model);
    formData.set("prompt", withSystemPrompt(config, prompt));
    formData.set("n", String(count));
    formData.set("response_format", "b64_json");
    formData.set("cfg_scale", "1.0");
    formData.set("steps", "8");
    const file = await dataUrlToFile({ ...references[0], dataUrl: await imageToDataUrl(references[0]) });
    formData.set("image", file);
    try {
        const response = await postWithProxyFallback<ImageApiResponse>(config, "/images/edits", formData, undefined, options);
        return parseImagePayload(response.data);
    } catch (error) {
        throw new Error(readAxiosError(error, "Step Image Edit 2 图片编辑失败"));
    }
}

export async function requestImageQuestion(config: AiConfig, messages: AiTextMessage[], onDelta: (text: string) => void, options?: RequestOptions) {
    const requestConfig = resolveModelRequestConfig(config, config.model || config.textModel);
    try {
        const answer = (await requestStreamingResponse(requestConfig, {
            model: requestConfig.model,
            input: toResponseInput(withSystemMessage(requestConfig, messages)),
        }, onDelta, options)).content || "没有返回内容";
        if (answer === "没有返回内容") onDelta(answer);
        return answer;
    } catch (error) {
        throw new Error(readAxiosError(error, "请求失败"));
    }
}

/** 非流式文本补全，优先 chat/completions，适合提示词优化等短请求。 */
export async function requestTextCompletion(config: AiConfig, messages: AiTextMessage[], options?: RequestOptions) {
    const requestConfig = resolveModelRequestConfig(config, config.model || config.textModel);
    const timeoutMs = 90000;
    try {
        try {
            const response = await postWithProxyFallback<ChatCompletionPayload>(
                requestConfig,
                "/chat/completions",
                {
                    model: requestConfig.model,
                    messages: toChatMessages(withSystemMessage(requestConfig, messages)),
                    stream: false,
                },
                "application/json",
                { ...options, timeoutMs },
            );
            validateChatPayload(response.data);
            const text = String(response.data.choices?.[0]?.message?.content || "").trim();
            if (text) return text;
        } catch (error) {
            if (options?.signal?.aborted) throw error;
            // 部分渠道只支持 /responses
        }
        const response = await postWithProxyFallback<ResponseApiPayload>(
            requestConfig,
            "/responses",
            {
                model: requestConfig.model,
                input: toResponseInput(withSystemMessage(requestConfig, messages)),
                stream: false,
            },
            "application/json",
            { ...options, timeoutMs },
        );
        validateResponsePayload(response.data);
        const result = parseToolResponse(response.data);
        const text = String(result.content || response.data.output_text || "").trim();
        if (!text) throw new Error("没有返回内容");
        return text;
    } catch (error) {
        throw new Error(readAxiosError(error, "文本请求失败"));
    }
}

export async function requestToolResponse(config: AiConfig, messages: ResponseInputMessage[], tools: ResponseFunctionTool[], toolChoice: ToolChoice = "auto", onDelta?: (text: string) => void, options?: RequestOptions): Promise<ToolResponseResult> {
    const requestConfig = resolveModelRequestConfig(config, config.model || config.textModel);
    try {
        try {
            return await requestStreamingResponse(requestConfig, {
                model: requestConfig.model,
                input: toResponseInput(withSystemMessage(requestConfig, messages)),
                tools: tools.map(toResponseTool),
                tool_choice: toolChoice,
                parallel_tool_calls: false,
            }, onDelta, options);
        } catch (error) {
            if (!shouldFallbackToChatTools(error)) throw error;
            return await requestChatToolResponse(requestConfig, messages, tools, toolChoice, onDelta, options);
        }
    } catch (error) {
        throw new Error(readAxiosError(error, "请求失败"));
    }
}

function shouldFallbackToChatTools(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || "");
    return /Bad input|anyOf|oneOf|tools\/\d+\/function|enum function not in custom|tool_choice|\/responses|404/.test(message);
}

export async function fetchImageModels(config: Pick<AiConfig, "baseUrl" | "apiKey">) {
    try {
        const response = await getModelsWithProxyFallback(config.baseUrl, config.apiKey);
        return (response.data.data || [])
            .map((model) => model.id)
            .filter((id): id is string => Boolean(id))
            .sort((a, b) => a.localeCompare(b));
    } catch (error) {
        throw new Error(readAxiosError(error, "读取模型失败"));
    }
}

export async function fetchChannelModels(channel: ModelChannel) {
    return fetchImageModels({ baseUrl: channel.baseUrl, apiKey: channel.apiKey });
}

async function getModelsWithProxyFallback(baseUrl: string, apiKey: string) {
    const headers = { Authorization: `Bearer ${apiKey}` };
    const request = (url: string) => axios.get<{ data?: Array<{ id?: string }>; error?: { message?: string } }>(url, { headers });
    return withDirectFallback(request(buildAiApiUrl(baseUrl, "/models")), () => request(buildApiUrl(baseUrl, "/models")), { method: "GET", path: "/models", retryStatuses: [500, 501, 502, 503, 504] });
}

type DataResponse<T> = { data: T };

async function postWithProxyFallback<T>(config: AiConfig, path: string, body: unknown, contentType?: string, options?: RequestOptions & { timeoutMs?: number }): Promise<DataResponse<T>> {
    const proxyUrl = aiApiUrl(config, path);
    const directUrl = buildApiUrl(config.baseUrl, path);
    debugLog("image", "POST 图片接口", { path, contentType, payloadBytes: estimatePayloadBytes(body) });
    const request = (url: string): Promise<DataResponse<T>> => axios.post<T>(url, body, { headers: aiHeaders(config, contentType), signal: options?.signal, timeout: options?.timeoutMs });
    return withDirectFallback(request(proxyUrl), () => request(directUrl), { method: "POST", path });
}

async function getWithProxyFallback<T>(config: AiConfig, path: string, options?: RequestOptions) {
    const proxyUrl = aiApiUrl(config, path);
    const directUrl = buildApiUrl(config.baseUrl, path);
    debugLog("image", "GET 图片接口", { path });
    const request = (url: string) => axios.get<T>(url, { headers: aiHeaders(config), signal: options?.signal });
    return withDirectFallback(request(proxyUrl), () => request(directUrl), { method: "GET", path });
}

async function getBlobWithProxyFallback(config: AiConfig, path: string, options?: RequestOptions) {
    const proxyUrl = aiApiUrl(config, path);
    const directUrl = buildApiUrl(config.baseUrl, path);
    debugLog("image", "GET 图片内容", { path });
    const request = (url: string): Promise<DataResponse<Blob>> => axios.get<Blob>(url, { headers: aiHeaders(config), signal: options?.signal, responseType: "blob" });
    return withDirectFallback(request(proxyUrl), () => request(directUrl), { method: "GET", path });
}

async function withDirectFallback<T>(proxied: Promise<T>, direct: () => Promise<T>, meta?: { method?: string; path?: string; retryStatuses?: number[] }) {
    try {
        return await proxied;
    } catch (error) {
        if (!shouldRetryDirect(error, meta?.retryStatuses)) {
            debugError("image", "请求失败", { ...(meta || {}), error: summarizeAxiosError(error) });
            throw error;
        }
        debugWarn("image", "代理失败，尝试直连", { ...(meta || {}), error: summarizeAxiosError(error) });
        try {
            const result = await direct();
            debugLog("image", "直连成功", { ...(meta || {}) });
            return result;
        } catch (directError) {
            debugError("image", "直连也失败", { ...(meta || {}), proxyError: summarizeAxiosError(error), directError: summarizeAxiosError(directError) });
            if (axios.isAxiosError(directError) && directError.response) throw directError;
            throw error;
        }
    }
}

function shouldRetryDirect(error: unknown, retryStatuses: number[] = []) {
    if (!axios.isAxiosError(error)) return false;
    const url = String(error.config?.url || "");
    if (!url.startsWith("/api/proxy")) return false;
    if (!error.response) return true;
    const status = error.response.status;
    return status === 403 || status === 408 || status === 502 || status === 504 || retryStatuses.includes(status) || (status >= 520 && status <= 524) || isProxyHtmlError(error);
}

function isProxyHtmlError(error: unknown) {
    if (!axios.isAxiosError(error)) return false;
    const url = String(error.config?.url || "");
    if (!url.startsWith("/api/proxy")) return false;
    const contentType = String(error.response?.headers?.["content-type"] || "");
    return contentType.includes("text/html") || (typeof error.response?.data === "string" && /<html|forbidden|nginx/i.test(error.response.data));
}

function gcd(a: number, b: number): number {
    return b ? gcd(b, a % b) : Math.abs(a);
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
