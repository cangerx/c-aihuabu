import { modelOptionName } from "@/stores/use-config-store";

// videos-4 系列走 JSON 版 /v1/videos 异步接口，字段与 OpenAI multipart 版不同。
export const videos4VideoModels = [
    "videos-4",
    "videos-4-480p",
    "videos-4-720p",
    "videos-4-fast",
    "videos-4-fast-480p",
    "videos-4-fast-720p",
    "videos-4-mini",
    "videos-4-mini-480p",
    "videos-4-mini-720p",
];

export const videos4RatioOptions = ["16:9", "9:16", "1:1"];
export const videos4ResolutionOptions = ["720p", "480p"];

export const VIDEOS4_REFERENCE_LIMITS = { images: 9, videos: 3, audios: 3 };
export const VIDEOS4_POLL_INTERVAL_MS = 5000;

export function isVideos4VideoModel(model: string) {
    return videos4VideoModels.includes(modelOptionName(model).trim().toLowerCase());
}

/** 模型名自带分辨率时以模型名为准，避免和 resolution 字段冲突。 */
export function videos4ResolutionFromModel(model: string) {
    const value = modelOptionName(model).trim().toLowerCase();
    if (value.endsWith("-480p")) return "480p";
    if (value.endsWith("-720p")) return "720p";
    return "";
}

export function normalizeVideos4Ratio(value: string) {
    const ratio = String(value || "").trim();
    if (videos4RatioOptions.includes(ratio)) return ratio;
    const match = ratio.match(/^(\d+)\s*[:x×]\s*(\d+)$/i);
    if (!match) return "16:9";
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!width || !height) return "16:9";
    if (Math.abs(width / height - 1) < 0.05) return "1:1";
    return width >= height ? "16:9" : "9:16";
}

export function normalizeVideos4Resolution(value: string, model: string) {
    const fromModel = videos4ResolutionFromModel(model);
    if (fromModel) return fromModel;
    const resolution = String(value || "")
        .trim()
        .toLowerCase();
    return videos4ResolutionOptions.includes(resolution) ? resolution : "720p";
}

/** 文档限制 4-15 秒，默认 5。 */
export function normalizeVideos4Duration(value: string) {
    const seconds = Math.floor(Number(value) || 5);
    return Math.max(4, Math.min(15, seconds));
}
