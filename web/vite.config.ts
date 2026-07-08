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
    build: {
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes("node_modules")) return;
                    if (/[\\/]node_modules[\\/](@ant-design|antd|rc-|@rc-component)[\\/]/.test(id)) return "antd-vendor";
                    if (/[\\/]node_modules[\\/](@codemirror|@uiw)[\\/]/.test(id)) return "editor-vendor";
                    if (/[\\/]node_modules[\\/](motion|framer-motion)[\\/]/.test(id)) return "motion-vendor";
                    return "vendor";
                },
            },
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
