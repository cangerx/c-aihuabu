import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_AUDIO_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_DIR_BYTES = 2 * 1024 * 1024 * 1024;
const uploadDir = process.env.C_AI_UPLOAD_DIR || path.join(process.cwd(), "data", "uploads", "references");
const publicBaseUrl = process.env.C_AI_PUBLIC_BASE_URL?.replace(/\/+$/, "");

export async function POST(request: NextRequest) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ code: 400, msg: "缺少上传文件" }, { status: 400 });
    const limit = uploadLimit(file.type);
    if (!limit) return NextResponse.json({ code: 400, msg: "仅支持上传图片、视频或音频参考素材" }, { status: 400 });
    if (file.size > limit.bytes) return NextResponse.json({ code: 413, msg: `${limit.label}不能超过 ${Math.floor(limit.bytes / 1024 / 1024)}MB` }, { status: 413 });

    await mkdir(uploadDir, { recursive: true });
    const ext = mediaExtension(file.type, file.name);
    const name = `${Date.now()}-${nanoid(10)}.${ext}`;
    const target = path.join(uploadDir, name);
    await writeFile(target, Buffer.from(await file.arrayBuffer()));
    await cleanupUploadDir();

    return NextResponse.json({ code: 0, data: { url: `${publicBaseUrl || request.nextUrl.origin}/api/uploads/references/${name}`, name }, msg: "ok" });
}

function uploadLimit(mimeType: string) {
    if (mimeType.startsWith("image/")) return { bytes: MAX_UPLOAD_BYTES, label: "图片" };
    if (mimeType.startsWith("video/")) return { bytes: MAX_VIDEO_UPLOAD_BYTES, label: "视频" };
    if (mimeType.startsWith("audio/")) return { bytes: MAX_AUDIO_UPLOAD_BYTES, label: "音频" };
    return null;
}

async function cleanupUploadDir() {
    const entries = await readdir(uploadDir).catch(() => []);
    const files = (
        await Promise.all(
            entries.map(async (name) => {
                const fullPath = path.join(uploadDir, name);
                const info = await stat(fullPath).catch(() => null);
                return info?.isFile() ? { name, fullPath, size: info.size, mtimeMs: info.mtimeMs } : null;
            }),
        )
    )
        .filter((item): item is { name: string; fullPath: string; size: number; mtimeMs: number } => Boolean(item))
        .sort((a, b) => a.mtimeMs - b.mtimeMs);
    let total = files.reduce((sum, file) => sum + file.size, 0);
    for (const file of files) {
        if (total <= MAX_DIR_BYTES) break;
        await unlink(file.fullPath).catch(() => undefined);
        total -= file.size;
    }
}

function mediaExtension(mimeType: string, fileName: string) {
    if (mimeType.includes("jpeg")) return "jpg";
    if (mimeType.includes("webp")) return "webp";
    if (mimeType.includes("gif")) return "gif";
    if (mimeType.includes("png")) return "png";
    if (mimeType.includes("quicktime")) return "mov";
    if (mimeType.includes("mp4")) return "mp4";
    if (mimeType.includes("mpeg")) return "mp3";
    if (mimeType.includes("wav")) return "wav";
    const ext = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
    return ext && /^[a-z0-9]+$/.test(ext) ? ext : "png";
}
