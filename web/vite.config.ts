import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { parseChangelog } from "./src/lib/release";

const webDir = dirname(fileURLToPath(import.meta.url));
const localVersion = readFileSync(resolve(webDir, "../VERSION"), "utf8").trim() || "dev";
const localChangelog = readFileSync(resolve(webDir, "../CHANGELOG.md"), "utf8");

export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            "/api/proxy": {
                target: "http://127.0.0.1:8787",
                changeOrigin: false,
                configure: (proxy) => {
                    proxy.on("proxyReq", (proxyReq, req) => {
                        const host = req.headers.host;
                        if (typeof host === "string" && host) {
                            proxyReq.setHeader("Host", host);
                            proxyReq.setHeader("X-Forwarded-Host", host);
                        }
                    });
                },
            },
            "/healthz": "http://127.0.0.1:8787",
        },
    },
    resolve: {
        alias: {
            "@": resolve(webDir, "src"),
        },
    },
    define: {
        __APP_VERSION__: JSON.stringify(localVersion),
        __APP_RELEASES__: JSON.stringify(parseChangelog(localChangelog)),
    },
});
