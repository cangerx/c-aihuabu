import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";

import type { CanvasNodeData } from "../types";

type CanvasGenerationRequest = {
    targetNodeId: string;
    originNodeId: string;
    runningNodeId: string;
    controller: AbortController;
};

export function useCanvasGenerationRequests({ setNodes, setRunningNodeId }: { setNodes: Dispatch<SetStateAction<CanvasNodeData[]>>; setRunningNodeId: Dispatch<SetStateAction<string | null>> }) {
    const requestsRef = useRef(new Map<string, CanvasGenerationRequest>());

    const startGenerationRequest = useCallback((targetNodeId: string, originNodeId: string, runningId = originNodeId, controller = new AbortController()) => {
        const previous = requestsRef.current.get(targetNodeId);
        if (previous?.controller !== controller) previous?.controller.abort();
        requestsRef.current.set(targetNodeId, { targetNodeId, originNodeId, runningNodeId: runningId, controller });
        return controller;
    }, []);

    const finishGenerationRequest = useCallback((targetNodeId: string, controller: AbortController) => {
        const request = requestsRef.current.get(targetNodeId);
        if (request?.controller === controller) requestsRef.current.delete(targetNodeId);
    }, []);

    const abortGenerationRequestsForNodeIds = useCallback((nodeIds: Set<string>) => {
        requestsRef.current.forEach((request) => {
            if (!nodeIds.has(request.targetNodeId) && !nodeIds.has(request.originNodeId) && !nodeIds.has(request.runningNodeId)) return;
            request.controller.abort();
            requestsRef.current.delete(request.targetNodeId);
        });
    }, []);

    const stopGenerationByRunningId = useCallback(
        (runningId: string) => {
            const affectedNodeIds = new Set<string>();
            requestsRef.current.forEach((request) => {
                if (request.runningNodeId !== runningId) return;
                request.controller.abort();
                requestsRef.current.delete(request.targetNodeId);
                affectedNodeIds.add(request.targetNodeId);
                affectedNodeIds.add(request.originNodeId);
            });
            setRunningNodeId((current) => (current === runningId ? null : current));
            if (!affectedNodeIds.size) return;
            setNodes((nodes) =>
                nodes.map((node) =>
                    affectedNodeIds.has(node.id) && node.metadata?.status === "loading"
                        ? { ...node, metadata: { ...node.metadata, status: "idle", errorDetails: undefined } }
                        : node,
                ),
            );
        },
        [setNodes, setRunningNodeId],
    );

    return { startGenerationRequest, finishGenerationRequest, abortGenerationRequestsForNodeIds, stopGenerationByRunningId };
}
