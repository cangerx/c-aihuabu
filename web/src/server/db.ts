import pg from "pg";
import type { Pool as PgPool, QueryResultRow } from "pg";

const { Pool } = pg;

let pool: PgPool | null = null;

export function hasDatabase() {
    return Boolean(process.env.DATABASE_URL);
}

export function getDb() {
    if (!process.env.DATABASE_URL) throw new Error("未配置 DATABASE_URL");
    pool ||= new Pool({ connectionString: process.env.DATABASE_URL });
    return pool;
}

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
    return getDb().query<T>(text, values);
}
