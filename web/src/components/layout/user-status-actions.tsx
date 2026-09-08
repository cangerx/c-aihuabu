import type { CSSProperties } from "react";
import { Key, Keyboard, LogIn, Settings2, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { VersionReleaseModal } from "@/components/layout/version-release-modal";
import { DOCS_URL } from "@/constant/env";
import { canvasThemes } from "@/lib/canvas-theme";
import { useConfigStore } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { useMemberStore } from "@/stores/use-member-store";

type UserStatusActionsProps = {
    showConfig?: boolean;
    variant?: "default" | "canvas";
    onOpenShortcuts?: () => void;
};

export function UserStatusActions({ showConfig = true, variant = "default", onOpenShortcuts }: UserStatusActionsProps) {
    const theme = useThemeStore((state) => state.theme);
    const setTheme = useThemeStore((state) => state.setTheme);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const canvasTheme = canvasThemes[theme];
    const member = useMemberStore((state) => state.user);
    const naturalIconClass = "inline-flex size-7 shrink-0 items-center justify-center text-stone-600 transition hover:text-stone-950 dark:text-stone-300 dark:hover:text-white [&_svg]:size-4";
    const iconStyle: CSSProperties | undefined = variant === "canvas" ? { color: canvasTheme.node.text } : undefined;
    const versionStyle = iconStyle;

    return (
        <div className="inline-flex shrink-0 items-center gap-1">
            {member ? <Link to="/account" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-amber-500/30 px-2.5 text-xs font-medium text-amber-700 transition hover:bg-amber-500/10 dark:text-amber-300" title="积分中心"><WalletCards className="size-3.5" /><span>{member.points}</span></Link> : <Link to="/auth" className={naturalIconClass} style={iconStyle} aria-label="登录" title="登录"><LogIn className="size-4" /></Link>}
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
