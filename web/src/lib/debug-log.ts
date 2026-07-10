const STORAGE_KEY = "infinite-canvas:debug_log_enabled";
const MAX_ENTRIES = 200;

export type DebugLogLevel = "info" | "warn" | "error";

export type DebugLogEntry = {
    id: string;
    ts: number;
    level: DebugLogLevel;
    scope: string;
    message: string;
    data?: Record<string, unknown>;
};

type Listener = (entries: DebugLogEntry[]) => void;

let enabled = readEnabled();
const entries: DebugLogEntry[] = [];
const listeners = new Set<Listener>();

function readEnabled() {
    try {
        return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
        return false;
    }
}

export function isDebugLogEnabled() {
    return enabled;
}

export function setDebugLogEnabled(value: boolean) {
    enabled = value;
    try {
        localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
        // ignore
    }
    if (!value) clearDebugLogs();
    emit();
}

export function getDebugLogs() {
    return entries.slice();
}

export function clearDebugLogs() {
    entries.length = 0;
    emit();
}

export function subscribeDebugLogs(listener: Listener) {
    listeners.add(listener);
    listener(getDebugLogs());
    return () => {
        listeners.delete(listener);
    };
}

function emit() {
    const snapshot = getDebugLogs();
    listeners.forEach((listener) => listener(snapshot));
}

export function debugLog(scope: string, message: string, data?: Record<string, unknown>, level: DebugLogLevel = "info") {
    if (!enabled) return;
    const entry: DebugLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ts: Date.now(),
        level,
        scope,
        message,
        data: data ? sanitizeDebugData(data) : undefined,
    };
    entries.unshift(entry);
    if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
    const prefix = `[debug:${scope}]`;
    if (level === "error") console.error(prefix, message, entry.data || "");
    else if (level === "warn") console.warn(prefix, message, entry.data || "");
    else console.info(prefix, message, entry.data || "");
    emit();
}

export function debugWarn(scope: string, message: string, data?: Record<string, unknown>) {
    debugLog(scope, message, data, "warn");
}

export function debugError(scope: string, message: string, data?: Record<string, unknown>) {
    debugLog(scope, message, data, "error");
}

export function formatDebugLogs(list = getDebugLogs()) {
    return list
        .map((entry) => {
            const time = new Date(entry.ts).toISOString();
            const data = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
            return `${time} [${entry.level}] ${entry.scope} ${entry.message}${data}`;
        })
        .join("\n");
}

export function estimatePayloadBytes(value: unknown) {
    try {
        if (value instanceof FormData) {
            let total = 0;
            value.forEach((item) => {
                if (typeof item === "string") total += item.length;
                else if (item && typeof item === "object" && "size" in item) total += Number((item as Blob).size) || 0;
            });
            return total;
        }
        if (typeof value === "string") return value.length;
        return JSON.stringify(value ?? null).length;
    } catch {
        return 0;
    }
}

export function summarizeAxiosError(error: unknown) {
    if (!error || typeof error !== "object") return { message: String(error || "unknown") };
    const err = error as {
        message?: string;
        code?: string;
        response?: { status?: number; statusText?: string; data?: unknown; headers?: Record<string, unknown> };
        config?: { url?: string; method?: string };
    };
    return {
        message: err.message || "request failed",
        code: err.code,
        status: err.response?.status,
        statusText: err.response?.statusText,
        url: err.config?.url,
        method: err.config?.method,
        response: summarizeResponseData(err.response?.data),
    };
}

function summarizeResponseData(data: unknown) {
    if (data == null) return undefined;
    if (typeof data === "string") return truncate(data, 500);
    if (typeof data === "object") return sanitizeDebugData(data as Record<string, unknown>);
    return data;
}

function sanitizeDebugData(input: Record<string, unknown>, depth = 0): Record<string, unknown> {
    if (depth > 4) return { _: "..." };
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
        const lower = key.toLowerCase();
        if (lower.includes("apikey") || lower === "authorization" || lower.includes("password") || (lower.includes("token") && lower !== "taskid" && lower !== "task_id" && lower !== "request_id")) {
            out[key] = "[redacted]";
            continue;
        }
        out[key] = sanitizeValue(value, depth + 1);
    }
    return out;
}

function sanitizeValue(value: unknown, depth: number): unknown {
    if (value == null) return value;
    if (typeof value === "string") {
        if (value.startsWith("data:")) return `[data-url ${value.length} chars]`;
        if (/^Bearer\s+/i.test(value)) return "[redacted]";
        if (value.length > 400) return `${truncate(value, 200)}…(${value.length})`;
        return value;
    }
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
    if (value instanceof Blob) return { blob: true, size: value.size, type: value.type };
    if (value instanceof FormData) return { formData: true, bytes: estimatePayloadBytes(value) };
    if (typeof value === "object") return sanitizeDebugData(value as Record<string, unknown>, depth + 1);
    return String(value);
}

function truncate(value: string, max: number) {
    return value.length <= max ? value : value.slice(0, max);
}
