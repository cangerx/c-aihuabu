import { create } from "zustand";
import { persist } from "zustand/middleware";

import { writeThemeCookie, type ThemeName } from "@/lib/theme-cookie";

type ThemeStore = {
    theme: ThemeName;
    setTheme: (theme: ThemeName) => void;
};

export const useThemeStore = create<ThemeStore>()(
    persist(
        (set) => ({
            theme: "dark",
            setTheme: (theme) => {
                writeThemeCookie(theme);
                set({ theme });
            },
        }),
        { name: "infinite-canvas:theme_store" },
    ),
);
