/**
 * Toonflow 772.ee 多模态模型供应商适配
 * @version 2.1
 *
 * 772 的新旧协议由模型 ID 区分，不能按 Base URL 区分：
 * - 普通旧模型：duration / ratio / referenceImages
 * - 旧分组 MiniMax H3：seconds / ratio / metadata.content（文档规定的特殊格式）
 * - 新模型：seconds / aspect_ratio / images / videos / audios
 * - 文本：DeepSeek / OpenAI 兼容 chat 适配器；图片：gpt-image-2 generations / edits
 */

// ============================================================
// Toonflow 类型契约
// ============================================================

type VideoMode =
  | "singleImage"
  | "startEndRequired"
  | "endFrameOptional"
  | "startFrameOptional"
  | "text"
  | (`videoReference:${number}` | `imageReference:${number}` | `audioReference:${number}`)[];

interface TextModel {
  name: string;
  modelName: string;
  type: "text";
  think: boolean;
}

interface ImageModel {
  name: string;
  modelName: string;
  type: "image";
  mode: ("text" | "singleImage" | "multiReference")[];
  associationSkills?: string;
}

interface VideoModel {
  name: string;
  modelName: string;
  type: "video";
  mode: VideoMode[];
  associationSkills?: string;
  audio: "optional" | false | true;
  durationResolutionMap: { duration: number[]; resolution: string[] }[];
}

interface VendorConfig {
  id: string;
  version: string;
  name: string;
  author: string;
  description?: string;
  icon?: string;
  inputs: { key: string; label: string; type: "text" | "password" | "url"; required: boolean; placeholder?: string }[];
  inputValues: Record<string, string>;
  models: (TextModel | ImageModel | VideoModel)[];
}

type ReferenceList =
  | { type: "image"; sourceType: "base64"; base64: string }
  | { type: "audio"; sourceType: "base64"; base64: string }
  | { type: "video"; sourceType: "base64"; base64: string };

interface VideoConfig {
  duration: number;
  resolution: string;
  aspectRatio: "16:9" | "9:16";
  prompt: string;
  referenceList?: ReferenceList[];
  audio?: boolean;
  mode: VideoMode[];
}

interface ImageConfig {
  prompt: string;
  referenceList?: Extract<ReferenceList, { type: "image" }>[];
  size: "1K" | "2K" | "4K";
  aspectRatio: `${number}:${number}`;
}

interface PollResult {
  completed: boolean;
  data?: string;
  error?: string;
}

declare const logger: (msg: string) => void;
declare const createOpenAI: any;
declare const createDeepSeek: any;
declare const pollTask: (fn: () => Promise<PollResult>, interval?: number, timeout?: number) => Promise<PollResult>;
declare const urlToBase64: (url: string) => Promise<string>;
declare const exports: {
  vendor: VendorConfig;
  textRequest: (m: TextModel, t: boolean, tl: 0 | 1 | 2 | 3) => any;
  imageRequest: (c: ImageConfig, m: ImageModel) => Promise<string>;
  videoRequest: (c: VideoConfig, m: VideoModel) => Promise<string>;
  ttsRequest: (...args: any[]) => any;
};

// ============================================================
// 供应商配置
// ============================================================

const vendor: VendorConfig = {
  id: "toonflow-772-video",
  version: "2.1",
  author: "Tellin",
  name: "772.ee 多模态模型",
  description:
    "通过 772.ee 调用视频、文本和图片模型。视频协议按模型 ID 自动选择，Base URL 可使用 https://us.772.ee 或 https://ai.772.ee。API Key 只在 Toonflow 配置界面填写。",
  icon: "",
  inputs: [
    { key: "apiKey", label: "通用 API 密钥", type: "password", required: false, placeholder: "sk-...（可选）" },
    { key: "legacyApiKey", label: "旧分组 API 密钥", type: "password", required: false, placeholder: "旧模型使用" },
    { key: "unifiedApiKey", label: "新分组 API 密钥", type: "password", required: false, placeholder: "seedance2.* / minimax-h3-768p-* 使用" },
    { key: "baseUrl", label: "API 地址", type: "url", required: false, placeholder: "https://us.772.ee" },
  ],
  inputValues: {
    apiKey: "",
    legacyApiKey: "",
    unifiedApiKey: "",
    // 按文档只填写域名，代码会自动补上 /v1。
    baseUrl: "https://us.772.ee",
  },
  models: [
    // 文本模型：DeepSeek 使用专用适配器，GPT 使用 OpenAI 兼容适配器。
    { name: "DeepSeek V4 Flash", modelName: "deepseek-v4-flash", type: "text", think: true },
    { name: "DeepSeek V4 Pro", modelName: "deepseek-v4-pro", type: "text", think: true },
    { name: "GPT-5.6 Sol", modelName: "gpt-5.6-sol", type: "text", think: false },
    { name: "GPT-5.6 Terra", modelName: "gpt-5.6-terra", type: "text", think: false },
    {
      name: "GPT Image 2",
      modelName: "gpt-image-2",
      type: "image",
      mode: ["text", "singleImage", "multiReference"],
    },

    // 旧分组普通模型：duration / ratio / referenceImages 旧协议；旧 H3 在下方使用文档规定的 metadata.content。
    {
      name: "772 旧版 Standard",
      modelName: "videos-standard",
      type: "video",
      mode: ["text", "singleImage", ["imageReference:9", "videoReference:3", "audioReference:3"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["480p", "720p"] }],
    },
    {
      name: "772 旧版 Fast",
      modelName: "videos-fast",
      type: "video",
      mode: ["text", "singleImage", ["imageReference:9", "videoReference:3", "audioReference:3"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["480p", "720p"] }],
    },
    {
      name: "772 旧版 Mini",
      modelName: "videos-mini",
      type: "video",
      mode: ["text", "singleImage", ["imageReference:9", "videoReference:3", "audioReference:3"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["480p", "720p"] }],
    },
    {
      name: "SD 2.0 720p（旧分组）",
      modelName: "sd-2.0-720p",
      type: "video",
      mode: ["text", "singleImage", ["imageReference:9", "videoReference:3", "audioReference:3"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["720p"] }],
    },
    {
      name: "SD 2.0 1080p（旧分组）",
      modelName: "sd-2.0-1080p",
      type: "video",
      mode: ["text", "singleImage", ["imageReference:9", "videoReference:3", "audioReference:3"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["1080p"] }],
    },
    {
      name: "SD 2.0 4K（旧分组）",
      modelName: "sd-2.0-4k",
      type: "video",
      mode: ["text", "singleImage", ["imageReference:9", "videoReference:3", "audioReference:3"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["4k"] }],
    },
    {
      name: "Seedance 2.5（旧分组）",
      modelName: "seedance-2-5",
      type: "video",
      mode: ["text", "singleImage", ["imageReference:9", "videoReference:3", "audioReference:3"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["480p", "720p", "1080p"] }],
    },
    {
      name: "MiniMax H3（旧分组）",
      modelName: "minimax-h3-f",
      type: "video",
      mode: ["text", "singleImage", "startEndRequired", ["imageReference:9", "videoReference:3", "audioReference:3"]],
      audio: true,
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["768P", "2K"] }],
    },
    {
      name: "MiniMax H3 768p（旧分组）",
      modelName: "minimax-h3-f-768p",
      type: "video",
      mode: ["text", "singleImage", "startEndRequired", ["imageReference:9", "videoReference:3", "audioReference:3"]],
      audio: true,
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["768P"] }],
    },
    {
      name: "MiniMax H3 1080p（旧分组）",
      modelName: "minimax-h3-f-1080p",
      type: "video",
      mode: ["text", "singleImage", "startEndRequired", ["imageReference:9", "videoReference:3", "audioReference:3"]],
      audio: true,
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["2K"] }],
    },
    {
      name: "Wan 3.0（旧分组）",
      modelName: "alibaba/wan-3.0",
      type: "video",
      mode: ["text", "singleImage", ["imageReference:9", "videoReference:3", "audioReference:3"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["480p", "720p"] }],
    },

    // 新分组模型：seconds / aspect_ratio / images、videos、audios 新协议。
    {
      name: "Seedance 2.0",
      modelName: "seedance2.0-900-1",
      type: "video",
      mode: ["text", "singleImage", "startFrameOptional", ["imageReference:30", "videoReference:10", "audioReference:10"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["480p", "720p"] }],
    },
    {
      name: "Seedance 2.0 900-1",
      modelName: "seedance-2.0-900-1",
      type: "video",
      mode: ["text", "singleImage", "startFrameOptional", ["imageReference:30", "videoReference:10", "audioReference:10"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["480p", "720p"] }],
    },
    {
      name: "Seedance 2.0 900-3",
      modelName: "seedance-2.0-900-3",
      type: "video",
      mode: ["text", "singleImage", "startFrameOptional", ["imageReference:30", "videoReference:10", "audioReference:10"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["480p", "720p"] }],
    },
    {
      name: "Seedance 2.0 900-3",
      modelName: "seedance2.0-900-3",
      type: "video",
      mode: ["text", "singleImage", "startFrameOptional", ["imageReference:30", "videoReference:10", "audioReference:10"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["480p", "720p"] }],
    },
    {
      name: "Seedance 2.0 SVIP",
      modelName: "seedance2.0-svip-900-720p",
      type: "video",
      mode: ["text", "singleImage", "startFrameOptional", ["imageReference:30", "videoReference:10", "audioReference:10"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["720p"] }],
    },
    {
      name: "Seedance 2.5 720p",
      modelName: "seedance2.5-720p",
      type: "video",
      mode: ["text", "singleImage", "startFrameOptional", ["imageReference:30", "videoReference:10", "audioReference:10"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30], resolution: ["720p"] }],
    },
    {
      name: "Seedance 2.5 480p",
      modelName: "seedance2.5-480p",
      type: "video",
      mode: ["text", "singleImage", "startFrameOptional", ["imageReference:30", "videoReference:10", "audioReference:10"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30], resolution: ["480p"] }],
    },
    {
      name: "Seedance 2.5 900",
      modelName: "seedance2.5-900",
      type: "video",
      mode: ["text", "singleImage", "startFrameOptional", ["imageReference:30", "videoReference:10", "audioReference:10"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30], resolution: ["720p", "1080p"] }],
    },
    {
      name: "Seedance 2.5 10图",
      modelName: "seedance2.5-10图",
      type: "video",
      mode: ["text", "singleImage", "startFrameOptional", ["imageReference:30", "videoReference:10", "audioReference:10"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30], resolution: ["480p", "720p", "1080p"] }],
    },
    {
      name: "Seedance 2.5 9图",
      modelName: "seedance2.5-9图",
      type: "video",
      mode: ["text", "singleImage", "startFrameOptional", ["imageReference:30", "videoReference:10", "audioReference:10"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30], resolution: ["480p", "720p", "1080p"] }],
    },
    {
      name: "Seedance 2.5 LEC 480p",
      modelName: "seedance-2.5-lec-480p",
      type: "video",
      mode: ["text", "singleImage", "startFrameOptional", ["imageReference:30", "videoReference:10", "audioReference:10"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["480p"] }],
    },
    {
      name: "Seedance 2.5 LEC 720p",
      modelName: "seedance-2.5-lec-720p",
      type: "video",
      mode: ["text", "singleImage", "startFrameOptional", ["imageReference:30", "videoReference:10", "audioReference:10"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["720p"] }],
    },
    {
      name: "MiniMax H3 768p（新分组）",
      modelName: "minimax-h3-768p",
      type: "video",
      mode: ["text", "singleImage", "startEndRequired", ["imageReference:9", "audioReference:3"]],
      audio: true,
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["768P"] }],
    },
  ],
};

// ============================================================
// 协议和请求工具
// ============================================================

type Protocol = "legacy" | "unified";
type MediaRefs = { images: string[]; videos: string[]; audios: string[] };

const legacyModelPatterns = [
  /^videos-/,
  /^sd-2\.0-/,
  /^seedance-2-5(?:-|$)/,
  /^minimax-h3-f(?:-|$)/,
  /^alibaba\/wan-3\.0(?:-|$)/,
];

const unifiedModelPatterns = [
  /^seedance2\.(?:0|5)(?:-|$)/,
  /^seedance-2\.0-/,
  /^seedance-2\.5-lec-/,
  /^minimax-h3-(?!f(?:-|$))/,
];

function modelId(model: VideoModel) {
  return String(model.modelName || "").trim();
}

function normalizedModel(model: VideoModel | string) {
  return String(typeof model === "string" ? model : model.modelName || "")
    .trim()
    .toLowerCase();
}

function getProtocol(model: VideoModel | string): Protocol {
  const value = normalizedModel(model);
  if (legacyModelPatterns.some((pattern) => pattern.test(value))) return "legacy";
  if (unifiedModelPatterns.some((pattern) => pattern.test(value))) return "unified";
  throw new Error(`未识别的 772 视频模型：${value || "空"}。请先用 GET /v1/models 确认模型 ID。`);
}

function isUnifiedH3(model: VideoModel | string) {
  return getProtocol(model) === "unified" && normalizedModel(model).startsWith("minimax-h3-");
}

function isLegacyH3(model: VideoModel | string) {
  return getProtocol(model) === "legacy" && normalizedModel(model).startsWith("minimax-h3-f");
}

function apiKey(protocol: Protocol) {
  const preferredKey = protocol === "legacy" ? vendor.inputValues.legacyApiKey : vendor.inputValues.unifiedApiKey;
  const value = String(preferredKey || vendor.inputValues.apiKey || "").trim().replace(/^Bearer\s+/i, "");
  if (!value) throw new Error(`缺少${protocol === "legacy" ? "旧分组" : "新分组"} API Key，请在 Toonflow 供应商设置中填写密钥`);
  return value;
}

function genericApiKey() {
  const value = String(vendor.inputValues.apiKey || vendor.inputValues.unifiedApiKey || vendor.inputValues.legacyApiKey || "")
    .trim()
    .replace(/^Bearer\s+/i, "");
  if (!value) throw new Error("缺少 API Key，请在 Toonflow 供应商设置中填写通用、新分组或旧分组密钥");
  return value;
}

function baseUrl() {
  const value = String(vendor.inputValues.baseUrl || "https://us.772.ee").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(value)) throw new Error("API 地址必须是 http:// 或 https:// 地址");
  return value.replace(/\/v1$/i, "");
}

function endpoint(path: string) {
  return `${baseUrl()}/v1${path.startsWith("/") ? path : `/${path}`}`;
}

function authHeaders(protocol: Protocol, contentType?: string) {
  return {
    Authorization: `Bearer ${apiKey(protocol)}`,
    Accept: "application/json",
    ...(contentType ? { "Content-Type": contentType } : {}),
  };
}

function genericHeaders(contentType?: string) {
  return {
    Authorization: `Bearer ${genericApiKey()}`,
    Accept: "application/json",
    ...(contentType ? { "Content-Type": contentType } : {}),
  };
}

async function readResponse(response: Response) {
  const text = await response.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    const message = errorMessage(payload) || text || response.statusText || `HTTP ${response.status}`;
    throw new Error(`HTTP ${response.status}: ${message}`);
  }
  return unwrap(payload);
}

async function postJson(path: string, body: Record<string, any>, protocol: Protocol) {
  const response = await fetch(endpoint(path), {
    method: "POST",
    headers: authHeaders(protocol, "application/json"),
    body: JSON.stringify(body),
  });
  return readResponse(response);
}

async function getJson(path: string, protocol: Protocol) {
  const response = await fetch(endpoint(path), { headers: authHeaders(protocol) });
  return readResponse(response);
}

async function postGenericJson(path: string, body: Record<string, any>) {
  const response = await fetch(endpoint(path), {
    method: "POST",
    headers: genericHeaders("application/json"),
    body: JSON.stringify(body),
  });
  return readResponse(response);
}

async function getGenericJson(path: string) {
  const response = await fetch(endpoint(path), { headers: genericHeaders() });
  return readResponse(response);
}

function unwrap(payload: any): any {
  if (!payload) return payload;
  if (typeof payload === "object" && typeof payload.code === "number") {
    if (payload.code !== 0 && payload.code !== 200) throw new Error(payload.msg || "接口请求失败");
    return payload.data ?? payload;
  }
  if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data) && (payload.data.id || payload.data.task_id || payload.data.status || payload.data.result_url || payload.data.video_url)) return payload.data;
  return payload;
}

function errorMessage(payload: any) {
  if (!payload || typeof payload !== "object") return "";
  return String(
    (typeof payload.error === "string" ? payload.error : payload.error?.message || payload.error?.msg) ||
      payload.fail_reason ||
      payload.message ||
      payload.msg ||
      (typeof payload.data?.error === "string" ? payload.data.error : payload.data?.error?.message || payload.data?.error?.msg) ||
      payload.data?.fail_reason ||
      payload.data?.message ||
      payload.data?.msg ||
      "",
  ).trim();
}

function taskId(payload: any) {
  if (typeof payload === "string") return payload.trim();
  return String(payload?.id || payload?.task_id || payload?.request_id || payload?.data?.id || payload?.data?.task_id || "").trim();
}

function taskStatus(payload: any) {
  return String(payload?.status || payload?.state || payload?.task_status || payload?.data?.status || "").trim().toLowerCase();
}

function videoUrl(payload: any) {
  const candidates = [
    payload?.result_url,
    payload?.video_url,
    payload?.url,
    payload?.metadata?.content_url,
    payload?.metadata?.local_url,
    payload?.data?.result_url,
    payload?.data?.video_url,
    payload?.data?.url,
    payload?.data?.metadata?.content_url,
    payload?.data?.metadata?.local_url,
  ];
  return String(candidates.find((value) => typeof value === "string" && value.trim()) || "").trim();
}

function failedMessage(payload: any) {
  return errorMessage(payload) || String(payload?.fail_reason || payload?.data?.fail_reason || "772 视频生成失败");
}

// ============================================================
// 素材和参数规范化
// ============================================================

function mediaRefs(config: VideoConfig): MediaRefs {
  const list = Array.isArray(config.referenceList) ? config.referenceList : [];
  return {
    images: list.filter((item) => item.type === "image").map((item) => String(item.base64 || "").trim()).filter(Boolean),
    videos: list.filter((item) => item.type === "video").map((item) => String(item.base64 || "").trim()).filter(Boolean),
    audios: list.filter((item) => item.type === "audio").map((item) => String(item.base64 || "").trim()).filter(Boolean),
  };
}

function modeName(mode: unknown) {
  if (typeof mode === "string") return mode;
  if (Array.isArray(mode)) {
    const frame = mode.find((value) => typeof value === "string" && ["startEndRequired", "endFrameOptional", "startFrameOptional"].includes(value));
    if (frame) return frame;
    if (mode.length === 1 && typeof mode[0] === "string" && ["singleImage", "text"].includes(mode[0])) return mode[0];
  }
  return "references";
}

function isFrameMode(mode: VideoConfig["mode"]) {
  const value = modeName(mode);
  return value === "startEndRequired" || value === "endFrameOptional" || value === "startFrameOptional";
}

function normalizeRatio(value: string) {
  return value === "9:16" ? "9:16" : "16:9";
}

function normalizeLegacyDuration(value: number) {
  const seconds = Math.floor(Number(value) || 5);
  return Math.max(4, Math.min(15, seconds));
}

function normalizeUnifiedDuration(value: number, h3: boolean) {
  const seconds = Math.floor(Number(value) || 5);
  return String(Math.max(h3 ? 4 : 1, Math.min(h3 ? 15 : 30, seconds)));
}

function normalizeLegacyResolution(value: string, model: string) {
  const modelValue = normalizedModel(model);
  if (modelValue.endsWith("-4k")) return "4k";
  if (modelValue.endsWith("-1080p")) return "1080p";
  if (modelValue.endsWith("-720p")) return "720p";
  if (modelValue.endsWith("-480p")) return "480p";
  const resolution = String(value || "").trim().toLowerCase();
  return resolution === "4k" || resolution === "1080p" || resolution === "480p" ? resolution : "720p";
}

function normalizeUnifiedResolution(value: string, model = "") {
  const modelValue = normalizedModel(model);
  if (modelValue.startsWith("minimax-h3-768p")) return "768P";
  if (modelValue.startsWith("minimax-h3-1080p")) return "2K";
  if (modelValue.endsWith("-480p")) return "480p";
  if (modelValue.endsWith("-720p")) return "720p";
  if (modelValue.endsWith("-1080p")) return "1080p";
  const resolution = String(value || "").trim();
  if (!resolution || /^(auto|low|medium|high)$/i.test(resolution)) return "";
  return /^\d+$/.test(resolution) ? `${resolution}p` : resolution;
}

function publicUrl(value: string, label: string) {
  if (!/^https?:\/\//i.test(value)) throw new Error(`772 旧模型的${label}必须使用公网 HTTP/HTTPS URL；当前 Toonflow 参考素材是本地 Base64，不能直接提交。`);
  try {
    const url = new URL(value);
    if (["localhost", "127.0.0.1"].includes(url.hostname) || url.hostname.endsWith(".local")) throw new Error("本地地址");
  } catch {
    throw new Error(`772 旧模型的${label}不是可访问的公网 HTTP/HTTPS URL`);
  }
  return value;
}

function dataReference(value: string, label: string) {
  if (/^(?:https?:\/\/|data:)/i.test(value)) return value;
  // 772 新协议也接受裸 Base64；保留原值，避免猜错 MIME 类型。
  if (/^[A-Za-z0-9+\/_=-]+$/.test(value)) return value;
  throw new Error(`读取${label}失败：参考素材不是 URL、Data URI 或 Base64`);
}

function normalizeH3Ratio(value: string) {
  const ratio = String(value || "").trim();
  return /^\d+\s*:\s*\d+$/.test(ratio) ? ratio.replace(/\s+/g, "") : "16:9";
}

function normalizeH3Resolution(value: string, model: string) {
  const modelValue = normalizedModel(model);
  if (modelValue.includes("1080")) return "2K";
  if (modelValue.includes("768")) return "768P";
  const resolution = String(value || "").trim().toLowerCase();
  if (resolution === "2k" || resolution === "1080p") return "2K";
  return "768P";
}

function h3Size(resolution: string, ratio: string) {
  if (resolution !== "768P" || ratio === "adaptive") return undefined;
  return ratio === "9:16" ? "768x1344" : "1344x768";
}

function createLegacyH3Payload(config: VideoConfig, model: string, prompt: string, refs: MediaRefs, frameMode: boolean) {
  if (refs.images.length > 9) throw new Error("MiniMax H3 参考图片最多 9 张");
  if (refs.videos.length > 3) throw new Error("MiniMax H3 参考视频最多 3 个");
  if (refs.audios.length > 3) throw new Error("MiniMax H3 参考音频最多 3 段");
  if (frameMode && refs.videos.length) throw new Error("MiniMax H3 首尾帧不能同时使用参考视频");
  if (frameMode && refs.audios.length) throw new Error("MiniMax H3 首尾帧不能同时使用参考音频");
  if (frameMode && modeName(config.mode) === "startEndRequired" && refs.images.length !== 2) throw new Error("MiniMax H3 首尾帧模式需要恰好 2 张图片");
  if (frameMode && refs.images.length > 2) throw new Error("MiniMax H3 首尾帧模式最多 2 张图片");
  if (frameMode && !refs.images.length && modeName(config.mode) !== "startFrameOptional") throw new Error("MiniMax H3 首尾帧模式至少需要 1 张图片");

  const ratio = frameMode && !refs.images.length ? "adaptive" : normalizeH3Ratio(config.aspectRatio);
  const resolution = normalizeH3Resolution(config.resolution, model);
  const content: Record<string, any>[] = [];
  refs.images.forEach((value, index) => content.push({ type: "image_url", role: frameMode ? (index === 0 ? "first_frame" : "last_frame") : "reference_image", image_url: { url: dataReference(value, "参考图片") } }));
  refs.videos.forEach((value) => content.push({ type: "video_url", role: "reference_video", video_url: { url: dataReference(value, "参考视频") } }));
  refs.audios.forEach((value) => content.push({ type: "audio_url", role: "reference_audio", audio_url: { url: dataReference(value, "参考音频") } }));

  const payload: Record<string, any> = {
    model,
    prompt,
    seconds: normalizeUnifiedDuration(config.duration, true),
    resolution,
    ratio,
    metadata: { ratio, resolution, ...(content.length ? { content } : {}) },
  };
  const size = h3Size(resolution, ratio);
  if (size) payload.size = size;
  return payload;
}

// ============================================================
// 文本和图片请求
// ============================================================

const textRequest = (model: TextModel, think: boolean, thinkLevel: 0 | 1 | 2 | 3) => {
  const apiKeyValue = genericApiKey();
  const modelName = String(model.modelName || "").trim();
  if (!modelName) throw new Error("文本模型 ID 不能为空");

  if (modelName.toLowerCase().includes("deepseek")) {
    const effortMap: Record<0 | 1 | 2 | 3, "high" | "max"> = {
      0: "high",
      1: "high",
      2: "high",
      3: "max",
    };
    const enableThinking = Boolean(model.think && think);
    const extraBody: Record<string, any> = {
      thinking: { type: enableThinking ? "enabled" : "disabled" },
    };
    if (enableThinking) extraBody.reasoning_effort = effortMap[thinkLevel] || "high";
    return createDeepSeek({ baseURL: `${baseUrl()}/v1`, apiKey: apiKeyValue, extraBody }).chat(modelName);
  }

  return createOpenAI({ baseURL: `${baseUrl()}/v1`, apiKey: apiKeyValue }).chat(modelName);
};

const gptImageSizeMap: Record<string, Record<string, string>> = {
  "1k": {
    "1:1": "1024x1024",
    "16:9": "1536x864",
    "9:16": "864x1536",
    "4:3": "1360x1024",
    "3:4": "1024x1360",
    "3:2": "1536x1024",
    "2:3": "1024x1536",
  },
  "2k": {
    "1:1": "2048x2048",
    "16:9": "3072x1728",
    "9:16": "1728x3072",
    "4:3": "2720x2048",
    "3:4": "2048x2720",
    "3:2": "3072x2048",
    "2:3": "2048x3072",
  },
  "4k": {
    "1:1": "2880x2880",
    "16:9": "3840x2160",
    "9:16": "2160x3840",
    "4:3": "3328x2496",
    "3:4": "2496x3328",
    "3:2": "3520x2336",
    "2:3": "2336x3520",
  },
};

function normalizeImageRatio(value: string) {
  const ratio = String(value || "").trim().toLowerCase();
  return gptImageSizeMap["2k"]?.[ratio] ? ratio : "16:9";
}

function resolveGptImageSize(config: ImageConfig) {
  const rawSize = String(config.size || "2K").trim().toLowerCase();
  const size = rawSize === "1k" || rawSize === "4k" ? rawSize : "2k";
  const ratio = normalizeImageRatio(config.aspectRatio);
  return gptImageSizeMap[size][ratio];
}

function imageRows(value: any): Record<string, any>[] {
  if (Array.isArray(value)) return value.flatMap((item) => imageRows(item));
  if (!value || typeof value !== "object") return [];
  const row = value as Record<string, any>;
  const nested = ["data", "images", "output", "result", "image"].flatMap((key) => imageRows(row[key]));
  return [row, ...nested];
}

function imageInlineData(payload: any) {
  for (const row of imageRows(payload)) {
    const encoded = [row.b64_json, row.b64Json, row.base64].find((value) => typeof value === "string" && value.trim());
    if (encoded) {
      const value = encoded.trim();
      return /^data:/i.test(value) ? value : `data:image/jpeg;base64,${value}`;
    }
  }
  return "";
}

function imageUrlValue(payload: any) {
  for (const row of imageRows(payload)) {
    const candidates = [row.url, row.image_url, row.imageUrl, row.output_url, row.outputUrl];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
      if (candidate && typeof candidate === "object" && typeof candidate.url === "string" && candidate.url.trim()) return candidate.url.trim();
    }
  }
  return "";
}

function imageTaskId(payload: any) {
  for (const row of imageRows(payload)) {
    const value = [row.task_id, row.taskId, row.request_id, row.requestId].find((item) => typeof item === "string" && item.trim());
    if (value) return value.trim();
  }
  for (const row of imageRows(payload)) {
    if (row.status && typeof row.id === "string" && row.id.trim()) return row.id.trim();
  }
  return "";
}

function imageTaskStatus(payload: any) {
  for (const row of imageRows(payload)) {
    const value = [row.status, row.state, row.task_status, row.taskStatus].find((item) => typeof item === "string" && item.trim());
    if (value) return value.trim().toLowerCase();
  }
  return "";
}

function imageTaskError(payload: any) {
  return errorMessage(payload) || "图片生成失败";
}

async function imageUrlToDataUrl(value: string) {
  if (/^data:/i.test(value)) return value;
  const resolved = /^https?:\/\//i.test(value) ? value : new URL(value, `${baseUrl()}/`).toString();
  try {
    const parsed = new URL(resolved);
    const sameOrigin = parsed.origin === new URL(baseUrl()).origin;
    const response = await fetch(resolved, { headers: sameOrigin ? { ...genericHeaders(), Accept: "image/*" } : { Accept: "image/*" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    if (!blob.size || /json|html|text/i.test(blob.type || "")) throw new Error("图片内容为空");
    return blobToDataUrl(blob);
  } catch (error) {
    try {
      return await urlToBase64(resolved);
    } catch {
      throw error;
    }
  }
}

async function parseImageResult(payload: any) {
  const inline = imageInlineData(payload);
  if (inline) return inline;
  const url = imageUrlValue(payload);
  if (url) return imageUrlToDataUrl(url);
  throw new Error("图片接口没有返回图片");
}

async function imageReferenceBlob(value: string) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("参考图片内容为空");
  let source = raw;
  if (/^https?:\/\//i.test(raw)) source = await urlToBase64(raw);
  else if (!/^(?:data|blob):/i.test(raw)) source = `data:image/png;base64,${raw.replace(/\s+/g, "")}`;
  const response = await fetch(source);
  if (!response.ok) throw new Error(`读取参考图片失败：HTTP ${response.status}`);
  const blob = await response.blob();
  if (!blob.size) throw new Error("读取参考图片失败：内容为空");
  return blob;
}

function imageFilename(blob: Blob, index: number) {
  const type = String(blob.type || "image/png").toLowerCase();
  const extension = type.includes("jpeg") ? "jpg" : type.includes("webp") ? "webp" : type.includes("gif") ? "gif" : "png";
  return `reference-${index + 1}.${extension}`;
}

async function createImageEditForm(modelName: string, prompt: string, size: string, references: string[], field: string) {
  const formData = new FormData();
  formData.set("model", modelName);
  formData.set("prompt", prompt);
  formData.set("n", "1");
  formData.set("size", size);
  formData.set("quality", "auto");
  formData.set("output_format", "jpeg");
  formData.set("moderation", "auto");
  const blobs = await Promise.all(references.map((value) => imageReferenceBlob(value)));
  blobs.forEach((blob, index) => formData.append(field, blob, imageFilename(blob, index)));
  return formData;
}

async function postImageEdit(modelName: string, prompt: string, size: string, references: string[]) {
  const send = (field: string) =>
    createImageEditForm(modelName, prompt, size, references, field).then((body) =>
      fetch(endpoint("/images/edits"), {
        method: "POST",
        headers: genericHeaders(),
        body,
      }),
    );

  let response = await send("image[]");
  // 部分 OpenAI 兼容中转只接受 image 字段。
  if (!response.ok && response.status >= 400 && response.status < 500) {
    await response.text();
    response = await send("image");
  }
  return readResponse(response);
}

async function downloadImageContent(id: string) {
  const response = await fetch(endpoint(`/images/generations/${encodeURIComponent(id)}/content`), {
    headers: { ...genericHeaders(), Accept: "image/*" },
  });
  if (!response.ok) throw new Error(`下载图片失败：HTTP ${response.status}`);
  const blob = await response.blob();
  if (!blob.size || /json|html|text/i.test(blob.type || "")) throw new Error("图片内容接口没有返回有效图片");
  return blobToDataUrl(blob);
}

async function pollImageGeneration(id: string) {
  const result = await pollTask(async () => {
    const task = await getGenericJson(`/images/generations/${encodeURIComponent(id)}`);
    const status = imageTaskStatus(task);
    if (["failed", "failure", "error", "cancelled", "canceled", "rejected", "expired"].includes(status)) {
      return { completed: true, error: imageTaskError(task) };
    }
    if (["completed", "complete", "success", "succeeded", "done"].includes(status)) {
      try {
        return { completed: true, data: await downloadImageContent(id) };
      } catch {
        const inline = imageInlineData(task);
        if (inline) return { completed: true, data: inline };
        const url = imageUrlValue(task);
        if (url) {
          try {
            return { completed: true, data: await imageUrlToDataUrl(url) };
          } catch {
            return { completed: false };
          }
        }
        return { completed: false };
      }
    }
    return { completed: false };
  }, 5000, 30 * 60 * 1000);
  if (result.error) throw new Error(result.error);
  if (!result.data) throw new Error("图片任务完成但没有返回图片内容");
  return result.data;
}

const imageRequest = async (config: ImageConfig, model: ImageModel): Promise<string> => {
  const modelName = String(model.modelName || "").trim();
  if (modelName.toLowerCase() !== "gpt-image-2") throw new Error(`不支持的图像模型：${modelName || "空"}`);
  const prompt = String(config.prompt || "").trim();
  if (!prompt) throw new Error("图片提示词不能为空");
  const size = resolveGptImageSize(config);
  const references = (config.referenceList || []).map((item) => String(item.base64 || "").trim()).filter(Boolean);

  const payload = references.length
    ? await postImageEdit(modelName, prompt, size, references)
    : await postGenericJson("/images/generations", {
        model: modelName,
        prompt,
        n: 1,
        size,
        quality: "auto",
        output_format: "jpeg",
        moderation: "auto",
      });
  const id = imageTaskId(payload);
  if (id) return pollImageGeneration(id);
  return parseImageResult(payload);
};

// ============================================================
// 视频创建和轮询
// ============================================================

const videoRequest = async (config: VideoConfig, model: VideoModel): Promise<string> => {
  const modelName = modelId(model);
  const protocol = getProtocol(modelName);
  const refs = mediaRefs(config);
  const frameMode = isFrameMode(config.mode);
  const prompt = String(config.prompt || "").trim();
  if (!prompt) throw new Error("视频提示词不能为空");

  let payload: Record<string, any>;
  if (protocol === "legacy" && isLegacyH3(modelName)) {
    payload = createLegacyH3Payload(config, modelName, prompt, refs, frameMode);
  } else if (protocol === "legacy") {
    if (frameMode) throw new Error("772 旧模型接口不支持首尾帧字段，请改用普通参考图片或新分组模型");
    if (refs.images.length > 9) throw new Error("772 旧模型参考图片最多 9 张");
    if (refs.videos.length > 3) throw new Error("772 旧模型参考视频最多 3 个");
    if (refs.audios.length > 3) throw new Error("772 旧模型参考音频最多 3 个");
    payload = {
      model: modelName,
      prompt,
      duration: normalizeLegacyDuration(config.duration),
      ratio: normalizeRatio(config.aspectRatio),
      resolution: normalizeLegacyResolution(config.resolution, modelName),
    };
    if (refs.images.length) payload.referenceImages = refs.images.map((value) => publicUrl(value, "参考图片"));
    if (refs.videos.length) payload.referenceVideos = refs.videos.map((value) => publicUrl(value, "参考视频"));
    if (refs.audios.length) payload.referenceAudios = refs.audios.map((value) => publicUrl(value, "参考音频"));
  } else if (isUnifiedH3(modelName)) {
    if (refs.videos.length) throw new Error("MiniMax H3 新模型不支持参考视频");
    if (frameMode) {
      if (refs.audios.length) throw new Error("MiniMax H3 首尾帧模式不能同时使用参考音频");
      if (modeName(config.mode) === "startEndRequired" && refs.images.length !== 2) throw new Error("MiniMax H3 首尾帧模式需要恰好 2 张图片");
      if (refs.images.length > 2) throw new Error("MiniMax H3 首尾帧模式最多 2 张图片");
      payload = { model: modelName, prompt, seconds: normalizeUnifiedDuration(config.duration, true), aspect_ratio: normalizeRatio(config.aspectRatio), resolution: normalizeUnifiedResolution(config.resolution, modelName) };
      if (refs.images.length) payload.start_frame = dataReference(refs.images[0], "首帧");
      if (refs.images.length === 2) payload.end_frame = dataReference(refs.images[1], "尾帧");
      if (!refs.images.length && modeName(config.mode) !== "startFrameOptional") throw new Error("MiniMax H3 首尾帧模式至少需要 1 张图片");
    } else {
      if (refs.images.length > 9) throw new Error("MiniMax H3 普通参考图片最多 9 张");
      if (refs.audios.length > 3) throw new Error("MiniMax H3 参考音频最多 3 段");
      if (refs.audios.length && !refs.images.length) throw new Error("MiniMax H3 参考音频需要至少搭配 1 张普通参考图片");
      payload = { model: modelName, prompt, seconds: normalizeUnifiedDuration(config.duration, true), aspect_ratio: normalizeRatio(config.aspectRatio), resolution: normalizeUnifiedResolution(config.resolution, modelName) };
      if (refs.images.length) payload.reference_images = refs.images.map((value) => dataReference(value, "参考图片"));
      if (refs.audios.length) payload.audio_reference = refs.audios.map((value) => dataReference(value, "参考音频"));
    }
  } else {
    if (modeName(config.mode) === "startEndRequired" && refs.images.length !== 2) throw new Error("772 新模型首尾帧模式需要恰好 2 张图片；当前接口会使用 images 参考字段");
    if (refs.images.length > 30) throw new Error("772 新模型参考图片最多 30 张");
    if (refs.videos.length > 10) throw new Error("772 新模型参考视频最多 10 个");
    if (refs.audios.length > 10) throw new Error("772 新模型参考音频最多 10 段");
    payload = {
      model: modelName,
      prompt,
      seconds: normalizeUnifiedDuration(config.duration, false),
      aspect_ratio: normalizeRatio(config.aspectRatio),
      resolution: normalizeUnifiedResolution(config.resolution, modelName),
    };
    // 新协议的首帧/参考图统一使用 images，避免发送未确认的 first_image/last_image 字段。
    if (refs.images.length) payload.images = refs.images.map((value) => dataReference(value, "参考图片"));
    if (refs.videos.length) payload.videos = refs.videos.map((value) => dataReference(value, "参考视频"));
    if (refs.audios.length) payload.audios = refs.audios.map((value) => dataReference(value, "参考音频"));
  }

  logger(`[772] 创建视频任务：${modelName}，协议：${protocol}`);
  const created = await postJson("/videos", payload, protocol);
  const id = taskId(created);
  if (!id) throw new Error("772 视频接口没有返回任务 ID");
  logger(`[772] 任务已创建：${id}`);

  const result = await pollTask(async () => {
    const task = await getJson(`/videos/${encodeURIComponent(id)}`, protocol);
    const status = taskStatus(task);
    if (["failure", "failed", "error", "cancelled", "canceled"].includes(status)) return { completed: true, error: failedMessage(task) };
    if (["success", "succeeded", "completed"].includes(status)) {
      try {
        return { completed: true, data: await downloadVideo(id, videoUrl(task), protocol) };
      } catch (error) {
        // 服务端可能先返回 SUCCESS，内容地址稍后才可读，继续轮询。
        if (!videoUrl(task)) return { completed: false };
        try {
          return { completed: true, data: await resultUrlToBase64(videoUrl(task), protocol) };
        } catch {
          return { completed: false };
        }
      }
    }
    return { completed: false };
  }, 5000, 30 * 60 * 1000);

  if (result.error) throw new Error(result.error);
  if (!result.data) throw new Error("772 视频任务完成但没有返回视频内容");
  return result.data;
};

async function downloadVideo(id: string, directUrl: string, protocol: Protocol) {
  const response = await fetch(endpoint(`/videos/${encodeURIComponent(id)}/content`), { headers: authHeaders(protocol) });
  if (response.ok) {
    const blob = await response.blob();
    if (blob.type && /json/i.test(blob.type)) throw new Error(await blob.text());
    if (!blob.size) throw new Error("视频内容为空");
    return blobToDataUrl(blob);
  }
  if (directUrl) return resultUrlToBase64(directUrl, protocol);
  throw new Error(`下载视频失败：HTTP ${response.status}`);
}

async function resultUrlToBase64(url: string, protocol: Protocol) {
  if (/^data:/i.test(url)) return url;
  try {
    const parsed = new URL(url);
    const sameOrigin = parsed.origin === new URL(baseUrl()).origin;
    const response = await fetch(url, { headers: sameOrigin ? authHeaders(protocol) : { Accept: "video/*" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    if (blob.type && /json/i.test(blob.type)) throw new Error(await blob.text());
    return blobToDataUrl(blob);
  } catch {
    // Toonflow 官方运行时提供该工具，作为跨域或重定向结果地址的回退。
    return urlToBase64(url);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取视频内容失败"));
    reader.readAsDataURL(blob);
  });
}

// Toonflow 要求导出这些函数；TTS 暂未在 772 服务中配置。
const unsupported = () => {
  throw new Error("此供应商文件暂未配置 TTS 模型");
};

exports.vendor = vendor;
exports.textRequest = textRequest;
exports.imageRequest = imageRequest;
exports.videoRequest = videoRequest;
exports.ttsRequest = unsupported;

export {};
