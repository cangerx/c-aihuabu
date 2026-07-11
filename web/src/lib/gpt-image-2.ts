import { modelOptionName, type AiConfig } from "@/stores/use-config-store";

export const gptImage2Model = "gpt-image-2";
export const geminiImagePreviewModels = ["gemini-3-pro-image-preview", "gemini-3.1-flash-image-preview"] as const;

export const gptImage2RatioOptions = [
    { value: "1:1", label: "1:1" },
    { value: "16:9", label: "16:9" },
    { value: "9:16", label: "9:16" },
    { value: "4:3", label: "4:3" },
    { value: "3:4", label: "3:4" },
    { value: "3:2", label: "3:2" },
    { value: "2:3", label: "2:3" },
] as const;

export const gptImage2ResolutionOptions = [
    { value: "1k", label: "1K" },
    { value: "2k", label: "2K" },
    { value: "4k", label: "4K" },
] as const;

/** 文档尺寸映射：分辨率档位 × 宽高比 → size */
const SIZE_MAP: Record<string, Record<string, string>> = {
    "1k": {
        "1:1": "1024x1024",
        "16:9": "1536x864",
        "9:16": "864x1536",
        "4:3": "1360x1024",
        "3:4": "1024x1360",
        "3:2": "1536x1024",
        "2:3": "1024x1536",
    },
    "2k": {
        "1:1": "2048x2048",
        "16:9": "3072x1728",
        "9:16": "1728x3072",
        "4:3": "2720x2048",
        "3:4": "2048x2720",
        "3:2": "3072x2048",
        "2:3": "2048x3072",
    },
    "4k": {
        "1:1": "2880x2880",
        "16:9": "3840x2160",
        "9:16": "2160x3840",
        "4:3": "3328x2496",
        "3:4": "2496x3328",
        "3:2": "3520x2336",
        "2:3": "2336x3520",
    },
};

export function isGptImage2Model(model: string) {
    return modelOptionName(model).toLowerCase() === gptImage2Model;
}

export function isGeminiImagePreviewModel(model: string) {
    const value = modelOptionName(model).toLowerCase();
    return geminiImagePreviewModels.some((item) => value === item || value.includes(item));
}

export function isGptImage2Config(config: AiConfig | Pick<AiConfig, "model" | "imageModel">) {
    return isGptImage2Model(config.model || config.imageModel || "");
}

export function isGeminiImagePreviewConfig(config: AiConfig | Pick<AiConfig, "model" | "imageModel">) {
    return isGeminiImagePreviewModel(config.model || config.imageModel || "");
}

export function isGptImage2StyleConfig(config: AiConfig | Pick<AiConfig, "model" | "imageModel">) {
    return isGptImage2Config(config) || isGeminiImagePreviewConfig(config);
}

export function normalizeGptImage2Resolution(value: string) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "1k" || normalized === "low") return "1k";
    if (normalized === "4k" || normalized === "high" || normalized === "hd") return "4k";
    return "2k";
}

export function normalizeGptImage2Ratio(value: string) {
    const raw = String(value || "").trim().toLowerCase();
    if (gptImage2RatioOptions.some((item) => item.value === raw)) return raw;
    const match = raw.match(/^(\d+(?:\.\d+)?)(?:x|:)(\d+(?:\.\d+)?)/);
    if (!match) return "16:9";
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!width || !height) return "16:9";
    const ratio = width / height;
    return gptImage2RatioOptions.reduce((best, item) => {
        const [w, h] = item.value.split(":").map(Number);
        const current = Math.abs(w / h - ratio);
        const bestParts = best.split(":").map(Number);
        return current < Math.abs(bestParts[0] / bestParts[1] - ratio) ? item.value : best;
    }, "16:9");
}

export function resolveGptImage2Size(quality: string, size: string) {
    const resolution = normalizeGptImage2Resolution(quality);
    const ratio = normalizeGptImage2Ratio(size);
    return SIZE_MAP[resolution]?.[ratio] || SIZE_MAP["2k"]["16:9"];
}

export function gptImage2ResolutionLabel(value: string) {
    const resolution = normalizeGptImage2Resolution(value);
    return gptImage2ResolutionOptions.find((item) => item.value === resolution)?.label || resolution.toUpperCase();
}

export function gptImage2RatioLabel(value: string) {
    return normalizeGptImage2Ratio(value);
}
