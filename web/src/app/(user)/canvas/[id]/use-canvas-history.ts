import { useCallback, useEffect, useRef, useState } from "react";

import type { CanvasBackgroundMode } from "@/lib/canvas-theme";

import type { CanvasAssistantSession, CanvasConnection, CanvasNodeData } from "../types";

export type CanvasHistoryEntry = {
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    chatSessions: CanvasAssistantSession[];
    activeChatId: string | null;
    backgroundMode: CanvasBackgroundMode;
    showImageInfo: boolean;
};

export function useCanvasHistory({ entry, enabled, onApply }: { entry: CanvasHistoryEntry; enabled: boolean; onApply: (entry: CanvasHistoryEntry) => void }) {
    const historyRef = useRef<{ past: CanvasHistoryEntry[]; future: CanvasHistoryEntry[] }>({ past: [], future: [] });
    const lastHistoryRef = useRef<CanvasHistoryEntry | null>(null);
    const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const applyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const applyingRef = useRef(false);
    const pausedRef = useRef(false);
    const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

    const clearCommitTimer = useCallback(() => {
        if (!commitTimerRef.current) return;
        clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
    }, []);

    const resetHistory = useCallback(
        (next: CanvasHistoryEntry) => {
            clearCommitTimer();
            if (applyTimerRef.current) {
                clearTimeout(applyTimerRef.current);
                applyTimerRef.current = null;
            }
            historyRef.current = { past: [], future: [] };
            lastHistoryRef.current = next;
            applyingRef.current = false;
            pausedRef.current = false;
            setHistoryState({ canUndo: false, canRedo: false });
        },
        [clearCommitTimer],
    );

    useEffect(() => {
        if (!enabled || applyingRef.current || pausedRef.current) return;
        const previous = lastHistoryRef.current;
        if (previous && isSameHistoryEntry(previous, entry)) return;

        clearCommitTimer();
        commitTimerRef.current = setTimeout(() => {
            const last = lastHistoryRef.current;
            if (!last) return;
            historyRef.current.past = [...historyRef.current.past.slice(-49), last];
            historyRef.current.future = [];
            lastHistoryRef.current = entry;
            commitTimerRef.current = null;
            setHistoryState({ canUndo: true, canRedo: false });
        }, 180);

        return clearCommitTimer;
    }, [clearCommitTimer, enabled, entry]);

    useEffect(
        () => () => {
            clearCommitTimer();
            if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
        },
        [clearCommitTimer],
    );

    const applyHistory = useCallback(
        (next: CanvasHistoryEntry) => {
            clearCommitTimer();
            applyingRef.current = true;
            onApply(next);
            if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
            applyTimerRef.current = setTimeout(() => {
                lastHistoryRef.current = next;
                applyingRef.current = false;
                applyTimerRef.current = null;
                setHistoryState({ canUndo: historyRef.current.past.length > 0, canRedo: historyRef.current.future.length > 0 });
            });
        },
        [clearCommitTimer, onApply],
    );

    const undo = useCallback(() => {
        const previous = historyRef.current.past.pop();
        const current = lastHistoryRef.current;
        if (!previous || !current) return;
        historyRef.current.future.push(current);
        applyHistory(previous);
    }, [applyHistory]);

    const redo = useCallback(() => {
        const next = historyRef.current.future.pop();
        const current = lastHistoryRef.current;
        if (!next || !current) return;
        historyRef.current.past.push(current);
        applyHistory(next);
    }, [applyHistory]);

    const pauseHistory = useCallback(() => {
        pausedRef.current = true;
    }, []);

    const resumeHistory = useCallback(() => {
        pausedRef.current = false;
    }, []);

    const isHistoryPaused = useCallback(() => pausedRef.current, []);
    const getHistoryCleanupState = useCallback(() => ({ history: historyRef.current, lastHistory: lastHistoryRef.current }), []);

    return { historyState, resetHistory, undo, redo, pauseHistory, resumeHistory, isHistoryPaused, getHistoryCleanupState };
}

function isSameHistoryEntry(first: CanvasHistoryEntry, second: CanvasHistoryEntry) {
    return first.nodes === second.nodes && first.connections === second.connections && first.chatSessions === second.chatSessions && first.activeChatId === second.activeChatId && first.backgroundMode === second.backgroundMode && first.showImageInfo === second.showImageInfo;
}
