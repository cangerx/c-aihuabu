"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronRight, DownloadCloud, Film, FileText, Image as ImageIcon, MessageSquareText, Music2, RefreshCw, SplitSquareHorizontal, Star, Video, Wand2 } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { formatBytes } from "@/lib/image-utils";
import { proxiedImageDisplayUrl } from "@/services/image-storage";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasResourceMentionTextarea } from "./canvas-resource-mention-textarea";
import { CanvasNodeType, type CanvasNodeData, type CanvasNodeMetadata, type CanvasScriptMode, type CanvasScriptScene, type Position } from "../types";
import type { CanvasResourceReference } from "../utils/canvas-resource-references";

type ResizeCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
const selectionBlue = "#2f80ff";

type CanvasNodeProps = {
    data: CanvasNodeData;
    scale: number;
    isSelected: boolean;
    isRelated: boolean;
    isFocusRelated: boolean;
    isConnectionTarget: boolean;
    isConnecting: boolean;
    editRequestNonce?: number;
    showPanel: boolean;
    showImageInfo: boolean;
    resourceLabel?: CanvasResourceReference;
    mentionReferences?: CanvasResourceReference[];
    renderPanel?: (node: CanvasNodeData) => ReactNode;
    renderNodeContent?: (node: CanvasNodeData) => ReactNode;
    batchCount?: number;
    batchExpanded?: boolean;
    batchClosing?: boolean;
    batchOpening?: boolean;
    batchRecovering?: boolean;
    batchMotion?: { x: number; y: number; index: number };
    onMouseDown: (event: React.MouseEvent, nodeId: string) => void;
    onHoverStart: (nodeId: string) => void;
    onHoverEnd: (nodeId: string) => void;
    onConnectStart: (event: React.MouseEvent, nodeId: string, handleType: "source" | "target") => void;
    onResize: (nodeId: string, width: number, height: number, position?: Position) => void;
    onContentChange: (nodeId: string, content: string) => void;
    onMetadataChange?: (nodeId: string, patch: Partial<CanvasNodeMetadata>) => void;
    onToggleBatch?: (nodeId: string) => void;
    onSetBatchPrimary?: (node: CanvasNodeData) => void;
    onRetry?: (node: CanvasNodeData) => void;
    onPullVideoTask?: (node: CanvasNodeData) => void;
    onGenerateImage?: (node: CanvasNodeData) => void;
    onGenerateScript?: (node: CanvasNodeData) => void;
    onExpandScript?: (node: CanvasNodeData) => void;
    onUploadReference?: (node: CanvasNodeData) => void;
    onViewImage?: (node: CanvasNodeData) => void;
    onContextMenu: (event: React.MouseEvent, nodeId: string) => void;
};

type NodeContentRendererProps = {
    node: CanvasNodeData;
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    isEditingContent: boolean;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    isBatchRoot: boolean;
    batchCount: number;
    batchExpanded: boolean;
    batchOpening: boolean;
    batchRecovering: boolean;
    renderNodeContent?: (node: CanvasNodeData) => ReactNode;
    onContentChange: (nodeId: string, content: string) => void;
    onMetadataChange?: (nodeId: string, patch: Partial<CanvasNodeMetadata>) => void;
    onStopEditing: () => void;
    mentionReferences: CanvasResourceReference[];
    onRetry?: (node: CanvasNodeData) => void;
    onPullVideoTask?: (node: CanvasNodeData) => void;
    onGenerateImage?: (node: CanvasNodeData) => void;
    onGenerateScript?: (node: CanvasNodeData) => void;
    onExpandScript?: (node: CanvasNodeData) => void;
    onUploadReference?: (node: CanvasNodeData) => void;
    onToggleBatch?: () => void;
    onSetBatchPrimary?: () => void;
};

export const CanvasNode = React.memo(function CanvasNode({
    data,
    scale,
    isSelected,
    isRelated,
    isFocusRelated,
    isConnectionTarget,
    isConnecting,
    editRequestNonce = 0,
    showPanel,
    showImageInfo,
    resourceLabel,
    mentionReferences = [],
    renderPanel,
    renderNodeContent,
    batchCount = 0,
    batchExpanded = false,
    batchClosing = false,
    batchOpening = false,
    batchRecovering = false,
    batchMotion,
    onMouseDown,
    onHoverStart,
    onHoverEnd,
    onConnectStart,
    onResize,
    onContentChange,
    onMetadataChange,
    onToggleBatch,
    onSetBatchPrimary,
    onRetry,
    onPullVideoTask,
    onGenerateImage,
    onGenerateScript,
    onExpandScript,
    onUploadReference,
    onViewImage,
    onContextMenu,
}: CanvasNodeProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [hovered, setHovered] = useState(false);
    const [isEditingContent, setIsEditingContent] = useState(false);
    const hasImageContent = data.type === CanvasNodeType.Image && Boolean(data.metadata?.content);
    const hasVideoContent = data.type === CanvasNodeType.Video && Boolean(data.metadata?.content);
    const hasAudioContent = data.type === CanvasNodeType.Audio && Boolean(data.metadata?.content);
    const isBatchRoot = data.type === CanvasNodeType.Image && Boolean(data.metadata?.isBatchRoot) && batchCount > 1;
    const isBatchChild = data.type === CanvasNodeType.Image && Boolean(data.metadata?.batchRootId);
    const isActive = isConnectionTarget || isSelected || isFocusRelated;
    const imageBorderColor = isActive ? selectionBlue : isRelated && !isBatchChild ? theme.node.muted : "transparent";
    const panelScale = Math.min(1.85, Math.max(1, 0.82 / Math.max(scale, 0.1)));
    const panelWidth = data.type === CanvasNodeType.Video ? "min(680px,calc(100vw-32px))" : "min(540px,calc(100vw-32px))";
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const resizeRef = useRef({
        isResizing: false,
        corner: "bottom-right" as ResizeCorner,
        startX: 0,
        startY: 0,
        startLeft: 0,
        startTop: 0,
        startWidth: 0,
        startHeight: 0,
        keepRatio: false,
        ratio: 1,
    });

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const handleWheel = (event: WheelEvent) => event.stopPropagation();
        textarea.addEventListener("wheel", handleWheel, { passive: false });
        return () => textarea.removeEventListener("wheel", handleWheel);
    }, [data.type, isEditingContent]);

    useEffect(() => {
        if (!isEditingContent) return;
        const textarea = textareaRef.current;
        textarea?.focus();
        textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
    }, [isEditingContent]);

    useEffect(() => {
        if (!editRequestNonce || data.type !== CanvasNodeType.Text) return;
        setIsEditingContent(true);
    }, [data.type, editRequestNonce]);

    useEffect(() => {
        if (!isEditingContent) return;

        const handleOutsidePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (isEditingContent && textareaRef.current?.contains(target)) return;

            setIsEditingContent(false);
        };

        window.addEventListener("pointerdown", handleOutsidePointerDown, true);
        return () => window.removeEventListener("pointerdown", handleOutsidePointerDown, true);
    }, [isEditingContent]);

    const handleResizeMove = useCallback(
        (event: MouseEvent) => {
            if (!resizeRef.current.isResizing) return;

            const dx = (event.clientX - resizeRef.current.startX) / scale;
            const dy = (event.clientY - resizeRef.current.startY) / scale;
            const minWidth = 220;
            const minHeight = 160;
            const startRight = resizeRef.current.startLeft + resizeRef.current.startWidth;
            const startBottom = resizeRef.current.startTop + resizeRef.current.startHeight;
            const fromLeft = resizeRef.current.corner.includes("left");
            const fromTop = resizeRef.current.corner.includes("top");
            const rawWidth = Math.max(minWidth, resizeRef.current.startWidth + (fromLeft ? -dx : dx));
            const rawHeight = Math.max(minHeight, resizeRef.current.startHeight + (fromTop ? -dy : dy));
            let width = rawWidth;
            let height = rawHeight;
            if (resizeRef.current.keepRatio) {
                const ratio = resizeRef.current.ratio;
                if (Math.abs(dx) >= Math.abs(dy)) {
                    height = width / ratio;
                } else {
                    width = height * ratio;
                }
                if (height < minHeight) {
                    height = minHeight;
                    width = height * ratio;
                }
                if (width < minWidth) {
                    width = minWidth;
                    height = width / ratio;
                }
            }

            onResize(data.id, width, height, {
                x: fromLeft ? startRight - width : resizeRef.current.startLeft,
                y: fromTop ? startBottom - height : resizeRef.current.startTop,
            });
        },
        [data.id, onResize, scale],
    );

    const handleResizeUp = useCallback(() => {
        resizeRef.current.isResizing = false;
        window.removeEventListener("mousemove", handleResizeMove);
        window.removeEventListener("mouseup", handleResizeUp);
    }, [handleResizeMove]);

    const handleResizeMouseDown = (event: React.MouseEvent, corner: ResizeCorner) => {
        event.stopPropagation();
        event.preventDefault();
        resizeRef.current = {
            isResizing: true,
            corner,
            startX: event.clientX,
            startY: event.clientY,
            startLeft: data.position.x,
            startTop: data.position.y,
            startWidth: data.width,
            startHeight: data.height,
            keepRatio: (data.type === CanvasNodeType.Image && !data.metadata?.freeResize) || data.type === CanvasNodeType.Video,
            ratio: (data.metadata?.naturalWidth || data.width) / (data.metadata?.naturalHeight || data.height || 1),
        };
        window.addEventListener("mousemove", handleResizeMove);
        window.addEventListener("mouseup", handleResizeUp);
    };

    useEffect(() => {
        return () => {
            window.removeEventListener("mousemove", handleResizeMove);
            window.removeEventListener("mouseup", handleResizeUp);
        };
    }, [handleResizeMove, handleResizeUp]);

    return (
        <div
            data-node-id={data.id}
            className={`node-element absolute flex select-none flex-col transition-shadow duration-200 ${isSelected ? "z-50" : "z-10"}`}
            style={{
                transform: `translate(${data.position.x}px, ${data.position.y}px)`,
                width: data.width,
                height: data.height,
                transition: "box-shadow 200ms ease",
                contain: "layout style",
            }}
            onMouseEnter={() => {
                setHovered(true);
                onHoverStart(data.id);
            }}
            onMouseLeave={() => {
                setHovered(false);
                onHoverEnd(data.id);
            }}
            onContextMenu={(event) => onContextMenu(event, data.id)}
        >
            <div
                className="relative h-full w-full overflow-visible rounded-3xl border-2"
                style={{
                    background: hasImageContent || hasVideoContent ? "transparent" : theme.node.fill,
                    borderColor: hasImageContent ? imageBorderColor : isActive ? selectionBlue : isRelated ? theme.node.muted : theme.node.stroke,
                    boxShadow: isActive ? `0 0 0 1px ${selectionBlue}55` : isRelated && !isBatchChild ? `0 0 0 1px ${theme.node.muted}55, 0 18px 48px rgba(0,0,0,.14)` : undefined,
                }}
                onMouseDown={(event) => onMouseDown(event, data.id)}
                onDoubleClick={(event) => {
                    if (isBatchRoot) {
                        event.stopPropagation();
                        onToggleBatch?.(data.id);
                        return;
                    }
                    if (data.type === CanvasNodeType.Image && hasImageContent) {
                        event.stopPropagation();
                        onViewImage?.(data);
                        return;
                    }
                    if (data.type !== CanvasNodeType.Text) return;
                    event.stopPropagation();
                    setIsEditingContent(true);
                }}
            >
                <div
                    className={`relative flex h-full w-full items-center justify-center rounded-[inherit] ${isBatchRoot ? "overflow-visible" : "overflow-hidden"}`}
                    style={
                        {
                            background: hasImageContent || hasVideoContent ? "transparent" : theme.node.fill,
                            "--batch-from-x": `${batchMotion?.x || 0}px`,
                            "--batch-from-y": `${batchMotion?.y || 0}px`,
                            "--batch-from-rotate": `${6 + (batchMotion?.index || 0) * 4}deg`,
                            animation: data.metadata?.batchRootId ? (batchClosing ? "canvas-batch-child-out 260ms cubic-bezier(.4,0,.2,1) both" : "canvas-batch-child-in 340ms cubic-bezier(.2,.85,.18,1) both") : undefined,
                            animationDelay: data.metadata?.batchRootId ? `${batchClosing ? 0 : 45 + (batchMotion?.index || 0) * 24}ms` : undefined,
                        } as React.CSSProperties
                    }
                >
                    <NodeContent
                        node={data}
                        theme={theme}
                        isEditingContent={isEditingContent}
                        textareaRef={textareaRef}
                        isBatchRoot={isBatchRoot}
                        batchCount={batchCount}
                        batchExpanded={batchExpanded}
                        batchOpening={batchOpening}
                        batchRecovering={batchRecovering}
                        renderNodeContent={renderNodeContent}
                        mentionReferences={mentionReferences}
                        onContentChange={onContentChange}
                        onMetadataChange={onMetadataChange}
                        onStopEditing={() => setIsEditingContent(false)}
                        onRetry={onRetry}
                        onPullVideoTask={onPullVideoTask}
                        onGenerateImage={onGenerateImage}
                        onGenerateScript={onGenerateScript}
                        onExpandScript={onExpandScript}
                        onUploadReference={onUploadReference}
                        onToggleBatch={() => onToggleBatch?.(data.id)}
                        onSetBatchPrimary={() => onSetBatchPrimary?.(data)}
                    />
                </div>

                {showImageInfo && hasImageContent ? <ImageInfoBar node={data} /> : null}
                {resourceLabel ? <ResourceLabelBadge reference={resourceLabel} /> : null}

                {!hasImageContent && !hasVideoContent && !hasAudioContent ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12" style={{ background: `linear-gradient(to top, ${theme.canvas.background}66, transparent)` }} /> : null}

                <ResizeHandle corner="top-left" onMouseDown={handleResizeMouseDown} />
                <ResizeHandle corner="top-right" onMouseDown={handleResizeMouseDown} />
                <ResizeHandle corner="bottom-left" onMouseDown={handleResizeMouseDown} />
                <ResizeHandle corner="bottom-right" onMouseDown={handleResizeMouseDown} />
            </div>

            <ConnectionHandleDot side="left" visible={hovered || isSelected || isConnecting} onMouseDown={(event) => onConnectStart(event, data.id, "target")} />
            <ConnectionHandleDot side="right" visible={data.type !== CanvasNodeType.Config && (hovered || isSelected || isConnecting)} onMouseDown={(event) => onConnectStart(event, data.id, "source")} />

            {showPanel && renderPanel ? (
                <div
                    className="absolute left-1/2 top-full z-[70] pt-4"
                    style={{
                        width: panelWidth,
                        transform: `translateX(-50%) scale(${panelScale})`,
                        transformOrigin: "top center",
                    }}
                >
                    {renderPanel(data)}
                </div>
            ) : null}
        </div>
    );
});

function NodeContent(props: NodeContentRendererProps) {
    if (props.node.type === CanvasNodeType.Config && props.renderNodeContent) return props.renderNodeContent(props.node);
    if (props.isBatchRoot) return <ImageNodeContent {...props} />;
    if (props.node.metadata?.status === "loading" && props.node.type === CanvasNodeType.Video) return <VideoTaskContent node={props.node} theme={props.theme} />;
    if (props.node.metadata?.status === "loading") return <LoadingContent theme={props.theme} />;
    if (props.node.metadata?.status === "error") return <ErrorContent node={props.node} theme={props.theme} onRetry={props.onRetry} onPullVideoTask={props.onPullVideoTask} />;

    const Renderer = nodeContentRenderers[props.node.type];
    return Renderer ? <Renderer {...props} /> : <UnknownNodeContent theme={props.theme} />;
}

const nodeContentRenderers = {
    [CanvasNodeType.Text]: TextContent,
    [CanvasNodeType.Image]: ImageNodeContent,
    [CanvasNodeType.Config]: EmptyImageContent,
    [CanvasNodeType.Video]: VideoNodeContent,
    [CanvasNodeType.Audio]: AudioNodeContent,
} satisfies Record<CanvasNodeType, (props: NodeContentRendererProps) => ReactNode>;

function LoadingContent({ theme }: Pick<NodeContentRendererProps, "theme">) {
    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3" style={{ color: theme.node.activeStroke }}>
            <div className="size-10 animate-spin rounded-full border-2" style={{ borderColor: theme.node.stroke, borderTopColor: theme.node.activeStroke }} />
            <span className="text-[10px] tracking-[0.2em]">生成中</span>
        </div>
    );
}

function ErrorContent({ node, theme, onRetry, onPullVideoTask }: Pick<NodeContentRendererProps, "node" | "theme" | "onRetry" | "onPullVideoTask">) {
    const canPullVideoTask = node.type === CanvasNodeType.Video && Boolean(node.metadata?.videoTaskId);
    return (
        <div className="flex max-w-[260px] flex-col items-center gap-3 px-5 text-center">
            {node.type === CanvasNodeType.Video && node.metadata?.videoTaskId ? (
                <div className="max-w-full truncate rounded-full border px-2.5 py-1 text-[10px]" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.muted }}>
                    任务 ID：{node.metadata.videoTaskId}
                </div>
            ) : null}
            <div className="text-xs leading-5 text-red-300">{node.metadata?.errorDetails || "生成失败"}</div>
            <div className="flex flex-wrap justify-center gap-2">
                {canPullVideoTask ? (
                    <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition hover:scale-[1.02]"
                        style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}
                        onClick={(event) => {
                            event.stopPropagation();
                            onPullVideoTask?.(node);
                        }}
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <DownloadCloud className="size-3.5" />
                        拉取结果
                    </button>
                ) : null}
                <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition hover:scale-[1.02]"
                    style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}
                    onClick={(event) => {
                        event.stopPropagation();
                        onRetry?.(node);
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                >
                    <RefreshCw className="size-3.5" />
                    重试
                </button>
            </div>
        </div>
    );
}

function VideoTaskContent({ node, theme }: Pick<NodeContentRendererProps, "node" | "theme">) {
    const references = node.metadata?.references?.length || 0;
    const specs = [
        node.metadata?.videoMode ? videoModeLabel(node.metadata.videoMode) : "",
        node.metadata?.seconds ? `${node.metadata.seconds}秒` : "",
        node.metadata?.size,
        node.metadata?.vquality,
        node.metadata?.cameraMovement && node.metadata.cameraMovement !== "自适应" ? `运镜 ${node.metadata.cameraMovement}` : "",
    ].filter(Boolean);

    return (
        <div className="relative flex h-full w-full flex-col justify-between overflow-hidden rounded-[inherit] p-5" style={{ background: `linear-gradient(135deg, ${theme.node.fill}, ${theme.toolbar.panel})`, color: theme.node.text }}>
            <div className="pointer-events-none absolute -right-10 -top-14 size-36 rounded-full opacity-25 blur-2xl" style={{ background: theme.node.activeStroke }} />
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="grid size-11 shrink-0 place-items-center rounded-2xl" style={{ background: theme.toolbar.activeBg, color: theme.node.activeStroke }}>
                        <Film className="size-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">视频任务生成中</div>
                        <div className="mt-1 truncate text-[11px]" style={{ color: theme.node.muted }}>
                            {node.metadata?.model || "未选择模型"}
                        </div>
                    </div>
                </div>
                <div className="size-7 shrink-0 animate-spin rounded-full border-2" style={{ borderColor: theme.node.stroke, borderTopColor: theme.node.activeStroke }} />
            </div>
            <div className="space-y-2">
                {node.metadata?.videoTaskId ? <VideoTaskRow label="任务" value={node.metadata.videoTaskId} theme={theme} /> : null}
                {references ? <VideoTaskRow label="参考" value={`${references} 个素材`} theme={theme} /> : null}
                {specs.length ? <VideoTaskRow label="参数" value={specs.join(" · ")} theme={theme} /> : null}
            </div>
        </div>
    );
}

function VideoTaskRow({ label, value, theme }: { label: string; value: string; theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    return (
        <div className="flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-[11px]" style={{ background: `${theme.toolbar.panel}aa`, borderColor: theme.toolbar.border }}>
            <span className="shrink-0 opacity-50">{label}</span>
            <span className="truncate font-medium" style={{ color: theme.node.text }}>
                {value}
            </span>
        </div>
    );
}

function videoModeLabel(value: string) {
    if (value === "all-around") return "全能参考";
    if (value === "image-to-video") return "图生视频";
    if (value === "first-last") return "首尾帧";
    if (value === "image-ref") return "图片参考";
    return "文生视频";
}

function UnknownNodeContent({ theme }: Pick<NodeContentRendererProps, "theme">) {
    return (
        <div className="flex h-full w-full items-center justify-center text-sm" style={{ color: theme.node.placeholder }}>
            未知节点
        </div>
    );
}

function TextContent(props: NodeContentRendererProps) {
    if (props.node.metadata?.textKind === "script") return <ScriptContent {...props} />;
    return <NoteTextContent {...props} />;
}

function NoteTextContent({ node, theme, isEditingContent, textareaRef, mentionReferences, onContentChange, onStopEditing, onGenerateImage }: NodeContentRendererProps) {
    const fontSize = node.metadata?.fontSize || 14;
    const textStyle = { fontSize: `${fontSize}px`, lineHeight: `${Math.round(fontSize * 1.65)}px`, color: theme.node.text, boxSizing: "border-box" } as React.CSSProperties;

    return (
        <div className="flex h-full w-full flex-col overflow-hidden pt-8">
            <button
                type="button"
                className="absolute right-3 top-3 z-20 inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-medium opacity-85 backdrop-blur-md transition hover:scale-[1.02] hover:opacity-100"
                style={{ background: `${theme.toolbar.panel}dd`, borderColor: theme.node.stroke, color: theme.node.text }}
                onClick={(event) => {
                    event.stopPropagation();
                    onGenerateImage?.(node);
                }}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                title="用文本生图"
                aria-label="用文本生图"
            >
                <ImageIcon className="size-3.5" />
                生图
            </button>
            {isEditingContent ? (
                <CanvasResourceMentionTextarea
                    ref={textareaRef}
                    className="thin-scrollbar block h-full w-full resize-none overflow-y-auto whitespace-pre-wrap break-words border-none bg-transparent pl-4 pr-14 pt-0 pb-4 m-0 font-mono outline-none select-text appearance-none"
                    style={textStyle}
                    value={node.metadata?.content || ""}
                    references={mentionReferences}
                    highlightLabels={false}
                    onChange={(value) => onContentChange(node.id, value)}
                    onBlur={onStopEditing}
                    onKeyDown={(event) => {
                        if (event.key === "Escape") onStopEditing();
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    onWheel={(event) => event.stopPropagation()}
                />
            ) : (
                <div
                    className="thin-scrollbar block h-full w-full overflow-y-auto whitespace-pre-wrap break-words bg-transparent pl-4 pr-14 pt-0 pb-4 font-mono"
                    style={textStyle}
                    onWheel={(event) => event.stopPropagation()}
                >
                    {node.metadata?.content || <span style={{ color: theme.node.placeholder }}>双击编辑文字</span>}
                </div>
            )}
        </div>
    );
}

const scriptModes: Array<{ value: CanvasScriptMode; label: string; description: string }> = [
    { value: "storyboard", label: "主题分镜", description: "按主题直接拆镜头" },
    { value: "image-copy", label: "参考图文案", description: "分析图片并提炼文案" },
    { value: "image-video", label: "图文转视频", description: "把图文扩展成视频脚本" },
];

function ScriptContent({ node, theme, mentionReferences, onGenerateScript, onExpandScript, onUploadReference, onMetadataChange }: NodeContentRendererProps) {
    const scenes = node.metadata?.scriptScenes || [];
    const mode = node.metadata?.scriptMode || "storyboard";
    const hasScenes = scenes.length > 0;
    const summary = hasScenes ? `${scenes.length} 个镜头` : "等待生成分镜";
    const referenceSummary = summarizeScriptReferences(mentionReferences);
    const analysis = node.metadata?.scriptAnalysis?.trim();

    return (
        <div className="flex h-full w-full flex-col overflow-hidden p-4" style={{ color: theme.node.text }}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-2xl" style={{ background: theme.toolbar.activeBg, color: theme.node.activeStroke }}>
                        <FileText className="size-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">脚本生成器</div>
                        <div className="mt-0.5 truncate text-[11px]" style={{ color: theme.node.muted }}>
                            {summary}{referenceSummary ? ` · ${referenceSummary}` : ""}
                        </div>
                    </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                    <ScriptActionButton title="上传参考图" theme={theme} onClick={() => onUploadReference?.(node)}>
                        <ImageIcon className="size-3.5" />
                    </ScriptActionButton>
                    <ScriptActionButton title="生成分镜" theme={theme} onClick={() => onGenerateScript?.(node)}>
                        <Wand2 className="size-3.5" />
                    </ScriptActionButton>
                    <ScriptActionButton title="拆分镜头" disabled={!hasScenes} theme={theme} onClick={() => onExpandScript?.(node)}>
                        <SplitSquareHorizontal className="size-3.5" />
                    </ScriptActionButton>
                </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl border p-1" style={{ borderColor: theme.toolbar.border, background: `${theme.toolbar.panel}80` }}>
                {scriptModes.map((item) => {
                    const active = item.value === mode;
                    return (
                        <button
                            key={item.value}
                            type="button"
                            className="h-8 rounded-lg px-1 text-[11px] font-medium transition"
                            style={{ background: active ? theme.toolbar.activeBg : "transparent", color: active ? theme.toolbar.activeText : theme.node.muted }}
                            title={item.description}
                            onClick={(event) => {
                                event.stopPropagation();
                                onMetadataChange?.(node.id, { scriptMode: item.value });
                            }}
                            onMouseDown={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>
            {analysis ? (
                <div className="mt-3 rounded-xl border px-3 py-2 text-[11px] leading-5" style={{ background: `${theme.toolbar.panel}99`, borderColor: theme.toolbar.border, color: theme.node.muted }}>
                    <div className="mb-1 flex items-center gap-1.5 font-medium" style={{ color: theme.node.text }}>
                        <MessageSquareText className="size-3.5" />
                        文案分析
                    </div>
                    <div className="line-clamp-3 whitespace-pre-wrap">{analysis}</div>
                </div>
            ) : null}
            <div className="thin-scrollbar mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
                {hasScenes ? scenes.map((scene, index) => <ScriptSceneCard key={scene.id || index} scene={scene} index={index} theme={theme} />) : <ScriptEmptyState node={node} theme={theme} />}
            </div>
        </div>
    );
}

function ScriptActionButton({ title, disabled, theme, onClick, children }: { title: string; disabled?: boolean; theme: (typeof canvasThemes)[keyof typeof canvasThemes]; onClick?: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            className="grid size-8 place-items-center rounded-xl border transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-35"
            style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}
            title={title}
            aria-label={title}
            disabled={disabled}
            onClick={(event) => {
                event.stopPropagation();
                onClick?.();
            }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
        >
            {children}
        </button>
    );
}

function ScriptEmptyState({ node, theme }: { node: CanvasNodeData; theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    return (
        <div className="flex h-full min-h-[220px] flex-col justify-center rounded-2xl border border-dashed px-4 text-sm leading-6" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>
            <div className="mb-2 text-xs font-semibold" style={{ color: theme.node.text }}>
                输入脚本需求后生成分镜
            </div>
            <div className="line-clamp-5 whitespace-pre-wrap">{node.metadata?.prompt || "根据上游文本生成短视频分镜脚本。"}</div>
        </div>
    );
}

function ScriptSceneCard({ scene, index, theme }: { scene: CanvasScriptScene; index: number; theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    const meta = [scene.ratio, scene.duration, scene.camera].filter(Boolean).join(" · ");
    return (
        <div className="rounded-2xl border p-3" style={{ background: `${theme.toolbar.panel}99`, borderColor: theme.toolbar.border }}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">
                        {index + 1}. {scene.title || "未命名镜头"}
                    </div>
                    {meta ? (
                        <div className="mt-1 truncate text-[10px]" style={{ color: theme.node.muted }}>
                            {meta}
                        </div>
                    ) : null}
                </div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px]" style={{ background: theme.toolbar.activeBg, color: theme.node.activeStroke }}>
                    镜头
                </span>
            </div>
            <div className="mt-2 line-clamp-2 text-[11px] leading-5" style={{ color: theme.node.muted }}>
                {scene.visual || scene.imagePrompt || scene.videoPrompt}
            </div>
        </div>
    );
}

function summarizeScriptReferences(references: CanvasResourceReference[]) {
    const images = references.filter((item) => item.kind === "image").length;
    const texts = references.filter((item) => item.kind === "text").length;
    const videos = references.filter((item) => item.kind === "video").length;
    const parts = [images ? `${images}图` : "", texts ? `${texts}文` : "", videos ? `${videos}视频` : ""].filter(Boolean);
    return parts.join(" / ");
}

function ResourceLabelBadge({ reference }: { reference: CanvasResourceReference }) {
    return (
        <span className={`pointer-events-none absolute right-2 top-2 z-30 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${reference.active ? "bg-[#2f80ff] text-white shadow-sm" : "bg-black/35 text-white/75"}`}>
            {reference.label}
        </span>
    );
}

function ImageNodeContent(props: NodeContentRendererProps) {
    if (!props.node.metadata?.content && props.isBatchRoot) {
        const content =
            props.node.metadata?.status === "loading" ? (
                <LoadingContent theme={props.theme} />
            ) : props.node.metadata?.status === "error" ? (
                <ErrorContent node={props.node} theme={props.theme} onRetry={props.onRetry} onPullVideoTask={props.onPullVideoTask} />
            ) : (
                <EmptyImageContent {...props} isBatchRoot={false} />
            );
        return (
            <BatchFrame batchCount={props.batchCount} batchExpanded={props.batchExpanded} batchOpening={props.batchOpening} batchRecovering={props.batchRecovering} onToggleBatch={props.onToggleBatch}>
                {content}
            </BatchFrame>
        );
    }
    if (!props.node.metadata?.content) return <EmptyImageContent {...props} />;

    return (
        <ImageContent
            node={props.node}
            isBatchRoot={props.isBatchRoot}
            batchCount={props.batchCount}
            batchExpanded={props.batchExpanded}
            batchOpening={props.batchOpening}
            batchRecovering={props.batchRecovering}
            onToggleBatch={props.onToggleBatch}
            onSetBatchPrimary={props.onSetBatchPrimary}
        />
    );
}

function EmptyImageContent({ theme, isBatchRoot, batchCount, batchExpanded, batchOpening, batchRecovering, onToggleBatch }: NodeContentRendererProps) {
    const content = (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3" style={{ color: theme.node.placeholder }}>
            <div className="flex size-14 items-center justify-center rounded-2xl" style={{ background: theme.toolbar.activeBg }}>
                <ImageIcon className="size-6 opacity-30" />
            </div>
            <span className="text-[10px] tracking-[0.18em] opacity-50">空图片节点</span>
        </div>
    );
    if (isBatchRoot)
        return (
            <BatchFrame batchCount={batchCount} batchExpanded={batchExpanded} batchOpening={batchOpening} batchRecovering={batchRecovering} onToggleBatch={onToggleBatch}>
                {content}
            </BatchFrame>
        );
    return content;
}

function VideoNodeContent({ node, theme }: NodeContentRendererProps) {
    if (!node.metadata?.content)
        return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3" style={{ color: theme.node.placeholder }}>
                <Video className="size-7 opacity-35" />
                <span className="text-sm">空视频节点</span>
            </div>
        );
    return (
        <div className="relative h-full w-full">
            <video src={node.metadata.content} controls draggable={false} className="h-full w-full rounded-[18px] bg-black object-contain" data-canvas-no-zoom onMouseDown={(event) => event.stopPropagation()} />
            <div className="absolute inset-x-10 top-2 z-30 h-7 cursor-move rounded-full border text-center text-[10px] font-medium leading-7 opacity-70 backdrop-blur transition hover:opacity-100" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }} data-canvas-drag-handle>
                拖动视频
            </div>
            <VideoInfoOverlay node={node} theme={theme} />
        </div>
    );
}

function VideoInfoOverlay({ node, theme }: { node: CanvasNodeData; theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    const references = node.metadata?.references?.length || 0;
    const primary = [node.metadata?.model, node.metadata?.videoMode ? videoModeLabel(node.metadata.videoMode) : "", node.metadata?.seconds ? `${node.metadata.seconds}秒` : ""].filter(Boolean).join(" · ");
    const secondary = [references ? `${references} 参考` : "", node.metadata?.cameraMovement && node.metadata.cameraMovement !== "自适应" ? `运镜 ${node.metadata.cameraMovement}` : "", node.metadata?.videoTaskId ? `ID ${node.metadata.videoTaskId}` : ""].filter(Boolean).join(" · ");
    if (!primary && !secondary) return null;
    return (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 rounded-2xl border px-3 py-2 backdrop-blur-md" style={{ background: `${theme.toolbar.panel}d9`, borderColor: `${theme.toolbar.border}cc`, color: theme.node.text }}>
            {primary ? <div className="truncate text-[11px] font-semibold">{primary}</div> : null}
            {secondary ? (
                <div className="mt-0.5 truncate text-[10px]" style={{ color: theme.node.muted }}>
                    {secondary}
                </div>
            ) : null}
        </div>
    );
}

function AudioNodeContent({ node, theme }: NodeContentRendererProps) {
    if (!node.metadata?.content)
        return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2" style={{ color: theme.node.placeholder }}>
                <Music2 className="size-7 opacity-35" />
                <span className="text-sm">空音频节点</span>
            </div>
        );
    return (
        <div className="flex h-full w-full flex-col justify-center gap-3 px-4" style={{ background: theme.node.fill, color: theme.node.text }}>
            <div className="flex min-w-0 items-center gap-2 text-sm opacity-70">
                <Music2 className="size-4 shrink-0" />
                <span className="truncate">{node.title || "音频"}</span>
            </div>
            <audio src={node.metadata.content} controls className="w-full" data-canvas-no-zoom />
        </div>
    );
}

function ImageContent({
    node,
    isBatchRoot,
    batchCount,
    batchExpanded,
    batchOpening,
    batchRecovering,
    onToggleBatch,
    onSetBatchPrimary,
}: {
    node: CanvasNodeData;
    isBatchRoot: boolean;
    batchCount: number;
    batchExpanded: boolean;
    batchOpening: boolean;
    batchRecovering: boolean;
    onToggleBatch?: () => void;
    onSetBatchPrimary?: () => void;
}) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const isBatchChild = Boolean(node.metadata?.batchRootId);
    const sourceUrl = node.metadata!.content!;
    const [displayUrl, setDisplayUrl] = useState(() => proxiedImageDisplayUrl(sourceUrl));

    useEffect(() => {
        setDisplayUrl(proxiedImageDisplayUrl(sourceUrl));
    }, [sourceUrl]);

    return (
        <BatchFrame batchCount={isBatchRoot ? batchCount : 0} batchExpanded={batchExpanded} batchOpening={batchOpening} batchRecovering={batchRecovering} onToggleBatch={onToggleBatch}>
            <div className="h-full w-full overflow-hidden rounded-3xl">
                <img
                    src={displayUrl}
                    alt={node.title}
                    draggable={false}
                    onError={() => {
                        const fallback = proxiedImageDisplayUrl(sourceUrl);
                        if (fallback !== displayUrl) setDisplayUrl(fallback);
                    }}
                    onDragStart={(event) => event.preventDefault()}
                    className={`pointer-events-none block h-full w-full select-none ${node.metadata?.freeResize ? "object-fill" : "object-contain"}`}
                />
            </div>
            {isBatchRoot ? (
                <button
                    type="button"
                    className="absolute right-2.5 top-2.5 z-30 flex h-8 items-center justify-center gap-1 rounded-full border px-2.5 text-xs font-semibold shadow-[0_6px_18px_rgba(15,23,42,.10)] backdrop-blur-md transition hover:scale-[1.02]"
                    style={{ background: `${theme.toolbar.panel}d9`, borderColor: `${theme.toolbar.border}cc`, color: theme.node.text }}
                    aria-label={batchExpanded ? "图片组已展开" : "图片组已收起"}
                    onClick={(event) => {
                        event.stopPropagation();
                        onToggleBatch?.();
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    <span className="leading-none text-[#2f80ff]">{batchCount}</span>
                    <ChevronRight className={`size-3.5 opacity-55 transition-transform ${batchExpanded ? "rotate-90" : ""}`} />
                </button>
            ) : null}
            {isBatchChild ? (
                <button
                    type="button"
                    className="absolute right-3 top-3 z-30 flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium opacity-0 shadow-[0_8px_20px_rgba(68,64,60,.13)] backdrop-blur-md transition group-hover/batch:opacity-100 hover:scale-[1.02]"
                    style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}
                    onClick={(event) => {
                        event.stopPropagation();
                        onSetBatchPrimary?.();
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    <Star className="size-3.5 text-[#2f80ff]" />
                    设为主图
                </button>
            ) : null}
        </BatchFrame>
    );
}

function ImageInfoBar({ node }: { node: CanvasNodeData }) {
    const width = Math.round(node.metadata?.naturalWidth || node.width);
    const height = Math.round(node.metadata?.naturalHeight || node.height);
    const size = formatBytes(node.metadata?.bytes || 0);
    return (
        <div className="pointer-events-none absolute bottom-3 right-3 z-40 max-w-[calc(100%-24px)]">
            <span className="max-w-full truncate rounded-md bg-black/55 px-2 py-1 text-[11px] font-medium leading-none text-white backdrop-blur-sm">
                {width} x {height}
                {size ? ` · ${size}` : ""}
            </span>
        </div>
    );
}

function BatchFrame({ batchCount, batchExpanded, batchOpening, batchRecovering, onToggleBatch, children }: { batchCount: number; batchExpanded: boolean; batchOpening: boolean; batchRecovering: boolean; onToggleBatch?: () => void; children: ReactNode }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const isBatchRoot = batchCount > 1;
    return (
        <div
            className="group/batch relative h-full w-full overflow-visible"
            onDoubleClick={
                isBatchRoot
                    ? (event) => {
                          event.stopPropagation();
                          onToggleBatch?.();
                      }
                    : undefined
            }
        >
            {isBatchRoot ? (
                <div className="pointer-events-none absolute inset-0 overflow-visible">
                    {Array.from({ length: Math.min(batchCount - 1, 5) }).map((_, index) => (
                        <div
                            key={index}
                            className="absolute rounded-[inherit] border shadow-[0_14px_34px_rgba(68,64,60,.16)] transition-all duration-300 group-hover/batch:translate-x-2"
                            style={{
                                inset: 0,
                                background: `linear-gradient(135deg, ${theme.node.panel}, ${theme.node.fill})`,
                                borderColor: theme.node.stroke,
                                opacity: batchExpanded && !batchOpening ? 0.34 : 1,
                                transform:
                                    batchOpening || batchRecovering ? `translate(${54 + index * 22}px, ${20 + index * 12}px) rotate(${8 + index * 5}deg) scale(.98)` : `translate(${34 + index * 18}px, ${14 + index * 10}px) rotate(${6 + index * 4}deg)`,
                                zIndex: -index - 1,
                            }}
                        />
                    ))}
                </div>
            ) : null}
            {children}
        </div>
    );
}
function ResizeHandle({ corner, onMouseDown }: { corner: ResizeCorner; onMouseDown: (event: React.MouseEvent, corner: ResizeCorner) => void }) {
    const positionClass = {
        "top-left": "-left-[14px] -top-[14px] cursor-nwse-resize",
        "top-right": "-right-[14px] -top-[14px] cursor-nesw-resize",
        "bottom-left": "-bottom-[14px] -left-[14px] cursor-nesw-resize",
        "bottom-right": "-bottom-[14px] -right-[14px] cursor-nwse-resize",
    }[corner];

    return <div className={`absolute z-50 size-7 ${positionClass}`} onMouseDown={(event) => onMouseDown(event, corner)} />;
}

function ConnectionHandleDot({ side, visible, onMouseDown }: { side: "left" | "right"; visible: boolean; onMouseDown: (event: React.MouseEvent) => void }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];

    return (
        <div
            className={`absolute top-1/2 z-30 flex size-12 -translate-y-1/2 cursor-crosshair items-center justify-center transition-opacity duration-150 ${
                side === "left" ? "-left-6" : "-right-6"
            } ${visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
            onMouseDown={onMouseDown}
        >
            <div className="size-3 rounded-full border-2 transition-all hover:scale-125" style={{ background: theme.node.panel, borderColor: theme.node.muted }} />
        </div>
    );
}
