import { modelOptionName, resolveModelRequestConfig, type AiConfig } from "@/stores/use-config-store";

export const stepImageEdit2SizeOptions = [
    { value: "1024x1024", label: "方形", width: 1024, height: 1024 },
    { value: "768x1360", label: "16:9", width: 1360, height: 768 },
    { value: "896x1184", label: "4:3", width: 1184, height: 896 },
    { value: "1360x768", label: "9:16", width: 768, height: 1360 },
    { value: "1184x896", label: "3:4", width: 896, height: 1184 },
] as const;

export function isStepImageEdit2Config(config: AiConfig | Pick<AiConfig, "model" | "imageModel" | "baseUrl" | "apiFormat">) {
    const requestConfig = "channels" in config ? resolveModelRequestConfig(config, config.model || config.imageModel) : config;
    return isStepImageEdit2Model(modelOptionName(requestConfig.model || requestConfig.imageModel));
}

export function isStepImageEdit2Model(model: string) {
    return model.toLowerCase().includes("step-image-edit-2");
}

export function normalizeStepImageEdit2Size(value: string) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw || raw === "auto") return stepImageEdit2SizeOptions[0].value;
    const matched = stepImageEdit2SizeOptions.find((item) => item.value === raw);
    if (matched) return matched.value;
    const dimensions = resolveImageSizeDimensions(raw);
    if (!dimensions) return stepImageEdit2SizeOptions[0].value;
    const ratio = dimensions.width / dimensions.height;
    return stepImageEdit2SizeOptions.reduce((best, item) => {
        const bestRatio = best.width / best.height;
        const itemRatio = item.width / item.height;
        return Math.abs(itemRatio - ratio) < Math.abs(bestRatio - ratio) ? item : best;
    }, stepImageEdit2SizeOptions[0]).value;
}

export function stepImageEdit2SizeLabel(value: string) {
    const option = stepImageEdit2SizeOptions.find((item) => item.value === normalizeStepImageEdit2Size(value));
    return option?.label || value;
}

export function resolveImageSizeDimensions(value: string) {
    const raw = String(value || "").trim().toLowerCase();
    const stepOption = stepImageEdit2SizeOptions.find((item) => item.value === raw);
    if (stepOption) return { width: stepOption.width, height: stepOption.height };
    if (!raw || raw === "auto") return null;
    const match = raw.match(/^(\d+(?:\.\d+)?)(?:x|:)(\d+(?:\.\d+)?)$/);
    if (!match) return null;
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
    return { width, height };
}

export function isPortraitImageSize(value: string) {
    const dimensions = resolveImageSizeDimensions(value);
    return Boolean(dimensions && dimensions.height > dimensions.width);
}
