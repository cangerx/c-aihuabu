import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AI_PROXY_TIMEOUT_MS = 60000;

export async function GET(request: NextRequest) {
    return handle(request);
}

export async function POST(request: NextRequest) {
    return handle(request);
}

async function handle(request: NextRequest) {
    const target = request.nextUrl.searchParams.get("url") || "";
    if (!target) return new Response("Missing url parameter", { status: 400 });

    let url: URL;
    try {
        url = new URL(target);
    } catch {
        return new Response("Invalid url parameter", { status: 400 });
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        return new Response("Unsupported target protocol", { status: 400 });
    }

    const method = request.method;
    const headers = new Headers();
    const headersToForward = ["authorization", "content-type", "accept", "accept-language", "user-agent"];
    for (const key of headersToForward) {
        const value = request.headers.get(key);
        if (value) headers.set(key, value);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_PROXY_TIMEOUT_MS);
    try {
        const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();
        console.log(`[ai-proxy] ${method} ${url.href} ${body?.byteLength || 0}B`);
        const response = await fetch(url, {
            method,
            headers,
            body: body?.byteLength ? body : undefined,
            signal: controller.signal,
        });
        console.log(`[ai-proxy] ${method} ${url.href} -> ${response.status}`);
        return new Response(method === "HEAD" ? null : response.body, {
            status: response.status,
            headers: responseHeaders(response.headers),
        });
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            return new Response("AI proxy timeout", { status: 504 });
        }
        return new Response(error instanceof Error ? error.message : "AI proxy error", { status: 502 });
    } finally {
        clearTimeout(timer);
    }
}

function responseHeaders(headers: Headers) {
    const result = new Headers();
    ["content-type", "content-length", "cache-control", "connection", "transfer-encoding"].forEach((key) => {
        const value = headers.get(key);
        if (value) result.set(key, value);
    });
    return result;
}
