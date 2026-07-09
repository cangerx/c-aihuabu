import { modelOptionName, resolveModelRequestConfig, type AiConfig } from "@/stores/use-config-store";

export const grokImagineImageModels = ["grok-imagine-image-quality", "grok-imagine-image", "grok-imagine-image-lite"] as const;
export const grokImagineVideoModels = ["grok-imagine-video", "grok-imagine-video-1.5"] as const;

export const grokImagineImageRatioOptions = [
    { value: "1:1", label: "1:1", width: 1, height: 1 },
    { value: "16:9", label: "16:9", width: 16, height: 9 },
    { value: "9:16", label: "9:16", width: 9, height: 16 },
    { value: "4:3", label: "4:3", width: 4, height: 3 },
    { value: "3:4", label: "3:4", width: 3, height: 4 },
    { value: "3:2", label: "3:2", width: 3, height: 2 },
    { value: "2:3", label: "2:3", width: 2, height: 3 },
    { value: "2:1", label: "2:1", width: 2, height: 1 },
    { value: "1:2", label: "1:2", width: 1, height: 2 },
    { value: "19.5:9", label: "19.5:9", width: 19.5, height: 9 },
    { value: "9:19.5", label: "9:19.5", width: 9, height: 19.5 },
    { value: "20:9", label: "20:9", width: 20, height: 9 },
    { value: "9:20", label: "9:20", width: 9, height: 20 },
    { value: "auto", label: "auto", width: 0, height: 0 },
] as const;

export const grokImagineVideoRatioOptions = [
    { value: "16:9", label: "横屏" },
    { value: "9:16", label: "竖屏" },
    { value: "1:1", label: "方形" },
    { value: "4:3", label: "标准横屏" },
    { value: "3:4", label: "标准竖屏" },
    { value: "3:2", label: "摄影横屏" },
    { value: "2:3", label: "摄影竖屏" },
] as const;

export const grokImagineImageResolutionOptions = [
    { value: "1k", label: "1k" },
    { value: "2k", label: "2k" },
] as const;

export const grokImagineVideoResolutionOptions = [
    { value: "480p", label: "480p" },
    { value: "720p", label: "720p" },
    { value: "1080p", label: "1080p" },
] as const;

export const grokImagineImageMaxCount = 10;
export const grokImagineImageEditMaxCount = 3;

export function isGrokImagineImageConfig(config: AiConfig | Pick<AiConfig, "model" | "imageModel" | "baseUrl" | "apiFormat">) {
    // 尺寸/分辨率面板按模型名切换，不依赖渠道 apiFormat，避免 lite 等同族模型 UI 不刷新。
    const model = "channels" in config ? modelOptionName(config.model || config.imageModel) : modelOptionName(config.model || config.imageModel || "");
    return isGrokImagineImageModel(model);
}

export function isGrokImagineVideoConfig(config: AiConfig | Pick<AiConfig, "model" | "videoModel" | "baseUrl" | "apiFormat">) {
    const requestConfig = "channels" in config ? resolveModelRequestConfig(config, config.model || config.videoModel) : config;
    return isGrokImagineApiFormat(requestConfig) && isGrokImagineVideoModel(modelOptionName(requestConfig.model || requestConfig.videoModel));
}

export function isGrokImagineApiFormat(config: Pick<AiConfig, "baseUrl" | "apiFormat">) {
    return config.apiFormat === "openai" || config.baseUrl.toLowerCase().includes("x.ai");
}

export function isGrokImagineImageModel(model: string) {
    const value = model.toLowerCase();
    return value === "grok-imagine-image-quality" || value === "grok-imagine-image" || value === "grok-imagine-image-lite" || value.startsWith("grok-imagine-image");
}

export function isGrokImagineImageQualityModel(model: string) {
    return model.toLowerCase() === "grok-imagine-image-quality";
}

export function isGrokImagineVideoModel(model: string) {
    const value = model.toLowerCase();
    return value === "grok-imagine-video" || value.includes("grok-imagine-video-1.5");
}

export function isGrokImagineVideo15Model(model: string) {
    return model.toLowerCase().includes("grok-imagine-video-1.5");
}

export function normalizeGrokImagineImageRatio(value: string) {
    return normalizeRatio(value, grokImagineImageRatioOptions, "auto");
}

export function normalizeGrokImagineVideoRatio(value: string) {
    return normalizeRatio(value, grokImagineVideoRatioOptions, "16:9");
}

export function normalizeGrokImagineImageResolution(value: string) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "2k" || normalized === "medium" || normalized === "high" || normalized === "hd") return "2k";
    return "1k";
}

export function normalizeGrokImagineVideoResolution(value: string, model = "") {
    const normalized = String(value || "").trim().toLowerCase().replace(/p$/, "");
    const resolution = normalized === "1080" || normalized === "high" ? "1080p" : normalized === "720" || normalized === "medium" || normalized === "auto" ? "720p" : "480p";
    return resolution === "1080p" && !isGrokImagineVideo15Model(model) ? "720p" : resolution;
}

export function normalizeGrokImagineVideoDuration(value: string) {
    const seconds = Math.floor(Number(value) || 6);
    return Math.max(1, Math.min(15, seconds));
}

export function normalizeGrokImagineImageCount(value: string) {
    const count = Math.floor(Number(value) || 1);
    return Math.max(1, Math.min(grokImagineImageMaxCount, count));
}

export function grokImagineImageRatioLabel(value: string) {
    const ratio = normalizeGrokImagineImageRatio(value);
    return grokImagineImageRatioOptions.find((item) => item.value === ratio)?.label || ratio;
}

export function grokImagineVideoRatioLabel(value: string) {
    const ratio = normalizeGrokImagineVideoRatio(value);
    return grokImagineVideoRatioOptions.find((item) => item.value === ratio)?.label || ratio;
}

function normalizeRatio<T extends readonly { value: string; width?: number; height?: number }[]>(value: string, options: T, fallback: T[number]["value"]) {
    const raw = String(value || "").trim().toLowerCase();
    if (options.some((item) => item.value === raw)) return raw;
    const match = raw.match(/^(\d+(?:\.\d+)?)(?:x|:)(\d+(?:\.\d+)?)/);
    if (!match) return fallback;
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!width || !height) return fallback;
    const ratio = width / height;
    const candidates = options.filter((item) => item.width && item.height);
    return candidates.reduce((best, item) => (Math.abs((item.width! / item.height!) - ratio) < Math.abs((best.width! / best.height!) - ratio) ? item : best), candidates[0]).value;
}
