import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { MemberUser } from "@/services/api/membership";

type MemberStore = {
    token: string;
    user: MemberUser | null;
    setSession: (token: string, user: MemberUser) => void;
    setUser: (user: MemberUser) => void;
    logout: () => void;
};

export const useMemberStore = create<MemberStore>()(
    persist(
        (set) => ({
            token: "",
            user: null,
            setSession: (token, user) => {
                localStorage.setItem("c-aihuabu:member-token", token);
                set({ token, user });
            },
            setUser: (user) => set({ user }),
            logout: () => {
                localStorage.removeItem("c-aihuabu:member-token");
                set({ token: "", user: null });
            },
        }),
        { name: "c-aihuabu:member-session", partialize: ({ token, user }) => ({ token, user }) },
    ),
);
