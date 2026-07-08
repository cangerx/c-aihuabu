import type { ApiCallFormat, ModelChannel } from "@/stores/use-config-store";

export type AccountUser = { id: string; email: string; createdAt: string };
export type CloudModelChannel = ModelChannel & {
    scope: "cloud_personal";
    apiKeyPreview: string;
    createdAt: string;
    updatedAt: string;
};

const staticUnsupportedMessage = "静态前端版本不包含账号后端，云端账号和云端个人渠道暂不可用";

export async function fetchAccountMe() {
    return { user: null as AccountUser | null };
}

export async function registerAccount(_email: string, _password: string): Promise<{ user: AccountUser }> {
    throw new Error(staticUnsupportedMessage);
}

export async function loginAccount(_email: string, _password: string): Promise<{ user: AccountUser }> {
    throw new Error(staticUnsupportedMessage);
}

export async function logoutAccount() {
    return { success: true };
}

export async function fetchCloudChannels() {
    return { channels: [] as CloudModelChannel[] };
}

export async function createCloudChannel(_input: { name: string; baseUrl: string; apiKey: string; apiFormat: ApiCallFormat; models: string[] }): Promise<{ channel: CloudModelChannel }> {
    throw new Error(staticUnsupportedMessage);
}
