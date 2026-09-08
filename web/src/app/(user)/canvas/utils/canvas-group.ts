import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from "../types";

const GROUP_PADDING = 24;
const GROUP_TITLE_PADDING = 52;

export function expandGroupNodeIds(ids: Set<string>, nodes: CanvasNodeData[]) {
    const groupIds = new Set(nodes.filter((node) => ids.has(node.id) && node.type === CanvasNodeType.Group).map((node) => node.id));
    return new Set([...ids, ...nodes.filter((node) => node.metadata?.groupId && groupIds.has(node.metadata.groupId)).map((node) => node.id)]);
}

export function collectGroupMemberNodes(ids: Set<string>, nodes: CanvasNodeData[]) {
    const expanded = expandGroupNodeIds(ids, nodes);
    return nodes.filter((node) => expanded.has(node.id) && node.type !== CanvasNodeType.Group);
}

export function getGroupWrapRect(nodes: CanvasNodeData[]) {
    const bounds = nodeBounds(nodes);
    return {
        x: bounds.left - GROUP_PADDING,
        y: bounds.top - GROUP_TITLE_PADDING,
        width: bounds.right - bounds.left + GROUP_PADDING * 2,
        height: bounds.bottom - bounds.top + GROUP_TITLE_PADDING + GROUP_PADDING,
    };
}

export function canGroupSelectedNodes(ids: Set<string>, nodes: CanvasNodeData[]) {
    const members = collectGroupMemberNodes(ids, nodes);
    if (members.length < 2) return false;
    const groupId = members[0]?.metadata?.groupId;
    return !groupId || members.some((node) => node.metadata?.groupId !== groupId);
}

export function canUngroupSelectedNodes(ids: Set<string>, nodes: CanvasNodeData[]) {
    return nodes.some((node) => ids.has(node.id) && (node.type === CanvasNodeType.Group || Boolean(node.metadata?.groupId)));
}

export function applyGroupSelection(ids: Set<string>, nodes: CanvasNodeData[], connections: CanvasConnection[], group: CanvasNodeData) {
    const members = collectGroupMemberNodes(ids, nodes);
    if (members.length < 2) return null;
    const memberIds = new Set(members.map((node) => node.id));
    const flattenedGroupIds = new Set(nodes.filter((node) => ids.has(node.id) && node.type === CanvasNodeType.Group).map((node) => node.id));
    const updated = nodes.filter((node) => !flattenedGroupIds.has(node.id)).map((node) => (memberIds.has(node.id) ? { ...node, metadata: { ...node.metadata, groupId: group.id } } : node));
    const insertAt = updated.findIndex((node) => memberIds.has(node.id));
    const withGroup = insertAt < 0 ? [...updated, group] : [...updated.slice(0, insertAt), group, ...updated.slice(insertAt)];
    const removed = new Set([...flattenedGroupIds, ...emptyGroupIds(withGroup, group.id)]);
    return {
        nodes: withGroup.filter((node) => !removed.has(node.id)),
        connections: connections.filter((connection) => !removed.has(connection.fromNodeId) && !removed.has(connection.toNodeId)),
        selectedIds: [group.id],
    };
}

export function applyUngroupSelection(ids: Set<string>, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    const flattenedGroupIds = new Set(nodes.filter((node) => ids.has(node.id) && node.type === CanvasNodeType.Group).map((node) => node.id));
    if (!flattenedGroupIds.size && !nodes.some((node) => ids.has(node.id) && node.metadata?.groupId)) return null;
    const releasedIds = new Set<string>();
    const affectedGroupIds = new Set<string>();
    const updated = nodes
        .filter((node) => !flattenedGroupIds.has(node.id))
        .map((node) => {
            const groupId = node.metadata?.groupId;
            if (!groupId || (!flattenedGroupIds.has(groupId) && !ids.has(node.id))) return node;
            affectedGroupIds.add(groupId);
            releasedIds.add(node.id);
            return { ...node, metadata: { ...node.metadata, groupId: undefined } };
        });
    const removed = new Set([...flattenedGroupIds, ...emptyGroupIds(updated)]);
    const nextNodes = updateGroupBounds(updated.filter((node) => !removed.has(node.id)), affectedGroupIds);
    return {
        nodes: nextNodes,
        connections: connections.filter((connection) => !removed.has(connection.fromNodeId) && !removed.has(connection.toNodeId)),
        selectedIds: nextNodes.filter((node) => ids.has(node.id) || releasedIds.has(node.id)).map((node) => node.id),
    };
}

export function updateGroupBounds(nodes: CanvasNodeData[], groupIds: Set<string>) {
    if (!groupIds.size) return nodes;
    const membersByGroup = new Map<string, CanvasNodeData[]>();
    nodes.forEach((node) => {
        const groupId = node.metadata?.groupId;
        if (!groupId || !groupIds.has(groupId)) return;
        const members = membersByGroup.get(groupId) || [];
        members.push(node);
        membersByGroup.set(groupId, members);
    });
    return nodes.map((node) => {
        if (node.type !== CanvasNodeType.Group || !groupIds.has(node.id)) return node;
        const members = membersByGroup.get(node.id);
        if (!members?.length) return node;
        const rect = getGroupWrapRect(members);
        return { ...node, position: { x: rect.x, y: rect.y }, width: rect.width, height: rect.height };
    });
}

function emptyGroupIds(nodes: CanvasNodeData[], keepId?: string) {
    const used = new Set(nodes.flatMap((node) => (node.type !== CanvasNodeType.Group && node.metadata?.groupId ? [node.metadata.groupId] : [])));
    return new Set(nodes.filter((node) => node.type === CanvasNodeType.Group && node.id !== keepId && !used.has(node.id)).map((node) => node.id));
}

function nodeBounds(nodes: CanvasNodeData[]) {
    return nodes.reduce(
        (bounds, node) => ({
            left: Math.min(bounds.left, node.position.x),
            top: Math.min(bounds.top, node.position.y),
            right: Math.max(bounds.right, node.position.x + node.width),
            bottom: Math.max(bounds.bottom, node.position.y + node.height),
        }),
        { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
    );
}
