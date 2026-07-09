import { useEffect, useMemo, useState } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";

const RELOAD_FLAG_PREFIX = "infinite-canvas:chunk-reload:";

export function RouteErrorBoundary() {
    const error = useRouteError();
    const message = errorMessage(error);
    const isChunkError = /dynamically imported module|failed to fetch dynamically|importing a module script|loading chunk|chunkloaderror/i.test(message);
    const [reloading, setReloading] = useState(isChunkError);
    const reloadKey = useMemo(() => `${RELOAD_FLAG_PREFIX}${location.pathname}:${__APP_VERSION__}`, []);

    useEffect(() => {
        if (!isChunkError) return;
        if (sessionStorage.getItem(reloadKey)) {
            setReloading(false);
            return;
        }
        sessionStorage.setItem(reloadKey, "1");
        window.setTimeout(() => window.location.reload(), 300);
    }, [isChunkError, reloadKey]);

    if (reloading) {
        return <div className="flex h-full items-center justify-center text-sm text-stone-500">检测到新版本资源，正在自动刷新...</div>;
    }

    return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-stone-600 dark:text-stone-300">
            <div className="text-base font-semibold text-stone-900 dark:text-stone-100">页面加载失败</div>
            <div className="max-w-xl text-sm leading-6">{isChunkError ? "当前页面资源已更新，请刷新后重试。" : message}</div>
            <button type="button" className="rounded-md bg-stone-900 px-4 py-2 text-sm text-white dark:bg-stone-100 dark:text-stone-950" onClick={() => window.location.reload()}>
                刷新页面
            </button>
        </div>
    );
}

function errorMessage(error: unknown) {
    if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`;
    if (error instanceof Error) return error.message;
    return typeof error === "string" ? error : "未知错误";
}
