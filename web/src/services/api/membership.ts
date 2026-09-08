import { useMemberStore } from "@/stores/use-member-store";

export type MemberUser = {
    id: string;
    email: string;
    nickname: string;
    role: "user" | "admin";
    status: "active" | "disabled";
    points: number;
    createdAt: string;
};

export type DashboardStats = { users: number; totalPoints: number; paidOrders: number; revenueCent: number };
export type PointPackage = { id: string; name: string; points: number; priceCent: number; enabled: boolean; sort: number };
export type GenerationPrice = { id: string; model: string; mediaType: string; points: number; enabled: boolean };
export type PaymentSettings = { enabled: boolean; wechatEnabled: boolean; alipayEnabled: boolean; sandbox: boolean; host: string; productionHost: string; orgId: string; mno: string; subMechId: string; signType: string; version: string; notifyUrl: string; privateKeyConfigured: boolean; publicKeyConfigured: boolean };
export type PaymentOptions = { enabled: boolean; methods: ("WECHAT" | "ALIPAY")[] };
export type GeneralSettings = { registrationEnabled: boolean; registrationGiftPoints: number; tokenTtlHours: number; defaultImagePoints: number; defaultVideoPoints: number; defaultTextPoints: number; defaultAudioPoints: number; maintenanceMode: boolean };
export type AIChannel = { id: string; name: string; baseUrl: string; models: string[]; enabled: boolean; apiKeyConfigured: boolean };
export type PointLedger = { id: string; type: string; amount: number; balanceAfter: number; remark: string; createdAt: string };

type Envelope<T> = { code: number; data: T; msg: string };

export async function memberRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const token = localStorage.getItem("c-aihuabu:member-token") || "";
    const response = await fetch(path, {
        ...init,
        headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
    });
    const payload = (await response.json().catch(() => null)) as Envelope<T> | null;
    if (response.status === 401 && path !== "/api/auth/login") useMemberStore.getState().logout();
    if (!response.ok || !payload || payload.code !== 0) throw new Error(payload?.msg || `请求失败 (${response.status})`);
    return payload.data;
}

export function loginMember(email: string, password: string) {
    return memberRequest<{ token: string; user: MemberUser }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function registerMember(email: string, password: string, nickname: string) {
    return memberRequest<{ token: string; user: MemberUser }>("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password, nickname }) });
}

export function getMember() { return memberRequest<MemberUser>("/api/users/me"); }
export function getMemberLedger() { return memberRequest<PointLedger[]>("/api/wallet/ledger"); }
export function getPointPackages() { return memberRequest<PointPackage[]>("/api/packages"); }
export function getPaymentOptions() { return memberRequest<PaymentOptions>("/api/payment/options"); }
export function createRechargeOrder(packageId: string, payMethod: "WECHAT" | "ALIPAY") { return memberRequest<{ orderNo: string; qrCode: string }>("/api/orders", { method: "POST", body: JSON.stringify({ packageId, payMethod }) }); }
