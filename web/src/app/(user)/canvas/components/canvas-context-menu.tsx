import { useEffect } from "react";
import type { ReactNode } from "react";
import { BetweenHorizontalStart, FileText, GalleryHorizontal, GalleryHorizontalEnd, Group, Image as ImageIcon, List, Music2, Plus, Settings2, Trash2, Ungroup, Video } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasNodeType, type ContextMenuState } from "../types";
import type { VideoFramePosition } from "../utils/canvas-video-frame";

export function CanvasNodeContextMenu({
    menu,
    onClose,
    onDuplicate,
    onDelete,
    onCreateNode,
    onCreateScriptNode,
    canCaptureVideoFrame = false,
    canGroup = false,
    canUngroup = false,
    onCaptureVideoFrame,
    onGroup,
    onUngroup,
}: {
    menu: ContextMenuState;
    onClose: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onCreateNode: (type: CanvasNodeType) => void;
    onCreateScriptNode: () => void;
    canCaptureVideoFrame?: boolean;
    canGroup?: boolean;
    canUngroup?: boolean;
    onCaptureVideoFrame?: (position: VideoFramePosition) => void;
    onGroup?: () => void;
    onUngroup?: () => void;
}) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];

    useEffect(() => {
        const close = (event: PointerEvent) => {
            const target = event.target;
            if (target instanceof Element && target.closest(".ant-popover")) return;
            onClose();
        };
        window.addEventListener("pointerdown", close);
        return () => window.removeEventListener("pointerdown", close);
    }, [onClose]);

    return (
        <div
            className="fixed z-[80] min-w-44 overflow-hidden rounded-xl border py-1 shadow-2xl"
            style={{ left: menu.x, top: menu.y, background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}
            onPointerDown={(event) => event.stopPropagation()}
        >
            {menu.type === "canvas" ? (
                <>
                    <MenuButton icon={<List className="size-4" />} label="新建文本生成" onClick={() => onCreateNode(CanvasNodeType.Text)} />
                    <MenuButton icon={<FileText className="size-4" />} label="新建脚本生成器" onClick={onCreateScriptNode} />
                    <MenuButton icon={<ImageIcon className="size-4" />} label="新建图片生成" onClick={() => onCreateNode(CanvasNodeType.Image)} />
                    <MenuButton icon={<Video className="size-4" />} label="新建视频生成" onClick={() => onCreateNode(CanvasNodeType.Video)} />
                    <MenuButton icon={<Music2 className="size-4" />} label="新建音频参考" onClick={() => onCreateNode(CanvasNodeType.Audio)} />
                    <MenuButton icon={<Settings2 className="size-4" />} label="新建配置节点" onClick={() => onCreateNode(CanvasNodeType.Config)} />
                </>
            ) : (
                <>
                    {menu.type === "node" && canCaptureVideoFrame ? (
                        <>
                            <MenuButton icon={<BetweenHorizontalStart className="size-4" />} label="截取首帧" onClick={() => onCaptureVideoFrame?.("first")} />
                            <MenuButton icon={<GalleryHorizontalEnd className="size-4" />} label="截取尾帧" onClick={() => onCaptureVideoFrame?.("last")} />
                            <MenuButton icon={<GalleryHorizontal className="size-4" />} label="截取当前帧" onClick={() => onCaptureVideoFrame?.("current")} />
                            <div className="my-1 border-t" style={{ borderColor: theme.toolbar.border }} />
                        </>
                    ) : null}
                    {menu.type === "node" && canGroup ? <MenuButton icon={<Group className="size-4" />} label="创建分组" onClick={onGroup} /> : null}
                    {menu.type === "node" && canUngroup ? <MenuButton icon={<Ungroup className="size-4" />} label="取消分组" onClick={onUngroup} /> : null}
                    {menu.type === "node" ? <MenuButton icon={<Plus className="size-4" />} label="Duplicate" onClick={onDuplicate} /> : null}
                    <MenuButton icon={<Trash2 className="size-4" />} label="Delete" onClick={onDelete} danger />
                </>
            )}
        </div>
    );
}

function MenuButton({ icon, label, onClick, danger = false }: { icon: ReactNode; label: string; onClick?: () => void; danger?: boolean }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];

    return (
        <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:opacity-80" style={{ color: danger ? "#f87171" : theme.node.text }} onClick={onClick}>
            {icon}
            <span>{label}</span>
        </button>
    );
}
