import { create } from "zustand";
import { persist } from "zustand/middleware";

export const AGENT_PANEL_MIN_WIDTH = 320;
export const AGENT_PANEL_MAX_WIDTH = 760;
export const AGENT_PANEL_DEFAULT_WIDTH = 520;

function clampWidth(width: number) {
    return Math.min(AGENT_PANEL_MAX_WIDTH, Math.max(AGENT_PANEL_MIN_WIDTH, Math.round(width) || AGENT_PANEL_DEFAULT_WIDTH));
}

type CanvasPanelStore = {
    agentPanelWidth: number;
    setAgentPanelWidth: (width: number) => void;
};

export const useCanvasPanelStore = create<CanvasPanelStore>()(
    persist(
        (set) => ({
            agentPanelWidth: AGENT_PANEL_DEFAULT_WIDTH,
            setAgentPanelWidth: (width) => set({ agentPanelWidth: clampWidth(width) }),
        }),
        {
            name: "infinite-canvas:canvas_panel_store",
            partialize: (state) => ({ agentPanelWidth: state.agentPanelWidth }),
            merge: (persisted, current) => {
                const saved = (persisted || {}) as Partial<CanvasPanelStore>;
                return { ...current, agentPanelWidth: clampWidth(saved.agentPanelWidth ?? AGENT_PANEL_DEFAULT_WIDTH) };
            },
        },
    ),
);
