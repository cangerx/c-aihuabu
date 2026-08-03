import localforage from "localforage";

import { runPromptSource, type RawPrompt } from "./prompt-source-runtime";
import { usePromptSourceStore } from "@/stores/use-prompt-source-store";
import type { PromptSource } from "./prompt-source-presets";

export type Prompt = RawPrompt & {
    sourceId: string;
    category: string;
    githubUrl: string;
};

export const ALL_PROMPTS_OPTION = "全部";

export type PromptListResponse = {
    items: Prompt[];
    tags: string[];
    categories: string[];
    total: number;
};

export type PromptSourceStatus = {
    sourceId: string;
    count: number;
    lastSuccessAt: string;
    lastError: string;
};

export type PromptSourceRefreshResult = PromptSourceStatus & {
    sourceName: string;
    success: boolean;
};

export type PromptSourceRefreshSummary = {
    results: PromptSourceRefreshResult[];
    total: number;
    successCount: number;
    failureCount: number;
};

type SourceCache = PromptSourceStatus & {
    items: Prompt[];
    fetchedAt: number;
    signature: string;
};

const cacheTtlMs = 1000 * 60 * 60;
const promptCacheStore = localforage.createInstance({ name: "infinite-canvas", storeName: "prompt_cache" });
const loadingSources = new Map<string, Promise<PromptSourceRefreshResult>>();

export const CATEGORY_MAP: Record<string, string> = {
    "banana-prompt-quicker": "Banana 快捷",
    "gpt-image-2-prompts": "EvoLink 创意",
    "awesome-gpt-image": "Awesome 图像",
    "awesome-gpt4o-image-prompts": "GPT-4o 精选",
    "youmind-gpt-image-2": "YouMind 图像",
    "youmind-nano-banana-pro": "Nano Banana",
    "davidwu-gpt-image2-prompts": "DavidWu 精选",
};

export const TAG_MAP: Record<string, string> = {
    portrait: "肖像",
    portraits: "肖像",
    character: "角色",
    "character design": "角色设计",
    illustration: "插画",
    illustrations: "插画",
    drawing: "绘画",
    painting: "油画",
    sketch: "素描",
    watercolor: "水彩",
    poster: "海报",
    "poster design": "海报设计",
    "ad-creative": "广告创意",
    "ad creative": "广告创意",
    advertising: "广告创意",
    ecommerce: "电商",
    "e-commerce": "电商",
    product: "产品",
    ui: "UI设计",
    "ui design": "UI设计",
    comparison: "对比",
    photography: "摄影",
    realism: "写实",
    realistic: "写实",
    nature: "自然",
    landscape: "风景",
    scenery: "风景",
    architecture: "建筑",
    space: "空间",
    tech: "科技",
    "sci-fi": "科幻",
    cyberpunk: "赛博朋克",
    game: "游戏",
    "game ui": "游戏UI",
    game_ui: "游戏UI",
    "3d": "3D",
    "3d render": "3D渲染",
    "3d_render": "3D渲染",
    anime: "动漫",
    anime_illustration: "动漫插画",
    cartoon: "卡通",
    comic: "漫画",
    animation: "动画",
    gpt4o: "GPT-4o",
    "gpt-image-2": "GPT Image 2",
    "nano-banana-pro": "Nano Banana",
};

export function cleanTag(tag: string): string | null {
    if (!tag) return null;

    // Remove tags starting with @ or containing typical author names
    if (tag.startsWith("@") || tag.includes("_ai") || tag.includes("sora")) {
        return null;
    }

    // Filter out common repo name or junk tags
    const lower = tag.toLowerCase().trim();
    if (
        lower.startsWith("awesome-") ||
        lower.startsWith("youmind-") ||
        lower.includes("github") ||
        lower.includes("raw") ||
        lower === "other" ||
        lower === "others" ||
        lower === "etc" ||
        lower.length <= 1 ||
        lower.length > 15
    ) {
        return null;
    }

    // Check normalization map
    if (TAG_MAP[lower]) {
        return TAG_MAP[lower];
    }

    // Clean up heading tags with numbers, like "1 概念" or "1. 概念"
    const cleanStr = tag.replace(/^\d+[\s.、]*/, "").trim();
    if (!cleanStr) return null;

    // Capitalize acronyms
    if (["ui", "ux", "3d", "api", "gpt"].includes(cleanStr.toLowerCase())) {
        return cleanStr.toUpperCase();
    }

    // Keep it if it doesn't look like garbage (e.g. contains special symbols)
    if (/^[a-zA-Z0-9一-龥\s\-_]+$/.test(cleanStr)) {
        return cleanStr;
    }

    return null;
}

function enabledSources() {
    return usePromptSourceStore.getState().sources.filter((source) => source.enabled);
}

function cacheKey(sourceId: string) {
    return `prompt-source:${sourceId}`;
}

function sourceSignature(source: PromptSource) {
    const value = `${source.name}\n${source.url}\n${source.homepage}`;
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
    return `${value.length}:${hash}`;
}

function withSourceMeta(source: PromptSource, items: RawPrompt[]): Prompt[] {
    return items.map((item) => ({
        ...item,
        description: item.description || "",
        referenceImageUrls: Array.isArray(item.referenceImageUrls) ? item.referenceImageUrls : [],
        sourceId: source.id,
        category: source.id,
        githubUrl: item.sourceUrl || source.homepage,
    }));
}

async function readSourceCache(sourceId: string) {
    return promptCacheStore.getItem<SourceCache>(cacheKey(sourceId));
}

async function refreshSourceRecord(source: PromptSource): Promise<PromptSourceRefreshResult> {
    const previous = await readSourceCache(source.id);
    try {
        const items = withSourceMeta(source, await runPromptSource(source));
        const lastSuccessAt = new Date().toISOString();
        const cache: SourceCache = { sourceId: source.id, items, count: items.length, fetchedAt: Date.now(), lastSuccessAt, lastError: "", signature: sourceSignature(source) };
        await promptCacheStore.setItem(cacheKey(source.id), cache);
        return { sourceId: source.id, sourceName: source.name, count: items.length, lastSuccessAt, lastError: "", success: true };
    } catch (error) {
        const lastError = error instanceof Error ? error.message : String(error);
        const cache: SourceCache = {
            sourceId: source.id,
            items: previous?.items || [],
            count: previous?.items?.length || 0,
            fetchedAt: previous?.fetchedAt || 0,
            lastSuccessAt: previous?.lastSuccessAt || "",
            lastError,
            signature: previous?.signature || sourceSignature(source),
        };
        await promptCacheStore.setItem(cacheKey(source.id), cache);
        return { sourceId: source.id, sourceName: source.name, count: cache.count, lastSuccessAt: cache.lastSuccessAt, lastError, success: false };
    }
}

function getOrStartRefresh(source: PromptSource) {
    const current = loadingSources.get(source.id);
    if (current) return current;
    const loading = refreshSourceRecord(source).finally(() => loadingSources.delete(source.id));
    loadingSources.set(source.id, loading);
    return loading;
}

async function getSourcePrompts(source: PromptSource): Promise<Prompt[]> {
    const cached = await readSourceCache(source.id);
    if (cached) {
        const stale = cached.signature !== sourceSignature(source) || Date.now() - cached.fetchedAt >= cacheTtlMs;
        if (stale) void getOrStartRefresh(source).catch(() => undefined);
        return withSourceMeta(source, cached.items);
    }
    const result = await getOrStartRefresh(source);
    if (!result.success) throw new Error(result.lastError);
    return (await readSourceCache(source.id))?.items || [];
}

async function getAllPrompts(): Promise<Prompt[]> {
    const settled = await Promise.all(
        enabledSources().map(async (source) => {
            try {
                return await getSourcePrompts(source);
            } catch {
                return [];
            }
        }),
    );
    return settled.flat();
}

export async function fetchPrompts({ keyword = "", tag = [], category = ALL_PROMPTS_OPTION, page = 1, pageSize = 20 }: { keyword?: string; tag?: string[]; category?: string; page?: number; pageSize?: number } = {}) {
    const items = await getAllPrompts();
    const normalizedKeyword = keyword.trim().toLowerCase();
    const normalizedPage = Math.max(1, page);
    const normalizedPageSize = Math.max(1, Math.min(100, pageSize));
    const withoutTagFilter = filterPrompts(items, { keyword: normalizedKeyword, category, tags: [] });
    const filtered = filterPrompts(items, { keyword: normalizedKeyword, category, tags: tag });
    const categories = enabledSources().map((source) => source.id);

    return {
        items: filtered.slice((normalizedPage - 1) * normalizedPageSize, normalizedPage * normalizedPageSize),
        tags: collectTags(withoutTagFilter),
        categories,
        total: filtered.length,
    };
}

export async function fetchSourcePrompts(sourceId: string): Promise<Prompt[]> {
    const source = usePromptSourceStore.getState().sources.find((item) => item.id === sourceId);
    if (!source) throw new Error("提示词来源不存在");
    return getSourcePrompts(source);
}

export async function refreshSource(sourceId: string): Promise<PromptSourceRefreshResult> {
    const source = usePromptSourceStore.getState().sources.find((item) => item.id === sourceId);
    if (!source) throw new Error("提示词来源不存在");
    const result = await getOrStartRefresh(source);
    if (!result.success) throw new Error(result.lastError);
    return result;
}

export async function refreshAllSources(): Promise<PromptSourceRefreshSummary> {
    const results = await Promise.all(enabledSources().map(getOrStartRefresh));
    return summarizeRefresh(results);
}

export async function refreshDueSources(maxAgeMs: number): Promise<PromptSourceRefreshSummary> {
    const sources = await Promise.all(
        enabledSources().map(async (source) => {
            const cached = await readSourceCache(source.id);
            const lastSuccess = cached?.lastSuccessAt ? new Date(cached.lastSuccessAt).getTime() : 0;
            return !lastSuccess || Boolean(cached?.lastError) || Date.now() - lastSuccess >= maxAgeMs || cached?.signature !== sourceSignature(source) ? source : null;
        }),
    );
    const results = await Promise.all(sources.filter((source): source is PromptSource => Boolean(source)).map(getOrStartRefresh));
    return summarizeRefresh(results);
}

export async function fetchPromptSourceStatuses(): Promise<Record<string, PromptSourceStatus>> {
    const entries = await Promise.all(
        usePromptSourceStore.getState().sources.map(async (source) => {
            const cache = await readSourceCache(source.id);
            return [source.id, { sourceId: source.id, count: cache?.items?.length || 0, lastSuccessAt: cache?.lastSuccessAt || "", lastError: cache?.lastError || "" }] as const;
        }),
    );
    return Object.fromEntries(entries);
}

function summarizeRefresh(results: PromptSourceRefreshResult[]): PromptSourceRefreshSummary {
    return {
        results,
        total: results.reduce((total, item) => total + item.count, 0),
        successCount: results.filter((item) => item.success).length,
        failureCount: results.filter((item) => !item.success).length,
    };
}

function filterPrompts(items: Prompt[], options: { keyword: string; category: string; tags: string[] }) {
    return items.filter((item) => {
        if (isActiveOption(options.category) && item.category !== options.category) return false;
        if (options.tags.length && !options.tags.some((tag) => item.tags.includes(tag))) return false;
        if (!options.keyword) return true;
        return [item.title, item.prompt, item.description, item.category, ...item.tags].join(" ").toLowerCase().includes(options.keyword);
    });
}

function collectTags(items: Prompt[]) {
    return Array.from(new Set(items.flatMap((item) => item.tags).filter(Boolean)));
}

function isActiveOption(value: string) {
    return value && value !== ALL_PROMPTS_OPTION && value !== "all";
}

export function formatPromptDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
