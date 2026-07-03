import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { AppProviders } from "@/components/layout/app-providers";
import { normalizeTheme, THEME_COOKIE_NAME } from "@/lib/theme-cookie";
import "antd/dist/reset.css";
import "./globals.css";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "C-AI画布",
    description: "一个 C-AI画布 创作工具",
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    const theme = normalizeTheme((await cookies()).get(THEME_COOKIE_NAME)?.value);
    const dark = theme === "dark";

    return (
        <html lang="zh-CN" suppressHydrationWarning className={`font-sans${dark ? " dark" : ""}`} style={{ colorScheme: theme }}>
            <body
                className="bg-background text-foreground antialiased"
                style={{
                    fontFamily: '"SF Pro Display","SF Pro Text","PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif',
                }}
            >
                <AntdRegistry>
                    <AppProviders initialTheme={theme}>{children}</AppProviders>
                </AntdRegistry>
            </body>
        </html>
    );
}
