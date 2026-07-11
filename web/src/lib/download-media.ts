import { saveAs } from "file-saver";

import { getImageBlob, proxiedImageDisplayUrl, unwrapProxiedMediaUrl } from "@/services/image-storage";
import { getMediaBlob } from "@/services/file-storage";

/** 远程 http://IP 或跨域 URL 不能直接 saveAs，需先拉成 blob。 */
export async function downloadMediaFile(source: string | Blob, fileName: string, storageKey?: string) {
    if (typeof source !== "string") {
        saveAs(source, fileName);
        return;
    }
    const value = String(source || "").trim();
    if (!value && !storageKey) throw new Error("没有可下载的文件");
    if (value.startsWith("blob:") || value.startsWith("data:")) {
        saveAs(value, fileName);
        return;
    }
    if (storageKey) {
        const blob = storageKey.startsWith("image:") ? await getImageBlob(storageKey) : await getMediaBlob(storageKey);
        if (blob) {
            saveAs(blob, fileName);
            return;
        }
    }
    if (!value) throw new Error("没有可下载的文件");
    const remote = unwrapProxiedMediaUrl(value);
    const response = await fetch(proxiedImageDisplayUrl(remote));
    if (!response.ok) throw new Error(`下载失败（${response.status}）`);
    saveAs(await response.blob(), fileName);
}


export function mediaFileExtension(source: string, mimeType?: string, fallback = "png") {
    const mime = String(mimeType || "").toLowerCase();
    if (mime.includes("png")) return "png";
    if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
    if (mime.includes("webp")) return "webp";
    if (mime.includes("gif")) return "gif";
    if (mime.includes("mp4")) return "mp4";
    if (mime.includes("webm")) return "webm";
    if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
    if (mime.includes("wav")) return "wav";
    const value = String(source || "");
    if (value.includes(".png") || value.startsWith("data:image/png")) return "png";
    if (value.includes(".jpg") || value.includes(".jpeg") || value.startsWith("data:image/jpeg")) return "jpg";
    if (value.includes(".webp") || value.startsWith("data:image/webp")) return "webp";
    if (value.includes(".mp4")) return "mp4";
    if (value.includes(".webm")) return "webm";
    return fallback;
}
