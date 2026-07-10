import type { ReferenceImage } from "@/types/image";

export function formatBytes(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return "";
    }
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

export function formatDuration(ms: number) {
    const value = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(value / 60);
    const seconds = value % 60;
    return minutes ? `${minutes}分${String(seconds).padStart(2, "0")}秒` : `${seconds}秒`;
}

export function getDataUrlByteSize(dataUrl: string) {
    const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
    if (!base64) {
        return 0;
    }
    const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

/** 比 dataURL → fetch → blob 快：避免再构造/解析超长 data: 字符串。 */
export function base64ToBlob(base64: string, mimeType = "image/png") {
    const normalized = normalizeBase64Payload(base64);
    if (!normalized) throw new Error("无效的 base64 图片数据");
    const fromBase64 = (Uint8Array as unknown as { fromBase64?: (value: string, options?: { alphabet?: string }) => Uint8Array }).fromBase64;
    if (typeof fromBase64 === "function") {
        try {
            return new Blob([fromBase64(normalized, { alphabet: "base64" }) as BlobPart], { type: mimeType });
        } catch {
            // 部分浏览器 fromBase64 对大串/空白更严格，回退 atob
        }
    }
    const binary = atob(normalized);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    const chunk = 0x8000;
    for (let offset = 0; offset < len; offset += chunk) {
        const end = Math.min(offset + chunk, len);
        for (let i = offset; i < end; i += 1) bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
}

export function normalizeBase64Payload(value: string) {
    const raw = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
    // 去空白，兼容 url-safe base64
    return raw.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
}

export function dataUrlMimeType(dataUrl: string, fallback = "image/png") {
    return dataUrl.match(/^data:([^;,]+)/)?.[1] || fallback;
}

export function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("读取图片失败"));
        reader.readAsDataURL(file);
    });
}

export function readImageMeta(dataUrl: string) {
    return new Promise<{ width: number; height: number; mimeType: string }>((resolve) => {
        const image = new Image();
        const done = () => resolve({ width: image.naturalWidth || 1024, height: image.naturalHeight || 1024, mimeType: dataUrl.match(/^data:([^;]+)/)?.[1] || "image/png" });
        image.onload = done;
        image.onerror = done;
        setTimeout(done, 3000);
        image.src = dataUrl;
    });
}

export function dataUrlToFile(image: ReferenceImage) {
    const mimeType = dataUrlMimeType(image.dataUrl, image.type || "image/png");
    const blob = base64ToBlob(image.dataUrl, mimeType);
    return new File([blob], image.name || "reference.png", { type: mimeType });
}

export async function sanitizeImageDataUrl(dataUrl: string, options: { perturb?: boolean } = {}) {
    const image = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const context = canvas.getContext("2d", { willReadFrequently: Boolean(options.perturb) });
    if (!context) throw new Error("无法处理图片");
    context.drawImage(image, 0, 0);
    if (options.perturb) perturbCanvasPixels(context, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
}

/** 压缩参考图为较小 JPEG dataURL，降低代理超时概率。 */
export async function compressImageDataUrl(dataUrl: string, maxEdge = 1280, quality = 0.82) {
    const image = await loadImage(dataUrl);
    const width = image.naturalWidth || image.width || 1;
    const height = image.naturalHeight || image.height || 1;
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法压缩图片");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
}

function loadImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("图片读取失败"));
        image.src = src;
    });
}

function perturbCanvasPixels(context: CanvasRenderingContext2D, width: number, height: number) {
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;
    const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 1200)));
    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const index = (y * width + x) * 4;
            data[index] = Math.max(0, Math.min(255, data[index] + ((x + y) % 2 ? 1 : -1)));
        }
    }
    context.putImageData(imageData, 0, 0);
}
