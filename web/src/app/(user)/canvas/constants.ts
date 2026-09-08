import { CanvasNodeType } from "./types";

/**
 * 内置节点的默认尺寸，供画布内部按类型做布局计算（例如把图片节点排在文本节点旁边）。
 * 创建节点时的完整规格请用 getNodeSpec，它由注册表提供并支持插件类型。
 */
export const NODE_DEFAULT_SIZE = {
    [CanvasNodeType.Image]: { width: 340, height: 240, title: "New Generation" },
    [CanvasNodeType.Text]: { width: 340, height: 240, title: "Note" },
    [CanvasNodeType.Config]: { width: 340, height: 240, title: "生成配置" },
    [CanvasNodeType.Video]: { width: 420, height: 236, title: "Video" },
    [CanvasNodeType.Audio]: { width: 340, height: 120, title: "Audio" },
    [CanvasNodeType.Group]: { width: 460, height: 300, title: "分组" },
} satisfies Record<CanvasNodeType, { width: number; height: number; title: string }>;

/**
 * 节点创建规格统一由注册表提供，内置类型在 utils/node-registry.ts 注册，
 * 未注册（例如插件）类型回退到通用规格。
 */
export { getNodeSpec } from "./utils/node-registry";
