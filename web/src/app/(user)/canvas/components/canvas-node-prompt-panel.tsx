"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Camera, LoaderCircle, Music2, Wand2, Plus, ChevronDown, Palette } from "lucide-react";
import { App, Button, Tooltip, Dropdown } from "antd";

import { ModelPicker } from "@/components/model-picker";
import { defaultConfig, modelOptionName, useConfigStore, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { requestCreditCost } from "@/constant/credits";
import { canvasThemes } from "@/lib/canvas-theme";
import { isGrokImagineImageConfig, normalizeGrokImagineImageCount } from "@/lib/grok-imagine";
import { isStepImageEdit2Config, normalizeStepImageEdit2Size } from "@/lib/step-image";
import { caiVideoModelCapabilities, isSeedanceVideoModel } from "@/lib/seedance-video";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasImageSettingsPopover } from "./canvas-image-settings-popover";
import { PromptSelectDialog } from "@/components/prompts/prompt-select-dialog";
import { CanvasAudioSettingsPopover, type CanvasAudioSettingKey } from "./canvas-audio-settings-popover";
import { CanvasResourceMentionTextarea } from "./canvas-resource-mention-textarea";
import { CanvasVideoSettingsPopover } from "./canvas-video-settings-popover";
import { CanvasNodeType, type CanvasGenerationMode, type CanvasNodeData } from "../types";
import type { CanvasResourceReference } from "../utils/canvas-resource-references";

export type CanvasNodeGenerationMode = CanvasGenerationMode;

type CanvasNodePromptPanelProps = {
    node: CanvasNodeData;
    isRunning: boolean;
    onPromptChange: (nodeId: string, prompt: string) => void;
    onConfigChange: (nodeId: string, patch: Partial<CanvasNodeData["metadata"]>) => void;
    onGenerate: (nodeId: string, mode: CanvasNodeGenerationMode, prompt: string) => void;
    onStop: (nodeId: string) => void;
    mentionReferences?: CanvasResourceReference[];
    onImageSettingsOpenChange?: (open: boolean) => void;
    onRemoveReference?: (refNodeId: string) => void;
};

export function CanvasNodePromptPanel({ node, isRunning, onPromptChange, onConfigChange, onGenerate, onStop, mentionReferences = [], onImageSettingsOpenChange, onRemoveReference }: CanvasNodePromptPanelProps) {
    const { message } = App.useApp();
    const globalConfig = useEffectiveConfig();
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const themeKey = useThemeStore((state) => state.theme);
    const theme = canvasThemes[themeKey];
    const mode = defaultMode(node.type);
    const config = buildNodeConfig(globalConfig, node, mode);
    const hasTextContent = node.type === CanvasNodeType.Text && Boolean(node.metadata?.content?.trim());
    const hasImageContent = node.type === CanvasNodeType.Image && Boolean(node.metadata?.content);
    const [prompt, setPrompt] = useState(node.metadata?.prompt || "");
    const [promptLibraryOpen, setPromptLibraryOpen] = useState(false);
    const credits = requestCreditCost({ channelMode: config.channelMode, model: config.model, count: mode === "image" && isGrokImagineImageConfig(config) ? String(normalizeGrokImagineImageCount(config.count)) : mode === "image" ? config.count : 1 });

    const [activeVideoTab, setActiveVideoTab] = useState<string>(node.metadata?.videoMode || "text-to-video");
    const [cameraMovement, setCameraMovement] = useState<string>(node.metadata?.cameraMovement || "自适应");
    const [mentionTriggerKey, setMentionTriggerKey] = useState(0);
    const promptInputRef = useRef<HTMLTextAreaElement>(null);

    const imageRefs = mentionReferences.filter((r) => r.kind === "image");
    const videoRefs = mentionReferences.filter((r) => r.kind === "video");
    const audioRefs = mentionReferences.filter((r) => r.kind === "audio");
    const videoModelName = modelOptionName(config.model || config.videoModel);
    const videoCapabilities = caiVideoModelCapabilities(videoModelName);
    const isSeedanceVideo = mode === "video" && isSeedanceVideoModel(videoModelName);
    const supportsRichVideoRefs = videoCapabilities.allAroundReference || isSeedanceVideo;
    const totalRefs = imageRefs.length + (supportsRichVideoRefs ? videoRefs.length + audioRefs.length : 0);
    const activeRefs = mentionReferences.filter((r) => r.active);
    const hasSingleImageRef = imageRefs.length === 1;

    const videoTabs = [
        { id: "text-to-video", label: "文生视频", enabled: videoCapabilities.textToVideo, tooltip: "当前模型必须连接图片后生成视频" },
        ...(videoCapabilities.allAroundReference ? [{ id: "all-around", label: "全能参考", enabled: totalRefs >= 1, tooltip: "当前模型支持图片/视频/音频多参考，需要先连接素材节点" }] : []),
        { id: "image-to-video", label: "图生视频", enabled: hasSingleImageRef, tooltip: "需要连接 1 张图片节点" },
        ...(videoCapabilities.firstLastFrame ? [{ id: "first-last", label: "首尾帧", enabled: imageRefs.length >= 2, tooltip: "Seedance 首尾帧需要连接 2 个图片节点" }] : []),
        ...(videoCapabilities.imageReference ? [{ id: "image-ref", label: "图片参考", enabled: imageRefs.length >= 1, tooltip: "需要连接图片节点 (1~15个)" }] : []),
    ];

    const updateVideoMode = (value: string) => {
        setActiveVideoTab(value);
        if (node.metadata?.videoMode !== value) onConfigChange(node.id, { videoMode: value });
    };

    useEffect(() => {
        if (mode !== "video") return;
        if (!videoTabs.find((tab) => tab.id === activeVideoTab)) {
            updateVideoMode("text-to-video");
            return;
        }
        if (activeVideoTab === "text-to-video") {
            if (!videoCapabilities.textToVideo && hasSingleImageRef) updateVideoMode("image-to-video");
            else if (videoCapabilities.allAroundReference && videoRefs.length > 0) updateVideoMode("all-around");
            else if (videoCapabilities.firstLastFrame && imageRefs.length >= 2) updateVideoMode("first-last");
            else if (hasSingleImageRef) updateVideoMode("image-to-video");
        } else if (!videoTabs.find((tab) => tab.id === activeVideoTab)?.enabled) {
            updateVideoMode(videoCapabilities.textToVideo ? "text-to-video" : "image-to-video");
        }
    }, [activeVideoTab, imageRefs.length, mode, videoCapabilities.allAroundReference, videoCapabilities.firstLastFrame, videoCapabilities.textToVideo, videoRefs.length]);

    useEffect(() => {
        if (mode !== "video") return;
        setActiveVideoTab(node.metadata?.videoMode || "text-to-video");
    }, [mode, node.id, node.metadata?.videoMode]);

    useEffect(() => {
        if (mode !== "video") return;
        const nextMovement = prompt.match(/\[运镜：([^\]]+)\]/)?.[1] || "自适应";
        setCameraMovement(nextMovement);
        if (node.metadata?.cameraMovement !== nextMovement) onConfigChange(node.id, { cameraMovement: nextMovement });
    }, [mode, node.id, node.metadata?.cameraMovement, prompt]);

    const handleCameraSelect = (movement: string) => {
        setCameraMovement(movement);
        let newPrompt = prompt;
        newPrompt = newPrompt.replace(/\s*\[运镜：[^\]]+\]/g, "");
        if (movement !== "自适应") {
            newPrompt = `${newPrompt.trim()} [运镜：${movement}]`;
        }
        onConfigChange(node.id, { cameraMovement: movement });
        updatePrompt(newPrompt);
    };

    const cameraMovements = ["自适应", "推", "拉", "左移", "右移", "向上", "向下", "旋转", "环绕"];
    const cameraMenu = {
        items: cameraMovements.map((movement) => ({
            key: movement,
            label: movement,
            onClick: () => handleCameraSelect(movement),
        })),
    };

    const pills = [
        { label: "标记", tooltip: "即将推出：精细化区域和运动轨迹标记功能" },
        { label: "特效", tooltip: "即将推出：自定义画面特效与粒子效果功能" },
        { label: "角色库", tooltip: "即将推出：基于角色节点锁定视频人物形象" },
        { label: "+ 参考", isRef: true, tooltip: "提示：在画布上将图片/视频节点连线至本视频节点，即可自动添加为参考素材！" },
    ];

    const handlePillClick = (pill: typeof pills[0]) => {
        if (pill.isRef) {
            message.info("在画布上拉出连线，将任何图片或视频节点连接到本视频节点上，它们就会自动作为生成参考素材。您也可以在输入框中输入 @ 来引用素材。");
        } else {
            message.info(pill.tooltip);
        }
    };

    useEffect(() => {
        setPrompt(node.metadata?.prompt || "");
    }, [node.id, node.metadata?.prompt]);

    const updatePrompt = (value: string) => {
        setPrompt(value);
        onPromptChange(node.id, value);
    };

    const submit = () => {
        const text = prompt.trim();
        if (!text || isRunning) return;
        onGenerate(node.id, mode, text);
    };

    const handleOptimizePrompt = () => {
        if (!prompt.trim()) {
            message.warning("请输入提示词后再进行优化");
            return;
        }
        const enrichments = [
            "cinematic lighting, ultra-detailed, 8k resolution, masterpiece, trending on artstation",
            "photorealistic, dramatic volumetric lighting, highly detailed textures, depth of field",
            "concept art style, stunning visual effects, vivid color grading, intricate details",
        ];
        const randomEnrich = enrichments[Math.floor(Math.random() * enrichments.length)];
        updatePrompt(`${prompt.trim()}, ${randomEnrich}`);
        message.success("已智能优化提示词");
    };

    const handleAppendMention = () => {
        const input = promptInputRef.current;
        const start = input?.selectionStart ?? prompt.length;
        const end = input?.selectionEnd ?? start;
        const prefix = start > 0 && !/\s/.test(prompt[start - 1] || "") ? " " : "";
        const nextPrompt = `${prompt.slice(0, start)}${prefix}@${prompt.slice(end)}`;
        const nextCursor = start + prefix.length + 1;
        updatePrompt(nextPrompt);
        setTimeout(() => {
            if (input) {
                input.focus();
                input.setSelectionRange(nextCursor, nextCursor);
            }
            setMentionTriggerKey((value) => value + 1);
        }, 50);
    };

    return (
        <div
            data-canvas-no-pan
            className="rounded-[24px] border p-4 shadow-[0_16px_48px_-8px_rgba(0,0,0,0.08),0_4px_12px_-4px_rgba(0,0,0,0.02)] transition-shadow duration-200"
            style={{
                background: themeKey === "light" ? "#ffffff" : theme.toolbar.panel,
                borderColor: themeKey === "light" ? "#f2f0ea" : theme.toolbar.border,
                color: theme.node.text
            }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
        >
            {mode === "video" && (
                <div className="no-scrollbar mb-3 flex items-center gap-1.5 overflow-x-auto border-b pb-2" style={{ borderColor: themeKey === "light" ? "#f2f0ea" : theme.toolbar.border }}>
                    {videoTabs.map((tab) => {
                        const isActive = activeVideoTab === tab.id;
                        const btn = (
                            <button
                                key={tab.id}
                                type="button"
                                disabled={!tab.enabled}
                                onClick={() => updateVideoMode(tab.id)}
                                className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-normal transition-all disabled:cursor-not-allowed"
                                style={{
                                    background: isActive ? theme.toolbar.activeBg : "transparent",
                                    color: isActive ? theme.toolbar.activeText : tab.enabled ? theme.node.text : theme.node.placeholder,
                                    opacity: isActive ? 1 : tab.enabled ? 0.68 : 0.35,
                                }}
                            >
                                {tab.label}
                            </button>
                        );
                        return tab.enabled ? (
                            btn
                        ) : (
                            <Tooltip key={tab.id} title={tab.tooltip} placement="top" classNames={{ root: "z-[1300]" }}>
                                <span>{btn}</span>
                            </Tooltip>
                        );
                    })}
                </div>
            )}

            <div className="relative flex flex-col bg-transparent transition-all">
                {mode === "video" && (
                    <div className="no-scrollbar z-10 flex select-none items-center gap-1.5 overflow-x-auto pb-2 pt-1">
                        {pills.map((pill) => (
                            <button
                                key={pill.label}
                                type="button"
                                onClick={() => handlePillClick(pill)}
                                className="mr-1 rounded-md border px-2 py-0.5 text-[11px] font-normal transition hover:opacity-100"
                                style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.muted, opacity: 0.78 }}
                            >
                                {pill.label}
                            </button>
                        ))}
                        {activeRefs.map((ref) => {
                            const isImage = ref.kind === "image";
                            const isVideo = ref.kind === "video";
                            return (
                                <Tooltip key={ref.id} title={`${ref.title} (点击断开连接)`} placement="top" classNames={{ root: "z-[1300]" }}>
                                    <div
                                        onClick={() => onRemoveReference?.(ref.nodeId)}
                                        className="group/thumb relative flex size-9 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-gray-200/60 shadow-sm transition-all hover:scale-105 hover:border-red-500/50 dark:border-zinc-700"
                                        style={{ background: theme.node.fill }}
                                    >
                                        {isImage && ref.previewUrl ? (
                                            <img src={ref.previewUrl} className="h-full w-full object-cover" alt="" />
                                        ) : isVideo && ref.previewUrl ? (
                                            <video src={ref.previewUrl} className="h-full w-full object-cover" muted />
                                        ) : ref.kind === "audio" ? (
                                            <Music2 className="size-4 text-gray-500/70 dark:text-zinc-300/80" />
                                        ) : (
                                            <div className="select-none text-[10px] font-bold text-gray-500/60">TXT</div>
                                        )}
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover/thumb:opacity-100">
                                            <span className="text-[12px] text-white font-bold">×</span>
                                        </div>
                                    </div>
                                </Tooltip>
                            );
                        })}
                    </div>
                )}
                <CanvasResourceMentionTextarea
                    ref={promptInputRef}
                    value={prompt}
                    references={mentionReferences}
                    onChange={updatePrompt}
                    onSubmit={submit}
                    className={`thin-scrollbar w-full resize-none border-0 bg-transparent px-0 py-1 text-sm leading-5 outline-none focus:ring-0 ${mode === "video" ? "min-h-28 max-h-44" : "h-20"}`}
                    style={{ color: theme.node.text }}
                    placeholder={promptPlaceholder(mode, hasImageContent, hasTextContent, mentionReferences.length > 0)}
                    mentionTriggerKey={mentionTriggerKey}
                />
            </div>

            <div className="mt-3 flex min-w-0 items-center justify-between gap-3 border-t pt-3" style={{ borderColor: themeKey === "light" ? "#f2f0ea" : theme.toolbar.border }}>
                <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap">
                    {/* flat + 按钮 */}
                    <Tooltip title="提示词库">
                        <button
                            type="button"
                            onClick={() => setPromptLibraryOpen(true)}
                            className="flex size-7 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                        >
                            <Plus className="size-4.5" />
                        </button>
                    </Tooltip>

                    {/* flat 引用 @ 按钮 */}
                    <Tooltip title="引用素材 (@)">
                        <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={handleAppendMention}
                            className="flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                        >
                            @
                        </button>
                    </Tooltip>

                    {/* flat 风格按钮 (仅 image) */}
                    {mode === "image" && (
                        <button
                            type="button"
                            onClick={() => message.info("风格库即将推出")}
                            className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-gray-200/60 bg-transparent px-2.5 text-[11px] text-gray-600 hover:bg-gray-100 transition-colors dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        >
                            <Palette className="size-3" />
                            <span>风格</span>
                            <ChevronDown className="size-3 opacity-60" />
                        </button>
                    )}

                    {mode === "image" ? (
                        <>
                            <ModelPicker
                                config={config}
                                value={config.model}
                                onChange={(model) => onConfigChange(node.id, { model })}
                                capability="image"
                                className="!h-7 !border-gray-200/60 !bg-transparent !px-2.5 !text-[11px] !shadow-none !text-gray-700 hover:!bg-gray-50 dark:!border-zinc-700 dark:!text-zinc-300 dark:hover:!bg-zinc-800"
                                onMissingConfig={() => openConfigDialog(true)}
                            />
                            <CanvasImageSettingsPopover
                                config={config}
                                placement="topLeft"
                                onConfigChange={(key, value) => onConfigChange(node.id, key === "count" ? { count: Number(value) || 1 } : { [key]: value })}
                                onMissingConfig={() => openConfigDialog(true)}
                                onOpenChange={onImageSettingsOpenChange}
                            />
                        </>
                    ) : mode === "video" ? (
                        <>
                            <ModelPicker
                                config={config}
                                value={config.model}
                                onChange={(model) => onConfigChange(node.id, { model })}
                                capability="video"
                                className="!h-7 !max-w-[165px] shrink-0 !border-gray-200/60 !bg-transparent !px-2.5 !text-[11px] !shadow-none !text-gray-700 hover:!bg-gray-50 dark:!border-zinc-700 dark:!text-zinc-300 dark:hover:!bg-zinc-800"
                                onMissingConfig={() => openConfigDialog(true)}
                            />
                            <CanvasVideoSettingsPopover
                                config={config}
                                onConfigChange={(key, value) => onConfigChange(node.id, videoConfigPatch(key, value))}
                            />
                            <Dropdown menu={cameraMenu} placement="topLeft" trigger={["click"]} classNames={{ root: "z-[1300]" }}>
                                <button
                                    type="button"
                                    className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-gray-200/60 bg-transparent px-2.5 text-[11px] text-gray-700 hover:bg-gray-50 transition-colors dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                >
                                    <Camera className="size-3 text-gray-400" />
                                    <span>运镜{cameraMovement !== "自适应" ? `: ${cameraMovement}` : ""}</span>
                                    <ChevronDown className="size-3 opacity-60" />
                                </button>
                            </Dropdown>
                        </>
                    ) : mode === "audio" ? (
                        <>
                            <ModelPicker 
                                config={config} 
                                value={config.model} 
                                onChange={(model) => onConfigChange(node.id, { model })} 
                                capability="audio" 
                                className="!h-7 !border-gray-200/60 !bg-transparent !px-2.5 !text-[11px] !shadow-none !text-gray-700 hover:!bg-gray-50 dark:!border-zinc-700 dark:!text-zinc-300 dark:hover:!bg-zinc-800"
                                onMissingConfig={() => openConfigDialog(true)} 
                            />
                            <CanvasAudioSettingsPopover 
                                config={config} 
                                buttonClassName="!h-7 !border-gray-200/60 !bg-transparent !px-2.5 !text-[11px] !shadow-none !text-gray-700 hover:!bg-gray-50 dark:!border-zinc-700 dark:!text-zinc-300 dark:hover:!bg-zinc-800" 
                                onConfigChange={(key, value) => onConfigChange(node.id, audioConfigPatch(key, value))} 
                            />
                        </>
                    ) : (
                        <ModelPicker 
                            config={config} 
                            value={config.model} 
                            onChange={(model) => onConfigChange(node.id, { model })} 
                            capability="text" 
                            className="!h-7 !border-gray-200/60 !bg-transparent !px-2.5 !text-[11px] !shadow-none !text-gray-700 hover:!bg-gray-50 dark:!border-zinc-700 dark:!text-zinc-300 dark:hover:!bg-zinc-800"
                            onMissingConfig={() => openConfigDialog(true)} 
                        />
                    )}
                </div>
                <div className="flex items-center gap-2.5 shrink-0 select-none">
                    <Tooltip title="一键智能优化提示词">
                        <button
                            type="button"
                            onClick={handleOptimizePrompt}
                            className="flex size-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-violet-500 transition-colors dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-violet-400"
                        >
                            <Wand2 className="size-4" />
                        </button>
                    </Tooltip>
                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums text-violet-500 dark:text-violet-400">
                        ✦ {credits}
                    </span>
                    <Button
                        type="primary"
                        className="!h-8 !w-8 shrink-0 !rounded-full !p-0 flex items-center justify-center bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 border-none transition-all shadow-md active:scale-95 disabled:!bg-gray-100 disabled:!text-gray-300 dark:disabled:!bg-zinc-800 dark:disabled:!text-zinc-600"
                        danger={isRunning}
                        disabled={!isRunning && !prompt.trim()}
                        onClick={() => (isRunning ? onStop(node.id) : submit())}
                        aria-label={isRunning ? "停止生成" : "生成"}
                    >
                        {isRunning ? (
                            <LoaderCircle className="size-4 animate-spin text-white" />
                        ) : (
                            <ArrowUp className="size-4 text-white" />
                        )}
                    </Button>
                </div>
            </div>
            <PromptSelectDialog open={promptLibraryOpen} onOpenChange={setPromptLibraryOpen} onSelect={updatePrompt} />
        </div>
    );
}

function defaultMode(type: CanvasNodeData["type"]): CanvasNodeGenerationMode {
    return type === CanvasNodeType.Text ? "text" : type === CanvasNodeType.Video ? "video" : type === CanvasNodeType.Audio ? "audio" : "image";
}

function buildNodeConfig(globalConfig: AiConfig, node: CanvasNodeData, mode: CanvasNodeGenerationMode): AiConfig {
    const defaultModel = mode === "image" ? globalConfig.imageModel : mode === "video" ? globalConfig.videoModel : mode === "audio" ? globalConfig.audioModel : globalConfig.textModel;
    const nextConfig = {
        ...globalConfig,
        model: node.metadata?.model || defaultModel || (mode === "audio" ? defaultConfig.audioModel : globalConfig.model || defaultConfig.model),
        quality: node.metadata?.quality || globalConfig.quality || defaultConfig.quality,
        size: node.metadata?.size || globalConfig.size || defaultConfig.size,
        videoSeconds: node.metadata?.seconds || globalConfig.videoSeconds || defaultConfig.videoSeconds,
        vquality: node.metadata?.vquality || globalConfig.vquality || defaultConfig.vquality,
        videoGenerateAudio: node.metadata?.generateAudio || globalConfig.videoGenerateAudio || defaultConfig.videoGenerateAudio,
        videoWatermark: node.metadata?.watermark || globalConfig.videoWatermark || defaultConfig.videoWatermark,
        audioVoice: node.metadata?.audioVoice || globalConfig.audioVoice || defaultConfig.audioVoice,
        audioFormat: node.metadata?.audioFormat || globalConfig.audioFormat || defaultConfig.audioFormat,
        audioSpeed: node.metadata?.audioSpeed || globalConfig.audioSpeed || defaultConfig.audioSpeed,
        audioInstructions: node.metadata?.audioInstructions || globalConfig.audioInstructions || defaultConfig.audioInstructions,
        count: String(node.metadata?.count || (mode === "image" ? globalConfig.canvasImageCount || globalConfig.count : globalConfig.count) || defaultConfig.count),
    };
    if (mode === "image" && isStepImageEdit2Config(nextConfig)) {
        return {
            ...nextConfig,
            size: normalizeStepImageEdit2Size(nextConfig.size),
        };
    }
    return nextConfig;
}

function promptPlaceholder(mode: CanvasNodeGenerationMode, hasImageContent: boolean, hasTextContent: boolean, hasReferences = false) {
    const hint = hasReferences ? "，按 @ 引用连接的图片、视频或音频" : "";
    if (mode === "video") return `描述要生成的视频内容${hint}`;
    if (mode === "audio") return `描述要生成的音频内容${hint}`;
    if (mode === "image") return hasImageContent ? `请输入你想要把这张图修改成什么${hint}` : `描述要生成的图片内容${hint}`;
    return hasTextContent ? `请输入你想要将本段文本修改成什么${hint}` : `请输入你想要生成的文本内容${hint}`;
}

function videoConfigPatch(key: keyof AiConfig, value: string) {
    if (key === "videoSeconds") return { seconds: value };
    if (key === "videoGenerateAudio") return { generateAudio: value };
    if (key === "videoWatermark") return { watermark: value };
    return { [key]: value };
}

function audioConfigPatch(key: CanvasAudioSettingKey, value: string) {
    if (key === "audioVoice") return { audioVoice: value };
    if (key === "audioFormat") return { audioFormat: value };
    if (key === "audioSpeed") return { audioSpeed: value };
    return { audioInstructions: value };
}
