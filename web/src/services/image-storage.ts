"use client";

import localforage from "localforage";

import { nanoid } from "nanoid";
import { base64ToBlob, dataUrlMimeType, readImageMeta } from "@/lib/image-utils";

export type UploadedImage = {
    url: string;
    storageKey: string;
    width: number;
    height: number;
    bytes: number;
    mimeType: string;
};

const store = localforage.createInstance({ name: "infinite-canvas", storeName: "image_files" });
const objectUrls = new Map<string, string>();
const FALLBACK_IMAGE_META = { width: 1024, height: 1024, mimeType: "image/png" };

export async function uploadImage(input: string | Blob): Promise<UploadedImage> {
    const blob = typeof input === "string" ? await readBlobFromUrl(input) : input;
    const storageKey = `image:${nanoid()}`;
    await store.setItem(storageKey, blob);
    const url = URL.createObjectURL(blob);
    objectUrls.set(storageKey, url);
    const meta = await readImageMeta(url);
    return { url, storageKey, width: meta.width, height: meta.height, bytes: blob.size, mimeType: blob.type || meta.mimeType };
}

export function imageDisplayUrl(url: string) {
    return proxiedImageDisplayUrl(url);
}

export async function persistImageUrl(input: string) {
    try {
        return await uploadImage(input);
    } catch {
        const meta = await readRemoteImageMeta(input);
        return { url: imageDisplayUrl(input), storageKey: "", width: meta.width, height: meta.height, bytes: 0, mimeType: meta.mimeType };
    }
}

/** 优先立即展示：远程 URL 保留原地址（展示层再代理）；b64/dataURL 直接解码成 Blob。 */
export async function prepareImageForDisplay(input: string): Promise<UploadedImage> {
    const value = String(input || "").trim();
    if (!value) throw new Error("没有可展示的图片");
    if (/^https?:\/\//i.test(value) || value.startsWith("blob:")) {
        // 远程 URL 不改写成 /api/proxy，便于落盘/重开时仍拿得到原始地址；展示走 proxiedImageDisplayUrl
        return { url: value, storageKey: "", width: FALLBACK_IMAGE_META.width, height: FALLBACK_IMAGE_META.height, bytes: 0, mimeType: FALLBACK_IMAGE_META.mimeType };
    }
    // dataURL 或裸 b64：一律按 base64 解码，避免误走 fetch 导致“拉取不到图片”
    try {
        const mimeType = value.startsWith("data:") ? dataUrlMimeType(value) : "image/png";
        const blob = base64ToBlob(value, mimeType);
        if (!blob.size) throw new Error("empty image blob");
        const storageKey = `image:${nanoid()}`;
        const url = URL.createObjectURL(blob);
        objectUrls.set(storageKey, url);
        // 必须先落盘再返回，否则历史列表只剩 storageKey、缩略图读不到
        await store.setItem(storageKey, blob);
        return { url, storageKey, width: FALLBACK_IMAGE_META.width, height: FALLBACK_IMAGE_META.height, bytes: blob.size, mimeType: blob.type || mimeType };
    } catch (error) {
        if (value.startsWith("data:")) {
            return { url: value, storageKey: "", width: FALLBACK_IMAGE_META.width, height: FALLBACK_IMAGE_META.height, bytes: 0, mimeType: dataUrlMimeType(value) };
        }
        throw error instanceof Error ? error : new Error("图片解码失败");
    }
}


/** 后台把远程 URL 转存到本地；先展示 URL，空闲后再慢慢下载，失败则保留原 URL。 */
export function persistImageUrlInBackground(input: string, onStored?: (image: UploadedImage) => void) {
    const value = String(input || "").trim();
    // 兼容节点 content 已是 /api/proxy?url= 的情况，落盘时还原真实上游地址再下载
    const remote = unwrapProxiedMediaUrl(value);
    if (!remote || remote.startsWith("data:") || remote.startsWith("blob:") || !/^https?:\/\//i.test(remote)) return;
    const run = () => {
        void uploadImage(remote)
            .then((stored) => onStored?.(stored))
            .catch(() => {
                // 保留原 URL 展示
            });
    };
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(() => run(), { timeout: 4000 });
        return;
    }
    setTimeout(run, 0);
}

export function unwrapProxiedMediaUrl(url: string) {
    const value = String(url || "").trim();
    if (!value) return value;
    try {
        if (value.startsWith("/api/proxy?")) {
            const params = new URLSearchParams(value.slice(value.indexOf("?") + 1));
            return params.get("url") || value;
        }
        if (typeof window !== "undefined" && value.startsWith(`${window.location.origin}/api/proxy?`)) {
            const parsed = new URL(value);
            return parsed.searchParams.get("url") || value;
        }
    } catch {
        return value;
    }
    return value;
}

/** HTTPS 页面不能直接加载 http://IP 图片（Mixed Content）；跨域远程图 fetch 常被 CORS 拦截。展示与拉取统一经同域代理。 */
export function proxiedImageDisplayUrl(url: string) {
    const value = String(url || "").trim();
    if (!value || value.startsWith("data:") || value.startsWith("blob:") || value.startsWith("/api/proxy")) return value;
    if (value.startsWith("/") && !value.startsWith("//")) return value;
    if (!/^https?:\/\//i.test(value)) return value;
    try {
        const parsed = new URL(value);
        if (typeof window !== "undefined" && parsed.origin === window.location.origin) return value;
        return `/api/proxy?url=${encodeURIComponent(value)}`;
    } catch {
        return value;
    }
}


export async function resolveImageUrl(storageKey?: string, fallback = "") {
    if (storageKey) {
        const cached = objectUrls.get(storageKey);
        if (cached) return cached;
        const blob = await store.getItem<Blob>(storageKey);
        if (blob) {
            const url = URL.createObjectURL(blob);
            objectUrls.set(storageKey, url);
            return url;
        }
    }
    return proxiedImageDisplayUrl(fallback);
}

export async function getImageBlob(storageKey: string) {
    return store.getItem<Blob>(storageKey);
}

export async function setImageBlob(storageKey: string, blob: Blob) {
    await store.setItem(storageKey, blob);
    const url = URL.createObjectURL(blob);
    objectUrls.set(storageKey, url);
    return url;
}

export async function imageToDataUrl(image: { url?: string; dataUrl?: string; storageKey?: string }) {
    const url = image.dataUrl || (await resolveImageUrl(image.storageKey, image.url || ""));
    if (!url || url.startsWith("data:")) return url;
    return blobToDataUrl(await readBlobFromUrl(url));
}

export async function deleteStoredImages(keys: Iterable<string>) {
    await Promise.all(
        Array.from(new Set(keys)).map(async (key) => {
            const url = objectUrls.get(key);
            if (url) URL.revokeObjectURL(url);
            objectUrls.delete(key);
            await store.removeItem(key);
        }),
    );
}

export async function cleanupUnusedImages(usedData: unknown) {
    const usedKeys = collectImageStorageKeys(usedData);
    const unused: string[] = [];
    await store.iterate((_value, key) => {
        if (!usedKeys.has(key)) unused.push(key);
    });
    await deleteStoredImages(unused);
}

export function collectImageStorageKeys(value: unknown, keys = new Set<string>()) {
    if (!value || typeof value !== "object") return keys;
    if ("storageKey" in value && typeof value.storageKey === "string" && value.storageKey.startsWith("image:")) keys.add(value.storageKey);
    Object.values(value).forEach((item) => (Array.isArray(item) ? item.forEach((child) => collectImageStorageKeys(child, keys)) : collectImageStorageKeys(item, keys)));
    return keys;
}

function blobToDataUrl(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("读取图片失败"));
        reader.readAsDataURL(blob);
    });
}

async function readBlobFromUrl(url: string) {
    const response = await fetch(proxiedImageDisplayUrl(url));
    if (!response.ok) throw new Error("读取图片失败");
    return response.blob();
}

async function readRemoteImageMeta(url: string) {
    const meta = await readImageMeta(proxiedImageDisplayUrl(url));
    if (meta.width !== FALLBACK_IMAGE_META.width || meta.height !== FALLBACK_IMAGE_META.height || url.startsWith("data:")) return meta;
    return FALLBACK_IMAGE_META;
}
