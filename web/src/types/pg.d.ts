declare module "pg" {
    namespace pg {
        type QueryResultRow = Record<string, unknown>;

        type QueryResult<T extends QueryResultRow = QueryResultRow> = {
            rows: T[];
            rowCount: number | null;
        };

        class Pool {
            constructor(options?: { connectionString?: string });
            query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
        }
    }

    const pg: { Pool: typeof pg.Pool };
    export = pg;
    export default pg;
}
