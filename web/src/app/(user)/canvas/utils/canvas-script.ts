import { nanoid } from "nanoid";

import type { CanvasScriptMode, CanvasScriptScene } from "../types";

export type CanvasInputSummary = {
    textCount: number;
    imageCount: number;
    videoCount: number;
    audioCount: number;
};

export function getInputSummary(inputs: Array<{ type: "text" | "image" | "video" | "audio" }>): CanvasInputSummary {
    return {
        textCount: inputs.filter((input) => input.type === "text").length,
        imageCount: inputs.filter((input) => input.type === "image").length,
        videoCount: inputs.filter((input) => input.type === "video").length,
        audioCount: inputs.filter((input) => input.type === "audio").length,
    };
}

export function buildScriptGeneratorPrompt(userPrompt: string, mode: CanvasScriptMode, summary: CanvasInputSummary) {
    const modeGuide =
        mode === "image-copy"
            ? "当前模式：参考图文案分析。请优先分析上游图片的主体、卖点、风格、构图、可转化的广告文案和适合复刻的视觉元素，再生成可用于批量生图的镜头提示词。"
            : mode === "image-video"
              ? "当前模式：图文转视频脚本。请优先分析上游图片/文本，把静态画面扩展为有动作、有镜头调度、有节奏的短视频分镜。"
              : "当前模式：主题分镜。请根据用户主题和上游文本，生成完整短视频分镜。";
    const referenceGuide = summary.imageCount
        ? `上游参考包含 ${summary.imageCount} 张图片。必须先做画面文案分析，并让每个 imagePrompt 延续参考图的主体、风格、构图或品牌语气。`
        : "如果没有上游图片，请按用户主题自行设计视觉风格。";

    return `你是短视频分镜脚本生成器。请根据用户需求和上游参考内容，生成适合批量生图和生视频的结构化分镜。

只输出 JSON，不要输出 markdown，不要解释。JSON 格式必须是：
{
  "analysis": "如果有参考图片或上游文本，先用 100 字以内总结画面主体、卖点、文案方向、视觉风格和可延展的视频节奏；没有参考内容时总结创作策略",
  "scenes": [
    {
      "title": "镜头标题",
      "visual": "画面描述，中文",
      "imagePrompt": "可直接用于 AI 生图的中文提示词，包含主体、场景、构图、光线、风格和细节",
      "videoPrompt": "可直接用于图生视频/文生视频的中文提示词，包含动作、镜头运动和氛围",
      "camera": "自适应/推/拉/左移/右移/向上/向下/旋转/环绕",
      "duration": "5",
      "ratio": "9:16"
    }
  ]
}

要求：
1. ${modeGuide}
2. ${referenceGuide}
3. 默认生成 8 个镜头，除非用户明确要求其他数量。
4. 每个镜头必须能独立生成图片，再用图片作为参考生成视频。
5. imagePrompt 要包含主体、场景、构图、光线、风格、材质、细节和可执行的中文文案方向。
6. videoPrompt 要包含动作、镜头运动、节奏、情绪和转场建议。
7. imagePrompt 和 videoPrompt 不要为空，不要写“同上”。
8. ratio 只能使用 1:1、16:9、9:16、4:3、3:4。
9. duration 使用 3 到 15 的秒数字符串。

上游输入摘要：文本 ${summary.textCount} 个，图片 ${summary.imageCount} 张，视频 ${summary.videoCount} 个，音频 ${summary.audioCount} 个。

用户需求：
${userPrompt}`;
}

export function defaultScriptPrompt(mode: CanvasScriptMode, summary: CanvasInputSummary) {
    if (summary.imageCount && mode === "image-copy") return "分析参考图片的主体、卖点、画面风格和可用于批量生图的广告文案方向。";
    if (summary.imageCount && mode === "image-video") return "基于参考图片做画面文案分析，并扩展为适合图生视频的短视频分镜脚本。";
    if (summary.imageCount) return "基于参考图片生成短视频分镜脚本。";
    return "";
}

export function parseScriptResult(value: string): { analysis: string; scenes: CanvasScriptScene[] } {
    const parsed = parseJsonObject(value);
    return {
        analysis: stringField(parsed?.analysis).slice(0, 260),
        scenes: parseScriptScenes(parsed),
    };
}

function parseScriptScenes(parsed: any): CanvasScriptScene[] {
    const rawScenes = Array.isArray(parsed?.scenes) ? parsed.scenes : Array.isArray(parsed) ? parsed : [];
    return rawScenes
        .map((item: unknown, index: number) => normalizeScriptScene(item, index))
        .filter((scene: CanvasScriptScene | null): scene is CanvasScriptScene => Boolean(scene?.imagePrompt && scene.videoPrompt))
        .slice(0, 30);
}

function parseJsonObject(value: string): any {
    const text = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    try {
        return JSON.parse(text);
    } catch {
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(text.slice(start, end + 1));
            } catch {
                return null;
            }
        }
        const arrayStart = text.indexOf("[");
        const arrayEnd = text.lastIndexOf("]");
        if (arrayStart >= 0 && arrayEnd > arrayStart) {
            try {
                return JSON.parse(text.slice(arrayStart, arrayEnd + 1));
            } catch {
                return null;
            }
        }
        return null;
    }
}

function normalizeScriptScene(value: any, index: number): CanvasScriptScene | null {
    if (!value || typeof value !== "object") return null;
    const title = stringField(value.title) || `镜头 ${index + 1}`;
    const visual = stringField(value.visual) || stringField(value.description) || stringField(value.scene);
    const imagePrompt = stringField(value.imagePrompt) || stringField(value.image_prompt) || visual;
    const videoPrompt = stringField(value.videoPrompt) || stringField(value.video_prompt) || visual;
    return {
        id: stringField(value.id) || nanoid(),
        title,
        visual,
        imagePrompt,
        videoPrompt,
        camera: normalizeScriptCamera(stringField(value.camera)),
        duration: normalizeScriptDuration(stringField(value.duration)),
        ratio: normalizeScriptRatio(stringField(value.ratio) || stringField(value.aspectRatio) || stringField(value.aspect_ratio)),
    };
}

function stringField(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeScriptCamera(value: string) {
    return ["推", "拉", "左移", "右移", "向上", "向下", "旋转", "环绕"].includes(value) ? value : "自适应";
}

function normalizeScriptDuration(value: string) {
    const seconds = Math.floor(Number(value) || 5);
    return String(Math.max(3, Math.min(15, seconds)));
}

function normalizeScriptRatio(value: string) {
    return ["1:1", "16:9", "9:16", "4:3", "3:4"].includes(value) ? value : "9:16";
}

export function formatScriptScenes(scenes: CanvasScriptScene[], analysis?: string) {
    const body = scenes.map((scene, index) => formatSceneText(scene, index)).join("\n\n");
    return analysis ? `文案分析：${analysis}\n\n${body}` : body;
}

export function formatSceneText(scene: CanvasScriptScene, index: number) {
    return `第 ${index + 1} 镜：${scene.title}
画面：${scene.visual}
图片提示词：${scene.imagePrompt}
视频提示词：${scene.videoPrompt}
参数：${scene.ratio || "9:16"} · ${scene.duration || "5"}s · ${scene.camera || "自适应"}`;
}

export function withCameraPrompt(prompt: string, camera?: string) {
    const movement = camera && camera !== "自适应" ? camera : "";
    return movement && !prompt.includes("[运镜：") ? `${prompt.trim()} [运镜：${movement}]` : prompt;
}
