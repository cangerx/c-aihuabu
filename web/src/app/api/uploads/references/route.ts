import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_DIR_BYTES = 2 * 1024 * 1024 * 1024;
const uploadDir = process.env.C_AI_UPLOAD_DIR || path.join(process.cwd(), "data", "uploads", "references");
const publicBaseUrl = process.env.C_AI_PUBLIC_BASE_URL?.replace(/\/+$/, "");

export async function POST(request: NextRequest) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ code: 400, msg: "缺少上传文件" }, { status: 400 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ code: 400, msg: "仅支持上传图片参考素材" }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ code: 413, msg: "图片不能超过 30MB" }, { status: 413 });

    await mkdir(uploadDir, { recursive: true });
    const ext = imageExtension(file.type, file.name);
    const name = `${Date.now()}-${nanoid(10)}.${ext}`;
    const target = path.join(uploadDir, name);
    await writeFile(target, Buffer.from(await file.arrayBuffer()));
    await cleanupUploadDir();

    return NextResponse.json({ code: 0, data: { url: `${publicBaseUrl || request.nextUrl.origin}/api/uploads/references/${name}`, name }, msg: "ok" });
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

function imageExtension(mimeType: string, fileName: string) {
    if (mimeType.includes("jpeg")) return "jpg";
    if (mimeType.includes("webp")) return "webp";
    if (mimeType.includes("gif")) return "gif";
    if (mimeType.includes("png")) return "png";
    const ext = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
    return ext && /^[a-z0-9]+$/.test(ext) ? ext : "png";
}
