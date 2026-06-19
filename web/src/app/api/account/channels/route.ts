import { nanoid } from "nanoid";

import { currentUser } from "@/server/account-auth";
import { readAccountDb, writeAccountDb, type CloudChannel } from "@/server/account-db";
import { fail, ok } from "@/server/api-response";
import { decryptSecret, encryptSecret, maskSecret } from "@/server/secret-box";
import type { ApiCallFormat } from "@/stores/use-config-store";

type ChannelBody = {
    id?: string;
    name?: string;
    baseUrl?: string;
    apiKey?: string;
    apiFormat?: ApiCallFormat;
    models?: string[];
};

export async function GET() {
    const user = await currentUser();
    if (!user) return fail("请先登录", 401);
    const channels = (await readAccountDb()).channels.filter((item) => item.userId === user.id).map(publicChannel);
    return ok({ channels });
}

export async function POST(request: Request) {
    const user = await currentUser();
    if (!user) return fail("请先登录", 401);
    const body = (await request.json().catch(() => ({}))) as ChannelBody;
    const name = (body.name || "").trim() || "云端渠道";
    const baseUrl = (body.baseUrl || "").trim();
    const apiKey = body.apiKey || "";
    if (!baseUrl) return fail("请填写 Base URL");
    if (!apiKey) return fail("请填写 API Key");

    const now = new Date().toISOString();
    const db = await readAccountDb();
    const channel: CloudChannel = {
        id: nanoid(24),
        userId: user.id,
        name,
        baseUrl,
        apiFormat: normalizeApiFormat(body.apiFormat),
        models: normalizeModels(body.models),
        encryptedApiKey: encryptSecret(apiKey),
        createdAt: now,
        updatedAt: now,
    };
    db.channels.push(channel);
    await writeAccountDb(db);
    return ok({ channel: publicChannel(channel) });
}

export async function PUT(request: Request) {
    const user = await currentUser();
    if (!user) return fail("请先登录", 401);
    const body = (await request.json().catch(() => ({}))) as ChannelBody;
    if (!body.id) return fail("缺少渠道 ID");

    const db = await readAccountDb();
    const channel = db.channels.find((item) => item.id === body.id && item.userId === user.id);
    if (!channel) return fail("渠道不存在", 404);
    channel.name = (body.name || channel.name).trim() || channel.name;
    channel.baseUrl = (body.baseUrl || channel.baseUrl).trim();
    channel.apiFormat = normalizeApiFormat(body.apiFormat || channel.apiFormat);
    channel.models = normalizeModels(body.models || channel.models);
    if (body.apiKey) channel.encryptedApiKey = encryptSecret(body.apiKey);
    channel.updatedAt = new Date().toISOString();
    await writeAccountDb(db);
    return ok({ channel: publicChannel(channel) });
}

export async function DELETE(request: Request) {
    const user = await currentUser();
    if (!user) return fail("请先登录", 401);
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!id) return fail("缺少渠道 ID");
    const db = await readAccountDb();
    db.channels = db.channels.filter((item) => item.userId !== user.id || item.id !== id);
    await writeAccountDb(db);
    return ok({ success: true });
}

function publicChannel(channel: CloudChannel) {
    let apiKeyPreview = "";
    try {
        apiKeyPreview = maskSecret(decryptSecret(channel.encryptedApiKey));
    } catch {
        apiKeyPreview = "****";
    }
    return {
        id: channel.id,
        scope: "cloud_personal" as const,
        name: channel.name,
        baseUrl: channel.baseUrl,
        apiFormat: channel.apiFormat,
        models: channel.models,
        apiKeyPreview,
        createdAt: channel.createdAt,
        updatedAt: channel.updatedAt,
    };
}

function normalizeApiFormat(value: unknown): ApiCallFormat {
    if (value === "gemini" || value === "volcengine" || value === "openai-json") return value;
    return "openai";
}

function normalizeModels(models: unknown) {
    return Array.from(new Set((Array.isArray(models) ? models : []).map((item) => String(item).trim()).filter(Boolean)));
}
