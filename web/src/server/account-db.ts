import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type CloudUser = {
    id: string;
    email: string;
    passwordHash: string;
    createdAt: string;
    updatedAt: string;
};

export type CloudSession = {
    id: string;
    userId: string;
    expiresAt: string;
    createdAt: string;
};

export type CloudChannel = {
    id: string;
    userId: string;
    name: string;
    baseUrl: string;
    apiFormat: "openai" | "gemini" | "volcengine" | "openai-json";
    models: string[];
    encryptedApiKey: string;
    createdAt: string;
    updatedAt: string;
};

type AccountDb = {
    users: CloudUser[];
    sessions: CloudSession[];
    channels: CloudChannel[];
};

const dataDir = process.env.AI_HUABU_DATA_DIR || path.join(process.cwd(), ".ai-huabu");
const dbFile = path.join(dataDir, "account-db.json");

const emptyDb: AccountDb = {
    users: [],
    sessions: [],
    channels: [],
};

export async function readAccountDb(): Promise<AccountDb> {
    try {
        return { ...emptyDb, ...JSON.parse(await readFile(dbFile, "utf8")) };
    } catch {
        return { ...emptyDb };
    }
}

export async function writeAccountDb(db: AccountDb) {
    await mkdir(dataDir, { recursive: true });
    const tmpFile = `${dbFile}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmpFile, JSON.stringify(db, null, 2));
    await rename(tmpFile, dbFile);
}
