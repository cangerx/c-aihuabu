import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { accountDataDir } from "./account-db";

const ALGORITHM = "aes-256-gcm";
const GENERATED_SECRET_FILE = "secret-key";

function encryptionKey() {
    const secret = configuredSecret() || generatedSecret();
    return createHash("sha256").update(secret).digest();
}

function configuredSecret() {
    const secret = process.env.AI_HUABU_SECRET_KEY || "";
    if (!secret || secret.length >= 16) return secret;
    throw new Error("服务端 AI_HUABU_SECRET_KEY 至少需要 16 位，无法保存云端 Key");
}

function generatedSecret() {
    const dataDir = accountDataDir();
    const secretFile = path.join(dataDir, GENERATED_SECRET_FILE);
    mkdirSync(dataDir, { recursive: true });
    if (existsSync(secretFile)) {
        const secret = readFileSync(secretFile, "utf8").trim();
        if (secret.length >= 16) return secret;
    }
    const secret = randomBytes(32).toString("base64url");
    writeFileSync(secretFile, `${secret}\n`, { mode: 0o600 });
    return secret;
}

export function encryptSecret(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptSecret(value: string) {
    const [version, iv, tag, encrypted] = value.split(":");
    if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Key 密文格式无效");
    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

export function maskSecret(value: string) {
    if (!value) return "";
    if (value.length <= 8) return "****";
    return `${value.slice(0, 4)}****${value.slice(-4)}`;
}
