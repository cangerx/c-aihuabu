import type { ApiCallFormat, ModelChannel } from "@/stores/use-config-store";

type ApiEnvelope<T> = { code: number; data: T; msg: string };

export type AccountUser = { id: string; email: string; createdAt: string };
export type CloudModelChannel = Omit<ModelChannel, "apiKey"> & {
    scope: "cloud_personal";
    apiKeyPreview: string;
    createdAt: string;
    updatedAt: string;
};

async function requestAccount<T>(path: string, init?: RequestInit) {
    const response = await fetch(`/api/account${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...init?.headers,
        },
    });
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!response.ok || !payload || payload.code !== 0) throw new Error(payload?.msg || "请求失败");
    return payload.data;
}

export function fetchAccountMe() {
    return requestAccount<{ user: AccountUser | null }>("/me");
}

export function registerAccount(email: string, password: string) {
    return requestAccount<{ user: AccountUser }>("/register", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function loginAccount(email: string, password: string) {
    return requestAccount<{ user: AccountUser }>("/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function logoutAccount() {
    return requestAccount<{ success: boolean }>("/logout", { method: "POST" });
}

export function fetchCloudChannels() {
    return requestAccount<{ channels: CloudModelChannel[] }>("/channels");
}

export function createCloudChannel(input: { name: string; baseUrl: string; apiKey: string; apiFormat: ApiCallFormat; models: string[] }) {
    return requestAccount<{ channel: CloudModelChannel }>("/channels", { method: "POST", body: JSON.stringify(input) });
}
