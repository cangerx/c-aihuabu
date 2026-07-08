"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Key, Keyboard, Settings2, UserRound } from "lucide-react";

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { VersionReleaseModal } from "@/components/layout/version-release-modal";
import { DOCS_URL } from "@/constant/env";
import { cn } from "@/lib/utils";
import { canvasThemes } from "@/lib/canvas-theme";
import { fetchAccountMe, type AccountUser } from "@/services/api/account";
import { useConfigStore } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";

type UserStatusActionsProps = {
    showConfig?: boolean;
    variant?: "default" | "canvas";
    onOpenShortcuts?: () => void;
};

export function UserStatusActions({ showConfig = true, variant = "default", onOpenShortcuts }: UserStatusActionsProps) {
    const [user, setUser] = useState<AccountUser | null>(null);
    const theme = useThemeStore((state) => state.theme);
    const setTheme = useThemeStore((state) => state.setTheme);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const canvasTheme = canvasThemes[theme];
    const naturalIconClass = "inline-flex size-7 shrink-0 items-center justify-center text-stone-600 transition hover:text-stone-950 dark:text-stone-300 dark:hover:text-white [&_svg]:size-4";
    const iconStyle: CSSProperties | undefined = variant === "canvas" ? { color: canvasTheme.node.text } : undefined;
    const versionStyle = iconStyle;

    useEffect(() => {
        const refresh = () => void fetchAccountMe()
            .then((data) => setUser(data.user))
            .catch(() => setUser(null));
        refresh();
        window.addEventListener("ai-huabu-account-change", refresh);
        return () => window.removeEventListener("ai-huabu-account-change", refresh);
    }, []);

    return (
        <div className="inline-flex shrink-0 items-center gap-1">
            <button
                type="button"
                className={cn(naturalIconClass, "w-auto gap-1 rounded-md px-2 text-xs font-medium")}
                style={iconStyle}
                onClick={() => openConfigDialog(false, "channels")}
                aria-label={user ? "账号" : "本地配置"}
                title={user ? `账号：${user.email}` : "静态版使用本地配置"}
            >
                <UserRound className="size-4" />
                <span className="hidden sm:inline">{user ? "账号" : "本地"}</span>
            </button>
            <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className={naturalIconClass} style={iconStyle} aria-label="中转服务 Key" title="中转服务 Key">
                <Key className="size-4" />
            </a>
            {showConfig ? (
                <button type="button" className={naturalIconClass} style={iconStyle} onClick={() => openConfigDialog(false)} aria-label="配置" title="配置">
                    <Settings2 className="size-4" />
                </button>
            ) : null}
            <AnimatedThemeToggler theme={theme} onThemeChange={setTheme} className={naturalIconClass} style={iconStyle} aria-label={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"} title={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"} />
            <VersionReleaseModal style={versionStyle} />
            {onOpenShortcuts ? (
                <button type="button" className={naturalIconClass} style={iconStyle} onClick={onOpenShortcuts} aria-label="快捷键" title="快捷键">
                    <Keyboard className="size-4" />
                </button>
            ) : null}
        </div>
    );
}
