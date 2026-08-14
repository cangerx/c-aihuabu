import { App, Button, Drawer, Input, Select, Space } from "antd";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { fetchChannelModels } from "@/services/api/image";
import type { ModelChannel } from "@/stores/use-config-store";

function uniqueModels(models: string[]) {
    return Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)));
}

type ChannelEditorDrawerProps = {
    open: boolean;
    channel: ModelChannel | null;
    creating?: boolean;
    onSave: (channel: ModelChannel) => void;
    onClose: () => void;
};

export function ChannelEditorDrawer({ open, channel, creating = false, onSave, onClose }: ChannelEditorDrawerProps) {
    const { message } = App.useApp();
    const [draft, setDraft] = useState<ModelChannel | null>(channel);
    const [loading, setLoading] = useState(false);
    const fetchRequestRef = useRef(0);

    useEffect(() => {
        fetchRequestRef.current += 1;
        setLoading(false);
        if (open && channel) setDraft(channel);
    }, [open, channel]);

    if (!draft) return null;

    const patch = (value: Partial<ModelChannel>) => setDraft((current) => (current ? { ...current, ...value } : current));

    const close = () => {
        fetchRequestRef.current += 1;
        setLoading(false);
        onClose();
    };

    const save = () => {
        onSave({ ...draft, name: draft.name.trim() || "未命名渠道", models: uniqueModels(draft.models) });
        close();
    };

    const fetchModels = async () => {
        if (!draft.baseUrl.trim() || !draft.apiKey.trim()) {
            message.error("请先填写 Base URL 和 Key");
            return;
        }
        const requestId = ++fetchRequestRef.current;
        setLoading(true);
        try {
            const models = uniqueModels(await fetchChannelModels(draft));
            if (requestId !== fetchRequestRef.current) return;
            if (!models.length) {
                message.warning("渠道没有返回可用模型");
                return;
            }
            patch({ models });
            message.success(`已拉取 ${models.length} 个模型，保存后生效`);
        } catch (error) {
            if (requestId !== fetchRequestRef.current) return;
            message.error(error instanceof Error ? error.message : "读取模型失败");
        } finally {
            if (requestId === fetchRequestRef.current) setLoading(false);
        }
    };

    return (
        <Drawer
            open={open}
            size="large"
            title={creating ? "新增渠道" : "编辑渠道"}
            onClose={close}
            styles={{ body: { paddingTop: 16 } }}
            extra={
                <Space>
                    <Button onClick={close}>取消</Button>
                    <Button type="primary" disabled={loading} onClick={save}>
                        保存
                    </Button>
                </Space>
            }
        >
            <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                    <span className="mb-1 block text-sm font-medium">渠道名称</span>
                    <Input disabled={loading} value={draft.name} onChange={(event) => patch({ name: event.target.value })} placeholder="默认渠道" />
                </label>
                <label className="block">
                    <span className="mb-1 block text-sm font-medium">Base URL</span>
                    <Input disabled={loading} value={draft.baseUrl} onChange={(event) => patch({ baseUrl: event.target.value })} placeholder="https://api.example.com" />
                </label>
                <label className="block md:col-span-2">
                    <span className="mb-1 block text-sm font-medium">API Key</span>
                    <Input.Password disabled={loading} value={draft.apiKey} onChange={(event) => patch({ apiKey: event.target.value })} placeholder="sk-..." />
                </label>
            </div>

            <div className="mt-6 mb-3 flex items-center justify-between">
                <div>
                    <div className="text-sm font-semibold">渠道模型</div>
                    <div className="mt-0.5 text-xs text-stone-500">已选 {draft.models.length} 个；可手动输入，或按当前 Base URL 和 Key 拉取。</div>
                </div>
                <Button size="small" icon={<RefreshCw className="size-3.5" />} loading={loading} onClick={() => void fetchModels()}>
                    拉取模型
                </Button>
            </div>
            <Select
                mode="tags"
                showSearch
                allowClear
                maxTagCount="responsive"
                placeholder="输入模型名"
                className="w-full"
                disabled={loading}
                value={draft.models}
                onChange={(models) => patch({ models })}
            />
        </Drawer>
    );
}
