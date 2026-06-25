import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const uploadUrl = process.env.C_AI_NEWTOKEN_MEDIA_UPLOAD_URL || "https://www.aimh8.com/agent/openapi/fpbrowser2api/v1/media/upload";
const defaultUploadKey = "4f4d1159234c4a00a51a570162f12a816b5b618df16ac95e942481dad4965661";

type UploadResponse = {
    success?: boolean;
    url?: string;
    image_url?: string;
    video_url?: string;
    audio_url?: string;
    msg?: string;
    message?: string;
    error?: { message?: string };
};

export async function POST(request: NextRequest) {
    const apiKey = process.env.C_AI_NEWTOKEN_MEDIA_UPLOAD_KEY || defaultUploadKey;
    if (!apiKey) return NextResponse.json({ code: 500, data: null, msg: "服务端未配置 NewToken 参考素材上传 Key" }, { status: 500 });

    const form = await request.formData();
    const remoteUrl = String(form.get("url") || "").trim();
    let file = form.get("file");
    if (!(file instanceof File) && remoteUrl) {
        const fetched = await fetchRemoteFile(remoteUrl, request.signal);
        if (fetched instanceof NextResponse) return fetched;
        file = fetched;
    }
    if (!(file instanceof File)) return NextResponse.json({ code: 400, data: null, msg: "缺少上传文件" }, { status: 400 });
    const limit = uploadLimit(file.type);
    if (!limit) return NextResponse.json({ code: 400, data: null, msg: "仅支持上传图片、视频或音频参考素材" }, { status: 400 });
    if (file.size > limit.bytes) return NextResponse.json({ code: 413, data: null, msg: `${limit.label}不能超过 ${Math.floor(limit.bytes / 1024 / 1024)}MB` }, { status: 413 });

    const upstreamForm = new FormData();
    upstreamForm.append("file", file, file.name || `reference.${fallbackExtension(file.type)}`);
    const upstream = await fetch(uploadUrl, {
        method: "POST",
        headers: { Accept: "application/json", "x-api-key": apiKey },
        body: upstreamForm,
    });
    const payload = (await upstream.json().catch(() => null)) as UploadResponse | null;
    const url = payload?.url || payload?.image_url || payload?.video_url || payload?.audio_url || "";
    if (!upstream.ok || !payload?.success || !url) {
        return NextResponse.json({ code: upstream.status || 500, data: null, msg: payload?.msg || payload?.message || payload?.error?.message || "NewToken 参考素材上传失败" }, { status: upstream.ok ? 500 : upstream.status });
    }
    return NextResponse.json({ code: 0, data: { url, upstream: payload }, msg: "ok" });
}

async function fetchRemoteFile(url: string, signal: AbortSignal) {
    if (!isReachableHttpsUrl(url)) return NextResponse.json({ code: 400, data: null, msg: "远程素材必须是公网 HTTPS URL" }, { status: 400 });
    const response = await fetch(url, { signal, cache: "no-store" }).catch(() => null);
    if (!response?.ok) return NextResponse.json({ code: response?.status || 400, data: null, msg: "远程素材下载失败" }, { status: 400 });
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const limit = uploadLimit(contentType);
    if (!limit) return NextResponse.json({ code: 400, data: null, msg: "远程素材类型不支持" }, { status: 400 });
    const blob = await response.blob();
    if (blob.size > limit.bytes) return NextResponse.json({ code: 413, data: null, msg: `${limit.label}不能超过 ${Math.floor(limit.bytes / 1024 / 1024)}MB` }, { status: 413 });
    const name = url.split("/").pop()?.split("?")[0] || `reference.${fallbackExtension(contentType)}`;
    return new File([blob], name, { type: contentType });
}

function uploadLimit(mimeType: string) {
    if (mimeType.startsWith("image/")) return { bytes: MAX_IMAGE_BYTES, label: "图片" };
    if (mimeType.startsWith("video/")) return { bytes: MAX_VIDEO_BYTES, label: "视频" };
    if (mimeType.startsWith("audio/")) return { bytes: MAX_AUDIO_BYTES, label: "音频" };
    return null;
}

function fallbackExtension(mimeType: string) {
    if (mimeType.includes("jpeg")) return "jpg";
    if (mimeType.includes("webp")) return "webp";
    if (mimeType.includes("gif")) return "gif";
    if (mimeType.includes("mp4")) return "mp4";
    if (mimeType.includes("quicktime")) return "mov";
    if (mimeType.includes("mpeg")) return "mp3";
    if (mimeType.includes("wav")) return "wav";
    return "png";
}

function isReachableHttpsUrl(value: string) {
    if (!/^https:\/\//i.test(value || "")) return false;
    try {
        const host = new URL(value).hostname.toLowerCase();
        return host !== "localhost" && host !== "127.0.0.1" && !host.endsWith(".local");
    } catch {
        return false;
    }
}
