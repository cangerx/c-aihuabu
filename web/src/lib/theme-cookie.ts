export type ThemeName = "light" | "dark";

export const THEME_COOKIE_NAME = "infinite-canvas-theme";

export function normalizeTheme(value: string | null | undefined): ThemeName {
    return value === "light" ? "light" : "dark";
}

export function writeThemeCookie(theme: ThemeName) {
    if (typeof document === "undefined") return;
    document.cookie = `${THEME_COOKIE_NAME}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
}
