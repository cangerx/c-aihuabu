"use client";

import { Button, Drawer, Input, Select, Space } from "antd";
import { useEffect, useState } from "react";

import { videos4VideoModels } from "@/lib/videos4-video";
import type { ModelChannel } from "@/stores/use-config-store";

function uniqueModels(models: string[]) {
    return Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)));
}

type ChannelEditorDrawerProps = {
    open: boolean;
    channel: ModelChannel | null;
    onSave: (channel: ModelChannel) => void;
    onClose: () => void;
};

export function ChannelEditorDrawer({ open, channel, onSave, onClose }: ChannelEditorDrawerProps) {
    const [draft, setDraft] = useState<ModelChannel | null>(channel);

    useEffect(() => {
        if (open && channel) setDraft(channel);
    }, [open, channel]);

    if (!draft) return null;

    const patch = (value: Partial<ModelChannel>) => setDraft((current) => (current ? { ...current, ...value } : current));

    const save = () => {
        onSave({ ...draft, name: draft.name.trim() || "未命名渠道", models: uniqueModels(draft.models) });
        onClose();
    };

    return (
        <Drawer
            open={open}
            size="large"
            title="编辑渠道"
            onClose={onClose}
            styles={{ body: { paddingTop: 16 } }}
            extra={
                <Space>
                    <Button onClick={onClose}>取消</Button>
                    <Button type="primary" onClick={save}>
                        保存
                    </Button>
                </Space>
            }
        >
            <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                    <span className="mb-1 block text-sm font-medium">渠道名称</span>
                    <Input value={draft.name} onChange={(event) => patch({ name: event.target.value })} placeholder="默认渠道" />
                </label>
                <label className="block">
                    <span className="mb-1 block text-sm font-medium">Base URL</span>
                    <Input value={draft.baseUrl} onChange={(event) => patch({ baseUrl: event.target.value })} placeholder="https://api.example.com" />
                </label>
                <label className="block md:col-span-2">
                    <span className="mb-1 block text-sm font-medium">API Key</span>
                    <Input.Password value={draft.apiKey} onChange={(event) => patch({ apiKey: event.target.value })} placeholder="sk-..." />
                </label>
            </div>

            <div className="mt-6 mb-3 flex items-center justify-between">
                <div>
                    <div className="text-sm font-semibold">渠道模型</div>
                    <div className="mt-0.5 text-xs text-stone-500">已选 {draft.models.length} 个；可手动输入，也可在「渠道」页拉取模型后在此选择。</div>
                </div>
                <Button size="small" onClick={() => patch({ models: uniqueModels([...draft.models, ...videos4VideoModels]) })}>
                    填入 videos-4 视频模型
                </Button>
            </div>
            <Select
                mode="tags"
                showSearch
                allowClear
                maxTagCount="responsive"
                placeholder="输入模型名"
                className="w-full"
                value={draft.models}
                onChange={(models) => patch({ models })}
            />
        </Drawer>
    );
}
