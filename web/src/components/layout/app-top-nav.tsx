import { lazy, Suspense, useState } from "react";
import { Menu } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { navigationTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/stores/use-config-store";

const AppConfigModal = lazy(() => import("@/components/layout/app-config-modal").then((module) => ({ default: module.AppConfigModal })));

export function AppTopNav() {
    const { pathname } = useLocation();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const isConfigOpen = useConfigStore((state) => state.isConfigOpen);
    const hideHeader = /^\/canvas\/[^/]+/.test(pathname);
    const isHome = pathname === "/";
    const slug = pathname.split("/").filter(Boolean)[0];
    const activeToolSlug = navigationTools.some((tool) => tool.slug === slug) ? (slug as NavigationToolSlug) : undefined;

    return (
        <>
            {!hideHeader ? (
                <header
                    className={cn(
                        "sticky top-0 z-20 h-16 shrink-0 transition-colors duration-300",
                        isHome
                            ? "border-b border-stone-200/50 bg-white/70 backdrop-blur-xl dark:border-stone-800/40 dark:bg-[#0E1015]/75"
                            : "border-b border-stone-200 bg-background/90 backdrop-blur-xl dark:border-stone-800",
                    )}
                >
                    <div className="mx-auto flex h-full max-w-7xl items-stretch justify-between gap-5 px-6">
                        <div className="flex min-w-0 items-center">
                            <Link
                                to="/"
                                className="group flex h-full shrink-0 items-center gap-2.5 text-sm font-semibold leading-none tracking-tight text-stone-950 transition hover:text-stone-600 dark:text-stone-100 dark:hover:text-stone-300"
                            >
                                <span
                                    className="size-5 shrink-0 bg-current transition-transform duration-300 group-hover:scale-110"
                                    style={{
                                        mask: "url(/logo.svg) center / contain no-repeat",
                                        WebkitMask: "url(/logo.svg) center / contain no-repeat",
                                    }}
                                />
                                <span className="text-base font-bold tracking-tight">C-AI画布</span>
                                {isHome ? (
                                    <span className="hidden rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 sm:inline-flex">
                                        创意流推演
                                    </span>
                                ) : null}
                            </Link>

                            <button
                                type="button"
                                className="ml-3 inline-flex size-8 shrink-0 items-center justify-center text-stone-600 transition hover:text-stone-950 md:hidden dark:text-stone-300 dark:hover:text-white"
                                onClick={() => setMobileNavOpen(true)}
                                aria-label="打开导航菜单"
                                title="导航菜单"
                            >
                                <Menu className="size-5" />
                            </button>

                            <nav className="hide-scrollbar ml-8 hidden h-16 min-w-0 items-center gap-1.5 overflow-x-auto md:flex">
                                {navigationTools.map((tool) => {
                                    const Icon = tool.icon;
                                    const active = tool.slug === activeToolSlug;
                                    return (
                                        <Link
                                            key={tool.slug}
                                            to={`/${tool.slug}`}
                                            className={cn(
                                                "relative flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-all duration-200",
                                                active
                                                    ? "bg-stone-900 text-white shadow-sm dark:bg-stone-100 dark:text-stone-950"
                                                    : isHome
                                                      ? "text-stone-600 hover:bg-stone-100/80 hover:text-stone-950 dark:text-stone-400 dark:hover:bg-stone-800/60 dark:hover:text-stone-100"
                                                      : "text-stone-600 hover:bg-stone-100 hover:text-stone-950 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100",
                                            )}
                                        >
                                            <Icon className="size-3.5" />
                                            <span>{tool.label}</span>
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>

                        <div className="my-auto flex h-9 min-w-0 items-center justify-end gap-2.5 justify-self-end whitespace-nowrap">
                            <UserStatusActions isHome={isHome} />
                            {isHome ? (
                                <Link
                                    to="/canvas"
                                    className="hidden items-center gap-1.5 rounded-full bg-stone-950 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-white sm:inline-flex"
                                >
                                    进入画布
                                </Link>
                            ) : null}
                        </div>
                    </div>
                </header>
            ) : null}

            <MobileNavDrawer open={mobileNavOpen} activeToolSlug={activeToolSlug} onClose={() => setMobileNavOpen(false)} />
            {isConfigOpen ? (
                <Suspense fallback={null}>
                    <AppConfigModal />
                </Suspense>
            ) : null}
        </>
    );
}
