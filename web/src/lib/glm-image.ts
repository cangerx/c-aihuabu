import { modelOptionName, resolveModelRequestConfig, type AiConfig } from "@/stores/use-config-store";

export const glmImageSizeOptions = [
    { value: "2048x2048", label: "1:1", width: 2048, height: 2048 },
    { value: "2048x1536", label: "4:3", width: 2048, height: 1536 },
    { value: "1536x2048", label: "3:4", hint: "小红书", width: 1536, height: 2048 },
    { value: "2048x1360", label: "3:2", width: 2048, height: 1360 },
    { value: "1360x2048", label: "2:3", hint: "小红书长图", width: 1360, height: 2048 },
    { value: "2048x1152", label: "16:9", width: 2048, height: 1152 },
    { value: "1152x2048", label: "9:16", width: 1152, height: 2048 },
] as const;

export function isGlmImageConfig(config: AiConfig | Pick<AiConfig, "model" | "imageModel" | "baseUrl">) {
    const requestConfig = "channels" in config ? resolveModelRequestConfig(config, config.model || config.imageModel) : config;
    const model = modelOptionName(requestConfig.model || requestConfig.imageModel);
    return isGlmImageModel(model) || isZImageTurboModel(model);
}

export function isGlmImageModel(model: string) {
    return model.toLowerCase().includes("glm-image");
}

export function isZImageTurboModel(model: string) {
    return model.toLowerCase() === "z-image-turbo";
}

export function normalizeGlmImageSize(value: string) {
    const raw = String(value || "").trim().toLowerCase();
    const matched = glmImageSizeOptions.find((item) => item.value === raw);
    if (matched) return matched.value;
    const dimensions = raw.match(/^(\d+(?:\.\d+)?)(?:x|:)(\d+(?:\.\d+)?)$/);
    if (!dimensions) return glmImageSizeOptions[0].value;
    const ratio = Number(dimensions[1]) / Number(dimensions[2]);
    return glmImageSizeOptions.reduce((best, item) => Math.abs(item.width / item.height - ratio) < Math.abs(best.width / best.height - ratio) ? item : best, glmImageSizeOptions[0]).value;
}

export function glmImageSizeLabel(value: string) {
    return glmImageSizeOptions.find((item) => item.value === normalizeGlmImageSize(value))?.label || value;
}

export function glmImageApiDimensions(value: string) {
    const item = glmImageSizeOptions.find((entry) => entry.value === normalizeGlmImageSize(value)) || glmImageSizeOptions[0];
    return { width: item.width, height: item.height };
}

export function normalizeGlmImageSteps(value: string) {
    return Math.max(1, Math.min(50, Math.floor(Number(value) || 9)));
}
