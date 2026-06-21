import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const uploadDir = process.env.C_AI_UPLOAD_DIR || path.join(process.cwd(), "data", "uploads", "references");

export async function GET(_request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
    const { name } = await params;
    if (!/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|gif|mp4|mov|mp3|wav)$/i.test(name)) return new NextResponse("Not found", { status: 404 });
    const filePath = path.join(uploadDir, name);
    const data = await readFile(filePath).catch(() => null);
    if (!data) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(data, {
        headers: {
            "Content-Type": contentType(name),
            "Cache-Control": "public, max-age=604800, immutable",
        },
    });
}

function contentType(name: string) {
    const value = name.toLowerCase();
    if (value.endsWith(".jpg") || value.endsWith(".jpeg")) return "image/jpeg";
    if (value.endsWith(".webp")) return "image/webp";
    if (value.endsWith(".gif")) return "image/gif";
    if (value.endsWith(".mp4")) return "video/mp4";
    if (value.endsWith(".mov")) return "video/quicktime";
    if (value.endsWith(".mp3")) return "audio/mpeg";
    if (value.endsWith(".wav")) return "audio/wav";
    return "image/png";
}
