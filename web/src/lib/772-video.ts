import { modelOptionName } from "@/stores/use-config-store";

export type Video772Protocol = "legacy" | "unified";
export type Video772ReferenceLimits = { images: number; videos: number; audios: number };

// The API keys expose these two model families on either hostname, so protocol selection must not depend on the URL.
const legacy772VideoModelPatterns = [
    /^videos-(?:standard|fast|mini)(?:-|$)/,
    /^sd-2\.0-/,
    /^seedance-2-5(?:-|$)/,
    /^minimax-h3-f(?:-|$)/,
    /^alibaba\/wan-3\.0(?:-|$)/,
];

const unified772VideoModelPatterns = [
    /^seedance2\.(?:0|5)(?:-|$)/,
    /^seedance-2\.0-/,
    /^seedance-2\.5-lec-/,
    /^minimax-h3-(?!f(?:-|$))/,
];

function normalized772VideoModel(model: string) {
    return modelOptionName(model).trim().toLowerCase();
}

export function get772VideoProtocol(model: string): Video772Protocol | null {
    const value = normalized772VideoModel(model);
    if (legacy772VideoModelPatterns.some((pattern) => pattern.test(value))) return "legacy";
    if (unified772VideoModelPatterns.some((pattern) => pattern.test(value))) return "unified";
    return null;
}

export function is772VideoModel(model: string) {
    return Boolean(get772VideoProtocol(model));
}

export function is772MinimaxH3Model(model: string) {
    return normalized772VideoModel(model).startsWith("minimax-h3-");
}

export function is772UnifiedMinimaxH3VideoModel(model: string) {
    return get772VideoProtocol(model) === "unified" && is772MinimaxH3Model(model);
}

export function get772VideoReferenceLimits(model: string): Video772ReferenceLimits | null {
    const protocol = get772VideoProtocol(model);
    if (!protocol) return null;
    if (protocol === "legacy") return { images: 9, videos: 3, audios: 3 };
    if (is772UnifiedMinimaxH3VideoModel(model)) return { images: 9, videos: 0, audios: 3 };
    return { images: 30, videos: 10, audios: 10 };
}
