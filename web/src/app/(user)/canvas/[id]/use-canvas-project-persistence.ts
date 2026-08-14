import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";

import type { CanvasBackgroundMode } from "@/lib/canvas-theme";
import { persistImageUrlInBackground } from "@/services/image-storage";

import { useCanvasStore } from "../stores/use-canvas-store";
import { hydrateAssistantImages, hydrateCanvasImages, imageMetadata, resetInterruptedGeneration } from "../utils/canvas-generation";
import { CanvasNodeType, type CanvasAssistantSession, type CanvasConnection, type CanvasNodeData, type ViewportTransform } from "../types";
import type { CanvasHistoryEntry } from "./use-canvas-history";

type UseCanvasProjectPersistenceOptions = {
    projectId: string;
    projectLoaded: boolean;
    setProjectLoaded: Dispatch<SetStateAction<boolean>>;
    nodes: CanvasNodeData[];
    setNodes: Dispatch<SetStateAction<CanvasNodeData[]>>;
    connections: CanvasConnection[];
    setConnections: Dispatch<SetStateAction<CanvasConnection[]>>;
    chatSessions: CanvasAssistantSession[];
    setChatSessions: Dispatch<SetStateAction<CanvasAssistantSession[]>>;
    activeChatId: string | null;
    setActiveChatId: Dispatch<SetStateAction<string | null>>;
    backgroundMode: CanvasBackgroundMode;
    setBackgroundMode: Dispatch<SetStateAction<CanvasBackgroundMode>>;
    showImageInfo: boolean;
    setShowImageInfo: Dispatch<SetStateAction<boolean>>;
    viewport: ViewportTransform;
    setViewport: Dispatch<SetStateAction<ViewportTransform>>;
    resetHistory: (entry: CanvasHistoryEntry) => void;
    isHistoryPaused: () => boolean;
};

export function useCanvasProjectPersistence({
    projectId,
    projectLoaded,
    setProjectLoaded,
    nodes,
    setNodes,
    connections,
    setConnections,
    chatSessions,
    setChatSessions,
    activeChatId,
    setActiveChatId,
    backgroundMode,
    setBackgroundMode,
    showImageInfo,
    setShowImageInfo,
    viewport,
    setViewport,
    resetHistory,
    isHistoryPaused,
}: UseCanvasProjectPersistenceOptions) {
    const navigate = useNavigate();
    const hydrated = useCanvasStore((state) => state.hydrated);
    const openProject = useCanvasStore((state) => state.openProject);
    const updateProject = useCanvasStore((state) => state.updateProject);
    const viewportSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (!hydrated) return;
        setProjectLoaded(false);
        const project = openProject(projectId);
        if (!project) {
            navigate("/canvas", { replace: true });
            return;
        }

        const restore = async () => {
            const restoredNodes = await hydrateCanvasImages(resetInterruptedGeneration(project.nodes));
            const restoredSessions = await hydrateAssistantImages(project.chatSessions || []);
            const historyEntry: CanvasHistoryEntry = {
                nodes: restoredNodes,
                connections: project.connections,
                chatSessions: restoredSessions,
                activeChatId: project.activeChatId || null,
                backgroundMode: project.backgroundMode,
                showImageInfo: project.showImageInfo || false,
            };

            setNodes(restoredNodes);
            setConnections(project.connections);
            setChatSessions(restoredSessions);
            setActiveChatId(project.activeChatId || null);
            setBackgroundMode(project.backgroundMode);
            setShowImageInfo(project.showImageInfo || false);
            setViewport(project.viewport);
            resetHistory(historyEntry);
            setProjectLoaded(true);
            persistRemoteImages(restoredNodes, setNodes);
        };

        void restore();
    }, [hydrated, navigate, openProject, projectId, resetHistory, setActiveChatId, setBackgroundMode, setChatSessions, setConnections, setNodes, setProjectLoaded, setShowImageInfo, setViewport]);

    useEffect(() => {
        if (!projectLoaded || isHistoryPaused()) return;
        updateProject(projectId, { nodes, connections, chatSessions, activeChatId, backgroundMode, showImageInfo });
    }, [activeChatId, backgroundMode, chatSessions, connections, isHistoryPaused, nodes, projectId, projectLoaded, showImageInfo, updateProject]);

    useEffect(() => {
        if (!projectLoaded) return;
        if (viewportSaveTimerRef.current) clearTimeout(viewportSaveTimerRef.current);
        viewportSaveTimerRef.current = setTimeout(() => {
            updateProject(projectId, { viewport });
            viewportSaveTimerRef.current = null;
        }, 500);
        return () => {
            if (viewportSaveTimerRef.current) clearTimeout(viewportSaveTimerRef.current);
        };
    }, [projectId, projectLoaded, updateProject, viewport]);
}

function persistRemoteImages(nodes: CanvasNodeData[], setNodes: Dispatch<SetStateAction<CanvasNodeData[]>>) {
    nodes.forEach((node) => {
        if (node.type !== CanvasNodeType.Image || node.metadata?.storageKey) return;
        const remote = node.metadata?.content || "";
        if (!/^https?:\/\//i.test(remote) && !remote.startsWith("/api/proxy?")) return;
        persistImageUrlInBackground(remote, (stored) => {
            setNodes((current) => current.map((item) => (item.id === node.id ? { ...item, metadata: { ...item.metadata, ...imageMetadata(stored) } } : item)));
        });
    });
}
