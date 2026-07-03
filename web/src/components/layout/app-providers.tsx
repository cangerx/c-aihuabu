"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ProConfigProvider } from "@ant-design/pro-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";

import { ClientRootInit } from "@/components/layout/client-root-init";
import { getAntThemeConfig } from "@/lib/app-theme";
import { writeThemeCookie, type ThemeName } from "@/lib/theme-cookie";
import { useThemeStore } from "@/stores/use-theme-store";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            retry: false,
            refetchOnWindowFocus: false,
        },
    },
});

export function AppProviders({ children, initialTheme }: { children: ReactNode; initialTheme: ThemeName }) {
    const storeTheme = useThemeStore((state) => state.theme);
    const [themeHydrated, setThemeHydrated] = useState(false);
    const theme = themeHydrated ? storeTheme : initialTheme;
    const dark = theme === "dark";

    useEffect(() => {
        const persist = useThemeStore.persist;
        if (!persist?.hasHydrated || !persist?.onFinishHydration) {
            setThemeHydrated(true);
            return;
        }
        if (persist.hasHydrated()) setThemeHydrated(true);
        return persist.onFinishHydration(() => setThemeHydrated(true));
    }, []);

    useEffect(() => {
        document.documentElement.classList.toggle("dark", dark);
        document.documentElement.style.colorScheme = theme;
        writeThemeCookie(theme);
    }, [dark, theme]);

    return (
        <ConfigProvider locale={zhCN} theme={getAntThemeConfig(dark)}>
            <ProConfigProvider dark={dark}>
                <App>
                    <QueryClientProvider client={queryClient}>
                        <ClientRootInit>{children}</ClientRootInit>
                    </QueryClientProvider>
                </App>
            </ProConfigProvider>
        </ConfigProvider>
    );
}
