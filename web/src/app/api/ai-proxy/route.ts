import http from "node:http";
import https from "node:https";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AI_PROXY_TIMEOUT_MS = 60000;
const AI_PROXY_IMAGE_TIMEOUT_MS = 10 * 60 * 1000;
const AI_PROXY_KEEPALIVE_MS = 10000;
const AI_PROXY_TASK_TTL_MS = 15 * 60 * 1000;
const encoder = new TextEncoder();
type ProxyTask = { status: "pending" | "success" | "error"; createdAt: number; updatedAt: number; data?: unknown; error?: string };
const tasks = new Map<string, ProxyTask>();
const taskControllers = new Map<string, AbortController>();

export async function GET(request: NextRequest) {
    const taskId = request.nextUrl.searchParams.get("task");
    if (taskId) return getTask(taskId);
    return handle(request);
}

export async function POST(request: NextRequest) {
    return handle(request);
}

export async function DELETE(request: NextRequest) {
    const taskId = request.nextUrl.searchParams.get("task");
    if (!taskId) return new Response("Missing task parameter", { status: 400 });
    taskControllers.get(taskId)?.abort();
    taskControllers.delete(taskId);
    tasks.delete(taskId);
    return Response.json({ ok: true });
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
        if (request.nextUrl.searchParams.get("mode") === "task") {
            if (!shouldUseImageProxyTask(method, url)) return new Response("Unsupported proxy task target", { status: 400 });
            return createTask(method, url, headers, body, request.nextUrl.searchParams.get("task"));
        }
        if (shouldUseJsonKeepAlive(method, url)) {
            return Response.json({ error: { message: "当前页面仍在使用旧版生图请求，请刷新页面或清理浏览器缓存后重试。" } }, { status: 409 });
        }
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

function shouldUseImageProxyTask(method: string, url: URL) {
    if (method !== "POST") return false;
    return /\/images\/(generations|edits)$/i.test(url.pathname);
}

function shouldUseJsonKeepAlive(method: string, url: URL) {
    return shouldUseImageProxyTask(method, url);
}

function createTask(method: string, url: URL, headers: Headers, body: ArrayBuffer | undefined, requestedId: string | null) {
    cleanupTasks();
    const id = requestedId && /^[A-Za-z0-9_-]{8,80}$/.test(requestedId) ? requestedId : crypto.randomUUID();
    if (tasks.has(id)) return Response.json({ error: { message: "代理任务 ID 已存在" } }, { status: 409 });
    tasks.set(id, { status: "pending", createdAt: Date.now(), updatedAt: Date.now() });
    void runTask(id, method, url, headers, body);
    return Response.json({ id });
}

async function runTask(id: string, method: string, url: URL, headers: Headers, body?: ArrayBuffer) {
    if (!tasks.has(id)) return;
    const controller = new AbortController();
    taskControllers.set(id, controller);
    const timer = setTimeout(() => controller.abort(), AI_PROXY_IMAGE_TIMEOUT_MS);
    try {
        const response = await requestJsonWithNode(url, method, headers, body, controller.signal);
        console.log(`[ai-proxy-task] ${method} ${url.href} -> ${response.status}`);
        if (!tasks.has(id)) return;
        tasks.set(id, {
            status: response.status >= 200 && response.status < 300 ? "success" : "error",
            createdAt: tasks.get(id)?.createdAt || Date.now(),
            updatedAt: Date.now(),
            ...(response.status >= 200 && response.status < 300 ? { data: response.data } : { error: responseErrorMessage(response.data) || `请求失败：${response.status}` }),
        });
    } catch (error) {
        if (!tasks.has(id)) return;
        const message = isAbortError(error) ? "AI proxy timeout" : error instanceof Error ? error.message : "AI proxy error";
        tasks.set(id, { status: "error", createdAt: tasks.get(id)?.createdAt || Date.now(), updatedAt: Date.now(), error: message });
    } finally {
        clearTimeout(timer);
        taskControllers.delete(id);
    }
}

function requestJsonWithNode(url: URL, method: string, headers: Headers, body: ArrayBuffer | undefined, signal: AbortSignal) {
    return new Promise<{ status: number; data: unknown }>((resolve, reject) => {
        const client = url.protocol === "https:" ? https : http;
        const req = client.request(
            url,
            {
                method,
                headers: Object.fromEntries(headers.entries()),
                timeout: 0,
            },
            (res) => {
                const chunks: Buffer[] = [];
                res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
                res.on("end", () => {
                    const text = Buffer.concat(chunks).toString("utf8");
                    resolve({ status: res.statusCode || 0, data: parseJsonText(text) });
                });
            },
        );
        req.setTimeout(0);
        req.on("error", reject);
        signal.addEventListener(
            "abort",
            () => {
                req.destroy(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
        );
        if (body?.byteLength) req.write(Buffer.from(body));
        req.end();
    });
}

function isAbortError(error: unknown) {
    return error instanceof Error && (error.name === "AbortError" || error.message === "Aborted");
}

function getTask(id: string) {
    cleanupTasks();
    const task = tasks.get(id);
    if (!task) return Response.json({ status: "error", error: "代理任务不存在或已过期" }, { headers: { "Cache-Control": "no-store" } });
    return Response.json(task, { headers: { "Cache-Control": "no-store" } });
}

function cleanupTasks() {
    const now = Date.now();
    for (const [id, task] of tasks) {
        if (now - task.updatedAt > AI_PROXY_TASK_TTL_MS) {
            taskControllers.get(id)?.abort();
            taskControllers.delete(id);
            tasks.delete(id);
        }
    }
}

function streamJsonProxy(request: NextRequest, method: string, url: URL, headers: Headers, body?: ArrayBuffer) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_PROXY_IMAGE_TIMEOUT_MS);
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let closed = false;

    const cleanup = () => {
        clearTimeout(timer);
        if (heartbeat) clearInterval(heartbeat);
    };
    const abort = () => controller.abort();
    request.signal.addEventListener("abort", abort, { once: true });

    const stream = new ReadableStream<Uint8Array>({
        start(client) {
            const write = (chunk: Uint8Array) => {
                if (!closed) client.enqueue(chunk);
            };
            write(encoder.encode("\n"));
            heartbeat = setInterval(() => write(encoder.encode("\n")), AI_PROXY_KEEPALIVE_MS);

            void (async () => {
                try {
                    const response = await fetch(url, {
                        method,
                        headers,
                        body: body?.byteLength ? body : undefined,
                        signal: controller.signal,
                    });
                    console.log(`[ai-proxy] ${method} ${url.href} -> ${response.status}`);
                    if (heartbeat) clearInterval(heartbeat);
                    if (!response.ok) {
                        write(encoder.encode(JSON.stringify({ error: { message: await readResponseError(response) } })));
                    } else if (response.body) {
                        await pipeResponseBody(response, write);
                    } else if (!closed) {
                        write(new Uint8Array(await response.arrayBuffer()));
                    }
                } catch (error) {
                    const message = error instanceof Error && error.name === "AbortError" ? "AI proxy timeout" : error instanceof Error ? error.message : "AI proxy error";
                    write(encoder.encode(JSON.stringify({ error: { message } })));
                } finally {
                    request.signal.removeEventListener("abort", abort);
                    cleanup();
                    if (!closed) {
                        closed = true;
                        client.close();
                    }
                }
            })();
        },
        cancel() {
            controller.abort();
            request.signal.removeEventListener("abort", abort);
            cleanup();
            closed = true;
        },
    });

    return new Response(stream, {
        status: 200,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    });
}

async function readJsonResponse(response: Response) {
    const text = await response.text();
    return parseJsonText(text);
}

function parseJsonText(text: string) {
    if (!text) return null;
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return { error: { message: text.slice(0, 300) } };
    }
}

function responseErrorMessage(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return "";
    const payload = value as { msg?: unknown; error?: { message?: unknown } };
    return typeof payload.msg === "string" ? payload.msg : typeof payload.error?.message === "string" ? payload.error.message : "";
}

async function pipeResponseBody(response: Response, write: (chunk: Uint8Array) => void) {
    const reader = response.body?.getReader();
    if (!reader) return;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) write(value);
    }
}

async function readResponseError(response: Response) {
    const text = await response.text().catch(() => "");
    if (!text) return `请求失败：${response.status}`;
    try {
        const payload = JSON.parse(text) as { msg?: string; error?: { message?: string } };
        return payload.msg || payload.error?.message || `请求失败：${response.status}`;
    } catch {
        return text.slice(0, 300) || `请求失败：${response.status}`;
    }
}

function responseHeaders(headers: Headers) {
    const result = new Headers();
    ["content-type", "content-length", "cache-control"].forEach((key) => {
        const value = headers.get(key);
        if (value) result.set(key, value);
    });
    return result;
}
