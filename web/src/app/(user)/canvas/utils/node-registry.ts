import { CanvasNodeType, type CanvasNodeMetadata, type CanvasNodeTypeId } from "../types";

/**
 * 画布节点定义。内置节点由 canvas-node 内部渲染器负责，因此这里只描述
 * 创建节点所需的规格；插件节点后续会在此基础上追加渲染器字段。
 */
export type CanvasNodeDefinition = {
    type: CanvasNodeTypeId;
    title: string;
    defaultSize: { width: number; height: number };
    defaultMetadata?: CanvasNodeMetadata;
    /** 是否出现在创建菜单，默认 true */
    showInCreateMenu?: boolean;
};

const FALLBACK_SPEC = { width: 340, height: 240, title: "节点", metadata: undefined as CanvasNodeMetadata | undefined };

const definitions = new Map<string, CanvasNodeDefinition>();
// type -> 归属方，内置为 "builtin"，插件为 pluginId
const ownerByType = new Map<string, string>();

export function registerNodeDefinitions(defs: CanvasNodeDefinition[], owner = "builtin") {
    defs.forEach((def) => {
        definitions.set(def.type, def);
        ownerByType.set(def.type, owner);
    });
}

export function unregisterOwnerNodes(owner: string) {
    for (const [type, current] of ownerByType) {
        if (current !== owner) continue;
        definitions.delete(type);
        ownerByType.delete(type);
    }
}

export function getNodeDefinition(type: CanvasNodeTypeId) {
    return definitions.get(type);
}

export function listNodeDefinitions() {
    return Array.from(definitions.values());
}

export function isRegisteredNodeType(type: CanvasNodeTypeId) {
    return definitions.has(type);
}

export function isBuiltinNodeType(type: CanvasNodeTypeId) {
    return (Object.values(CanvasNodeType) as string[]).includes(type);
}

export function getNodeOwner(type: CanvasNodeTypeId) {
    return ownerByType.get(type) || "builtin";
}

/** 创建节点时的默认尺寸/标题/初始 metadata，未注册类型回退到通用规格。 */
export function getNodeSpec(type: CanvasNodeTypeId) {
    const def = definitions.get(type);
    if (!def) return FALLBACK_SPEC;
    return { width: def.defaultSize.width, height: def.defaultSize.height, title: def.title, metadata: def.defaultMetadata };
}

registerNodeDefinitions([
    { type: CanvasNodeType.Image, title: "New Generation", defaultSize: { width: 340, height: 240 }, defaultMetadata: { content: "", status: "idle" } },
    { type: CanvasNodeType.Text, title: "Note", defaultSize: { width: 340, height: 240 }, defaultMetadata: { content: "", status: "idle", fontSize: 14 } },
    { type: CanvasNodeType.Config, title: "生成配置", defaultSize: { width: 340, height: 240 }, defaultMetadata: { content: "", status: "idle", generationMode: "image" } },
    { type: CanvasNodeType.Video, title: "Video", defaultSize: { width: 420, height: 236 }, defaultMetadata: { content: "", status: "idle" } },
    { type: CanvasNodeType.Audio, title: "Audio", defaultSize: { width: 340, height: 120 }, defaultMetadata: { content: "", status: "idle" } },
]);
