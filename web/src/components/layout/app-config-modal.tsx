"use client";

import { App, Button, Form, Input, Modal, Progress, Segmented, Select, Tabs } from "antd";
import { CircleAlert, Cloud, Plus, RefreshCw, Trash2, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

import { ModelPicker } from "@/components/model-picker";
import { createCloudChannel, fetchAccountMe, fetchCloudChannels, loginAccount, logoutAccount, registerAccount, type AccountUser, type CloudModelChannel } from "@/services/api/account";
import { fetchChannelModels } from "@/services/api/image";
import { syncAppDataToWebdav, type AppSyncDomainKey, type AppSyncProgressEvent } from "@/services/app-sync";
import { testWebdavConnection, WEBDAV_MANIFEST_FILE_NAME } from "@/services/webdav-sync";
import { audioFormatOptions, audioVoiceOptions, normalizeAudioSpeedValue } from "@/lib/audio-generation";
import { createModelChannel, defaultBaseUrlForApiFormat, filterModelsByCapability, modelOptionLabel, modelOptionsFromChannels, normalizeModelOptionValue, useConfigStore, type AiConfig, type ApiCallFormat, type ModelCapability, type ModelChannel } from "@/stores/use-config-store";

type ModelGroup = {
    capability: ModelCapability;
    modelKey: "imageModel" | "videoModel" | "textModel" | "audioModel";
    modelsKey: "imageModels" | "videoModels" | "textModels" | "audioModels";
    title: string;
    defaultLabel: string;
    optionsLabel: string;
    hint: string;
};

type WebdavDomainProgress = {
    label: string;
    stage: string;
    current?: number;
    total?: number;
    status?: "active" | "success" | "exception";
};

const modelGroups: ModelGroup[] = [
    { capability: "image", modelKey: "imageModel", modelsKey: "imageModels", title: "图片模型", defaultLabel: "默认生图", optionsLabel: "可选生图模型", hint: "用于画布生图、图生图和生图工作台。" },
    { capability: "video", modelKey: "videoModel", modelsKey: "videoModels", title: "视频模型", defaultLabel: "默认视频", optionsLabel: "可选视频模型", hint: "用于画布视频节点和视频创作台。" },
    { capability: "text", modelKey: "textModel", modelsKey: "textModels", title: "文本模型", defaultLabel: "默认文本", optionsLabel: "可选文本模型", hint: "用于助手对话、提示词优化和文本节点。" },
    { capability: "audio", modelKey: "audioModel", modelsKey: "audioModels", title: "音频模型", defaultLabel: "默认音频", optionsLabel: "可选音频模型", hint: "用于语音、旁白和音频生成。" },
];

const apiFormatOptions: Array<{ label: string; value: ApiCallFormat }> = [
    { label: "OpenAI", value: "openai" },
    { label: "Gemini", value: "gemini" },
    { label: "Volcengine Seedance", value: "volcengine" },
    { label: "Cai", value: "openai-json" },
    { label: "NewToken", value: "newtoken" },
    { label: "Duomi", value: "duomiapi" },
    { label: "Lingdong", value: "lingdongapi" },
];

const newTokenVideoModels = ["video-standard-720p", "video-pro-720p", "video-fast-720p", "sora-2", "sora-vip3-pro-720p", "sora-vip3-pro-1080p", "veo-omni-flash", "veo-omni-flash-video-edit", "veo-3-1"];
const duomiModels = [
    "doubao-seedance-2-0-260128",
    "grok-video",
    "grok-video-1.5",
];
const caiVideoModels = ["videos", "videos_stable", "happyhorse", "grok-imagine-video", "grok-imagine-video-1.5"];
const lingdongModels = ["gpt-image-2", "sora-2", "sd-2-1", "sd-2-2", "sd-2-3", "sd-2-4", "sd-2-7", "sd-2-11", "sd-2-17"];

const webdavDomainKeys: AppSyncDomainKey[] = ["canvas", "assets", "image-workbench", "video-workbench"];
const webdavDomainLabels: Record<AppSyncDomainKey, string> = {
    canvas: "画布",
    assets: "我的素材",
    "image-workbench": "生图工作台",
    "video-workbench": "视频创作台",
};

function createWebdavDomainProgress(): Record<AppSyncDomainKey, WebdavDomainProgress> {
    return webdavDomainKeys.reduce(
        (progress, key) => ({
            ...progress,
            [key]: { label: webdavDomainLabels[key], stage: "等待同步" },
        }),
        {} as Record<AppSyncDomainKey, WebdavDomainProgress>,
    );
}

export function AppConfigModal() {
    const { message } = App.useApp();
    const [loadingChannelId, setLoadingChannelId] = useState("");
    const [testingWebdav, setTestingWebdav] = useState(false);
    const [syncingWebdav, setSyncingWebdav] = useState(false);
    const [webdavSyncStatus, setWebdavSyncStatus] = useState("");
    const [webdavDomainProgress, setWebdavDomainProgress] = useState(createWebdavDomainProgress);
    const [accountUser, setAccountUser] = useState<AccountUser | null>(null);
    const [accountEmail, setAccountEmail] = useState("");
    const [accountPassword, setAccountPassword] = useState("");
    const [accountLoading, setAccountLoading] = useState(false);
    const [cloudChannels, setCloudChannels] = useState<CloudModelChannel[]>([]);
    const config = useConfigStore((state) => state.config);
    const webdav = useConfigStore((state) => state.webdav);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const updateWebdavConfig = useConfigStore((state) => state.updateWebdavConfig);
    const isConfigOpen = useConfigStore((state) => state.isConfigOpen);
    const configDialogTab = useConfigStore((state) => state.configDialogTab);
    const shouldPromptContinue = useConfigStore((state) => state.shouldPromptContinue);
    const setConfigDialogOpen = useConfigStore((state) => state.setConfigDialogOpen);
    const setConfigDialogTab = useConfigStore((state) => state.setConfigDialogTab);
    const clearPromptContinue = useConfigStore((state) => state.clearPromptContinue);
    const modelOptionsFor = (capability: ModelCapability) => filterModelsByCapability(config.models, capability).map((model) => ({ label: modelOptionLabel(config, model), value: model }));
    const webdavReady = Boolean(webdav.url.trim());

    useEffect(() => {
        if (isConfigOpen) void refreshAccount().catch(() => {});
    }, [isConfigOpen]);

    const refreshAccount = async () => {
        const data = await fetchAccountMe();
        setAccountUser(data.user);
        if (data.user) await refreshCloudChannels();
        else setCloudChannels([]);
    };

    const saveConfig = (nextConfig: AiConfig) => {
        (Object.keys(nextConfig) as Array<keyof AiConfig>).forEach((key) => updateConfig(key, nextConfig[key]));
    };

    const finishConfig = () => {
        const ready = config.channels.some((channel) => channel.baseUrl.trim() && channel.apiKey.trim() && channel.models.length);
        setConfigDialogOpen(false);
        if (!ready) return;
        message.success(shouldPromptContinue ? "配置已保存，请继续刚才的请求" : "配置已保存");
        clearPromptContinue();
    };

    const submitAccount = async (mode: "login" | "register") => {
        setAccountLoading(true);
        try {
            const data = mode === "login" ? await loginAccount(accountEmail, accountPassword) : await registerAccount(accountEmail, accountPassword);
            setAccountUser(data.user);
            setAccountPassword("");
            await refreshCloudChannels();
            window.dispatchEvent(new Event("ai-huabu-account-change"));
            message.success(mode === "login" ? "已登录" : "账号已创建");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "账号操作失败");
        } finally {
            setAccountLoading(false);
        }
    };

    const logout = async () => {
        setAccountLoading(true);
        try {
            await logoutAccount();
            setAccountUser(null);
            setCloudChannels([]);
            window.dispatchEvent(new Event("ai-huabu-account-change"));
            message.success("已退出登录");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "退出失败");
        } finally {
            setAccountLoading(false);
        }
    };

    const refreshCloudChannels = async () => {
        const data = await fetchCloudChannels();
        setCloudChannels(data.channels);
    };

    const saveLocalChannelToCloud = async (channel: ModelChannel) => {
        if (!channel.apiKey.trim()) return message.error("该本地渠道没有 Key");
        setAccountLoading(true);
        try {
            await createCloudChannel({ name: channel.name, baseUrl: channel.baseUrl, apiKey: channel.apiKey, apiFormat: channel.apiFormat, models: channel.models });
            await refreshCloudChannels();
            message.success("已保存到云端个人渠道");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存失败");
        } finally {
            setAccountLoading(false);
        }
    };

    const copyCloudChannelModels = (channel: CloudModelChannel) => {
        navigator.clipboard?.writeText(channel.models.join("\n")).catch(() => {});
        message.success("已复制云端渠道模型名");
    };

    const useCloudChannel = (channel: CloudModelChannel) => {
        if (!channel.apiKey) return message.error("云端 Key 解密失败，无法应用");
        updateChannels([...config.channels.filter((item) => item.id !== channel.id), createModelChannel(channel)]);
        setConfigDialogTab("channels");
        message.success("已应用云端个人渠道");
    };

    const updateChannels = (channels: ModelChannel[]) => {
        const nextConfig = withChannels(config, channels);
        saveConfig(nextConfig);
    };

    const updateChannel = (id: string, patch: Partial<ModelChannel>) => {
        updateChannels(config.channels.map((channel) => (channel.id === id ? { ...channel, ...patch, models: patch.models ? uniqueModels(patch.models) : channel.models } : channel)));
    };

    const updateChannelApiFormat = (channel: ModelChannel, apiFormat: ApiCallFormat) => {
        const baseUrl = !channel.baseUrl.trim() || channel.baseUrl.trim() === defaultBaseUrlForApiFormat(channel.apiFormat) ? defaultBaseUrlForApiFormat(apiFormat) : channel.baseUrl;
        const models = apiFormat === "duomiapi" ? duomiModels : apiFormat === "lingdongapi" ? lingdongModels : !channel.models.length && apiFormat === "newtoken" ? newTokenVideoModels : !channel.models.length && apiFormat === "openai-json" ? caiVideoModels : channel.models;
        updateChannel(channel.id, { apiFormat, baseUrl, models });
    };

    const addChannel = () => {
        updateChannels([...config.channels, createModelChannel({ name: `渠道 ${config.channels.length + 1}` })]);
    };

    const deleteChannel = (id: string) => {
        if (config.channels.length <= 1) {
            message.warning("至少保留一个渠道");
            return;
        }
        updateChannels(config.channels.filter((channel) => channel.id !== id));
    };

    const refreshChannelModels = async (channel: ModelChannel) => {
        if (channel.apiFormat === "duomiapi" || channel.apiFormat === "lingdongapi") {
            updateChannel(channel.id, { models: channel.apiFormat === "lingdongapi" ? lingdongModels : duomiModels });
            message.success(channel.apiFormat === "lingdongapi" ? "已恢复 Lingdong 已适配模型" : "已恢复 Duomi 已适配模型");
            return;
        }
        if (!channel.baseUrl.trim() || !channel.apiKey.trim()) {
            message.error("请先填写该渠道的 Base URL 和 Key");
            return;
        }
        setLoadingChannelId(channel.id);
        try {
            const models = await fetchChannelModels(channel);
            updateChannels(config.channels.map((item) => (item.id === channel.id ? { ...item, models } : item)));
            message.success(`${channel.name} 模型列表已更新`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取模型失败");
        } finally {
            setLoadingChannelId("");
        }
    };

    const refreshAllModels = async () => {
        const builtinChannels = config.channels.filter((channel) => channel.apiFormat === "duomiapi" || channel.apiFormat === "lingdongapi");
        const runnable = config.channels.filter((channel) => !builtinChannels.includes(channel) && channel.baseUrl.trim() && channel.apiKey.trim());
        if (!runnable.length) {
            if (builtinChannels.length) {
                updateChannels(config.channels.map((channel) => (channel.apiFormat === "duomiapi" ? { ...channel, models: duomiModels } : channel.apiFormat === "lingdongapi" ? { ...channel, models: lingdongModels } : channel)));
                message.success("已恢复内置渠道已适配模型");
                return;
            }
            message.error("请先填写至少一个可拉取渠道的 Base URL 和 Key");
            return;
        }
        setLoadingChannelId("all");
        try {
            const entries = await Promise.all(runnable.map(async (channel) => [channel.id, await fetchChannelModels(channel)] as const));
            const modelMap = new Map(entries);
            updateChannels(config.channels.map((channel) => (channel.apiFormat === "duomiapi" ? { ...channel, models: duomiModels } : channel.apiFormat === "lingdongapi" ? { ...channel, models: lingdongModels } : modelMap.has(channel.id) ? { ...channel, models: modelMap.get(channel.id) || [] } : channel)));
            message.success("模型列表已更新");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取模型失败");
        } finally {
            setLoadingChannelId("");
        }
    };

    const updateCapabilityModels = (group: ModelGroup, models: string[]) => {
        const next = filterModelsByCapability(uniqueModels(models.map((model) => normalizeModelOptionValue(model, config.channels)).filter(Boolean)), group.capability);
        updateConfig(group.modelsKey, next);
        if (!next.includes(config[group.modelKey])) updateConfig(group.modelKey, next[0] || "");
    };

    const testWebdav = async () => {
        if (!webdavReady) {
            message.error("请先填写 WebDAV 地址");
            return;
        }
        setTestingWebdav(true);
        try {
            await testWebdavConnection(webdav);
            message.success("WebDAV 连接可用");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "WebDAV 连接测试失败");
        } finally {
            setTestingWebdav(false);
        }
    };

    const updateWebdavProgress = (event: AppSyncProgressEvent) => {
        setWebdavSyncStatus(event.stage);
        if (!event.domain) return;
        setWebdavDomainProgress((current) => ({
            ...current,
            [event.domain as AppSyncDomainKey]: {
                label: event.label || webdavDomainLabels[event.domain as AppSyncDomainKey],
                stage: event.stage,
                current: event.current,
                total: event.total,
                status: event.status,
            },
        }));
    };

    const syncWebdav = async () => {
        if (!webdavReady) {
            message.error("请先填写 WebDAV 地址");
            return;
        }
        setSyncingWebdav(true);
        setWebdavDomainProgress(createWebdavDomainProgress());
        setWebdavSyncStatus("准备同步");
        try {
            const result = await syncAppDataToWebdav(webdav, updateWebdavProgress);
            updateWebdavConfig("lastSyncedAt", result.syncedAt);
            message.success(`同步完成：${result.projects} 个画布，${result.assets} 个素材，${result.imageLogs + result.videoLogs} 条记录，本次上传 ${result.uploadedFiles} 个文件 ${formatBytes(result.uploadedBytes)}`);
        } catch (error) {
            setWebdavSyncStatus(error instanceof Error ? error.message : "WebDAV 同步失败");
            message.error(error instanceof Error ? error.message : "WebDAV 同步失败");
        } finally {
            setSyncingWebdav(false);
        }
    };

    return (
        <Modal
            zIndex={2000}
            title={
                <div>
                    <div className="text-lg font-semibold">配置与用户偏好</div>
                    <div className="mt-1 text-xs font-normal text-stone-500">渠道聚合、模型选择 and 同步偏好</div>
                </div>
            }
            open={isConfigOpen}
            width={980}
            centered
            onCancel={() => setConfigDialogOpen(false)}
            styles={{ body: { maxHeight: "72vh", overflowY: "auto", paddingRight: 12 } }}
            footer={
                <Button type="primary" onClick={finishConfig}>
                    完成
                </Button>
            }
        >
            <Tabs
                activeKey={configDialogTab}
                onChange={(key) => setConfigDialogTab(key as typeof configDialogTab)}
                items={[
                    {
                        key: "account",
                        label: "账号",
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <section className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold">{accountUser ? `已登录：${accountUser.email}` : "登录后可保存云端个人渠道"}</div>
                                            <div className="mt-1 text-xs leading-5 text-stone-500">未登录时继续使用本地 Key；登录后可把个人渠道加密保存到服务端，后续用于多端共享和异步任务。</div>
                                        </div>
                                        {accountUser ? (
                                            <Button loading={accountLoading} onClick={() => void logout()}>
                                                退出登录
                                            </Button>
                                        ) : null}
                                    </div>
                                    {!accountUser ? (
                                        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto_auto]">
                                            <Form.Item label="邮箱" className="mb-0">
                                                <Input value={accountEmail} autoComplete="email" onChange={(event) => setAccountEmail(event.target.value)} />
                                            </Form.Item>
                                            <Form.Item label="密码" className="mb-0">
                                                <Input.Password value={accountPassword} autoComplete="current-password" onChange={(event) => setAccountPassword(event.target.value)} />
                                            </Form.Item>
                                            <Form.Item label=" " className="mb-0">
                                                <Button type="primary" block loading={accountLoading} onClick={() => void submitAccount("login")}>
                                                    登录
                                                </Button>
                                            </Form.Item>
                                            <Form.Item label=" " className="mb-0">
                                                <Button block loading={accountLoading} onClick={() => void submitAccount("register")}>
                                                    注册
                                                </Button>
                                            </Form.Item>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="text-sm font-semibold">云端个人渠道</div>
                                                <Button size="small" loading={accountLoading} icon={<RefreshCw className="size-3.5" />} onClick={() => void refreshCloudChannels()}>
                                                    刷新
                                                </Button>
                                            </div>
                                            {cloudChannels.map((channel) => (
                                                <div key={channel.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-semibold">{channel.name}</div>
                                                        <div className="mt-1 text-xs text-stone-500">
                                                            {apiFormatLabel(channel.apiFormat)} · {channel.models.length} 个模型 · Key {channel.apiKeyPreview}
                                                        </div>
                                                    </div>
                                                    <div className="flex shrink-0 gap-2">
                                                        <Button size="small" onClick={() => copyCloudChannelModels(channel)}>
                                                            复制模型
                                                        </Button>
                                                        <Button size="small" type="primary" onClick={() => useCloudChannel(channel)}>
                                                            应用
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                            {!cloudChannels.length ? <div className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500 dark:border-stone-700">还没有云端个人渠道，可在“渠道”Tab 将本地渠道保存到云端。</div> : null}
                                        </div>
                                    )}
                                </section>
                            </Form>
                        ),
                    },
                    {
                        key: "channels",
                        label: "渠道",
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex w-fit max-w-full flex-wrap items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100">
                                            <CircleAlert className="size-3.5 shrink-0" />
                                            <span className="font-semibold">重要：</span>
                                            <span>新增或拉取模型后，需要到“模型”Tab 选择可选项才会显示。</span>
                                            <Button type="link" size="small" className="h-auto p-0 text-xs font-semibold text-amber-900 dark:text-amber-100" onClick={() => setConfigDialogTab("models")}>
                                                去模型设置
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 gap-2">
                                        <Button icon={<RefreshCw className="size-4" />} loading={Boolean(loadingChannelId)} onClick={() => void refreshAllModels()}>
                                            拉取全部
                                        </Button>
                                        <Button type="primary" icon={<Plus className="size-4" />} onClick={addChannel}>
                                            新增渠道
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {config.channels.map((channel) => (
                                        <section key={channel.id} className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-semibold">{channel.name || "未命名渠道"}</div>
                                                    <div className="mt-1 text-xs text-stone-500">
                                                        {apiFormatLabel(channel.apiFormat)} · 已保存 {channel.models.length} 个模型
                                                    </div>
                                                </div>
                                                <div className="flex shrink-0 gap-2">
                                                    {accountUser ? (
                                                        <Button size="small" loading={accountLoading} onClick={() => void saveLocalChannelToCloud(channel)}>
                                                            存云端
                                                        </Button>
                                                    ) : null}
                                                    {channel.apiFormat !== "duomiapi" && channel.apiFormat !== "lingdongapi" ? (
                                                        <Button size="small" loading={loadingChannelId === channel.id} onClick={() => void refreshChannelModels(channel)}>
                                                            拉取模型
                                                        </Button>
                                                    ) : null}
                                                    <Button size="small" danger icon={<Trash2 className="size-3.5" />} onClick={() => deleteChannel(channel.id)} />
                                                </div>
                                            </div>
                                            <div className="grid gap-4 md:grid-cols-2">
                                                <Form.Item label="渠道名称" className="mb-0">
                                                    <Input value={channel.name} onChange={(event) => updateChannel(channel.id, { name: event.target.value })} />
                                                </Form.Item>
                                                <Form.Item label="调用格式" className="mb-0">
                                                    <Select value={channel.apiFormat} options={apiFormatOptions} onChange={(value: ApiCallFormat) => updateChannelApiFormat(channel, value)} />
                                                </Form.Item>
                                                <Form.Item label="Base URL" className="mb-0">
                                                    <Input value={channel.baseUrl} onChange={(event) => updateChannel(channel.id, { baseUrl: event.target.value })} />
                                                </Form.Item>
                                                <Form.Item label="Key" className="mb-0">
                                                    <Input.Password value={channel.apiKey} onChange={(event) => updateChannel(channel.id, { apiKey: event.target.value })} />
                                                </Form.Item>
                                                <Form.Item label="模型列表" className="mb-0 md:col-span-2">
                                                    {channel.apiFormat === "newtoken" ? (
                                                        <div className="mb-2 flex justify-end">
                                                            <Button size="small" onClick={() => updateChannel(channel.id, { models: newTokenVideoModels })}>
                                                                填入 NewToken 视频模型
                                                            </Button>
                                                        </div>
                                                    ) : null}
                                                    {channel.apiFormat === "openai-json" ? (
                                                        <div className="mb-2 flex justify-end">
                                                            <Button size="small" onClick={() => updateChannel(channel.id, { models: caiVideoModels })}>
                                                                填入 Cai 视频模型
                                                            </Button>
                                                        </div>
                                                    ) : null}
                                                    {channel.apiFormat === "duomiapi" ? (
                                                        <div className="mb-2 flex justify-end">
                                                            <Button size="small" onClick={() => updateChannel(channel.id, { models: duomiModels })}>
                                                                恢复 Duomi 已适配模型
                                                            </Button>
                                                        </div>
                                                    ) : null}
                                                    {channel.apiFormat === "lingdongapi" ? (
                                                        <div className="mb-2 flex justify-end">
                                                            <Button size="small" onClick={() => updateChannel(channel.id, { models: lingdongModels })}>
                                                                恢复 Lingdong 已适配模型
                                                            </Button>
                                                        </div>
                                                    ) : null}
                                                    <Select mode="tags" showSearch allowClear maxTagCount="responsive" placeholder="输入模型名，或点击拉取模型" value={channel.models} onChange={(models) => updateChannel(channel.id, { models })} />
                                                </Form.Item>
                                            </div>
                                        </section>
                                    ))}
                                </div>
                            </Form>
                        ),
                    },
                    {
                        key: "models",
                        label: "模型",
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <div className="mb-4 rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold">模型用途配置</div>
                                            <div className="mt-1 text-xs leading-5 text-stone-500">先在“渠道”里维护模型列表，再在这里按图片、视频、文本、音频分配可选项和默认值。</div>
                                        </div>
                                        <div className="rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-600 dark:bg-stone-900 dark:text-stone-400">渠道模型 {config.models.length} 个</div>
                                    </div>
                                    {config.channels.some((channel) => channel.apiFormat === "duomiapi" || channel.apiFormat === "lingdongapi") ? <div className="mt-2 text-xs leading-5 text-stone-500">Duomi / Lingdong 暂使用已适配模型列表，不需要拉取模型；如果可选项缺失，可回到“渠道”恢复已适配模型。</div> : null}
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    {modelGroups.map((group) => (
                                        <section key={group.modelsKey} className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                            <div className="mb-3">
                                                <div className="text-sm font-semibold">{group.title}</div>
                                                <div className="mt-1 text-xs text-stone-500">{group.hint}</div>
                                            </div>
                                            <Form.Item label={group.defaultLabel} className="mb-3">
                                                <ModelPicker config={config} value={config[group.modelKey]} onChange={(model) => updateConfig(group.modelKey, model)} capability={group.capability} fullWidth />
                                            </Form.Item>
                                            <Form.Item label={group.optionsLabel} className="mb-0">
                                                <Select
                                                    mode="tags"
                                                    showSearch
                                                    allowClear
                                                    maxTagCount="responsive"
                                                    placeholder={config.models.length ? `请选择或输入${group.optionsLabel}` : "先到渠道里填写或恢复已适配模型"}
                                                    value={filterModelsByCapability(config[group.modelsKey], group.capability)}
                                                    options={modelOptionsFor(group.capability)}
                                                    onChange={(models) => updateCapabilityModels(group, models)}
                                                />
                                            </Form.Item>
                                        </section>
                                    ))}
                                </div>
                            </Form>
                        ),
                    },
                    {
                        key: "preferences",
                        label: "生成偏好",
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <div className="grid gap-4 md:grid-cols-4">
                                    <Form.Item label="AI 请求代理" extra="如果你的中转渠道没有配置 CORS 跨域（表现为“读取模型失败”或无法生成），请开启此选项通过 Next.js 服务端进行请求转发。" className="mb-4 md:col-span-4">
                                        <Segmented
                                            block
                                            value={config.aiProxyEnabled ? "proxy" : "direct"}
                                            onChange={(value) => updateConfig("aiProxyEnabled", value === "proxy")}
                                            options={[
                                                { label: "浏览器直连 (需要渠道支持 CORS 跨域)", value: "direct" },
                                                { label: "Next.js 服务端转发 (解决跨域/403错误)", value: "proxy" },
                                            ]}
                                        />
                                    </Form.Item>
                                    <Form.Item label="画布默认生图张数" extra="新建画布生图和配置节点默认使用，单个节点仍可单独覆盖。" className="mb-4">
                                        <Input
                                            type="number"
                                            min={1}
                                            max={15}
                                            value={config.canvasImageCount}
                                            onChange={(event) => updateConfig("canvasImageCount", event.target.value)}
                                            onBlur={(event) => updateConfig("canvasImageCount", normalizeImageCount(event.target.value))}
                                        />
                                    </Form.Item>
                                    <Form.Item label="默认音频声音" className="mb-4">
                                        <Select value={config.audioVoice} options={audioVoiceOptions} onChange={(value) => updateConfig("audioVoice", value)} />
                                    </Form.Item>
                                    <Form.Item label="默认音频格式" className="mb-4">
                                        <Select value={config.audioFormat} options={audioFormatOptions} onChange={(value) => updateConfig("audioFormat", value)} />
                                    </Form.Item>
                                    <Form.Item label="默认音频语速" className="mb-4">
                                        <Input
                                            type="number"
                                            min={0.25}
                                            max={4}
                                            step={0.05}
                                            value={config.audioSpeed}
                                            onChange={(event) => updateConfig("audioSpeed", event.target.value)}
                                            onBlur={(event) => updateConfig("audioSpeed", normalizeAudioSpeedValue(event.target.value))}
                                        />
                                    </Form.Item>
                                </div>
                                <Form.Item label="默认音频指令" className="mb-4">
                                    <Input.TextArea rows={2} value={config.audioInstructions} placeholder="例如：自然、温暖、适合旁白。" onChange={(event) => updateConfig("audioInstructions", event.target.value)} />
                                </Form.Item>
                                <Form.Item label="系统提示词" className="mb-0">
                                    <Input.TextArea rows={4} value={config.systemPrompt} placeholder="例如：你是一位擅长电影感写实摄影的视觉导演。" onChange={(event) => updateConfig("systemPrompt", event.target.value)} />
                                </Form.Item>
                            </Form>
                        ),
                    },
                    {
                        key: "webdav",
                        label: "WebDAV",
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <section className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2 text-sm font-semibold">
                                                <Cloud className="size-4" />
                                                WebDAV 同步
                                            </div>
                                            <div className="mt-1 text-xs text-stone-500">同步画布、我的素材、生成记录和本地媒体文件，不包含 AI Key；服务不支持 CORS 时可走 Next.js 转发。</div>
                                        </div>
                                        <div className="text-xs text-stone-500">{webdav.lastSyncedAt ? `上次同步 ${formatWebdavTime(webdav.lastSyncedAt)}` : "尚未同步"}</div>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <Form.Item label="连接方式" className="mb-4 md:col-span-2">
                                            <Segmented
                                                block
                                                value={webdav.proxyMode}
                                                onChange={(value) => updateWebdavConfig("proxyMode", value as typeof webdav.proxyMode)}
                                                options={[
                                                    { label: "前端直连", value: "direct" },
                                                    { label: "Next.js 转发", value: "nextjs" },
                                                ]}
                                            />
                                        </Form.Item>
                                        <Form.Item label="WebDAV 地址" className="mb-4">
                                            <Input value={webdav.url} placeholder="https://nas.example.com/webdav" onChange={(event) => updateWebdavConfig("url", event.target.value)} />
                                        </Form.Item>
                                        <Form.Item label="远程目录" extra={`会在该目录下分业务目录保存，每个目录包含 ${WEBDAV_MANIFEST_FILE_NAME} 和 files/`} className="mb-4">
                                            <Input value={webdav.directory} placeholder="infinite-canvas" onChange={(event) => updateWebdavConfig("directory", event.target.value)} />
                                        </Form.Item>
                                        <Form.Item label="用户名" className="mb-0">
                                            <Input value={webdav.username} autoComplete="username" onChange={(event) => updateWebdavConfig("username", event.target.value)} />
                                        </Form.Item>
                                        <Form.Item label="密码 / 应用密码" className="mb-0">
                                            <Input.Password value={webdav.password} autoComplete="current-password" onChange={(event) => updateWebdavConfig("password", event.target.value)} />
                                        </Form.Item>
                                    </div>
                                    <div className="mt-4 flex flex-wrap items-center gap-2">
                                        <Button icon={<Wifi className="size-4" />} disabled={!webdavReady || syncingWebdav} loading={testingWebdav} onClick={() => void testWebdav()}>
                                            测试连接
                                        </Button>
                                        <Button type="primary" icon={<RefreshCw className="size-4" />} disabled={!webdavReady || testingWebdav} loading={syncingWebdav} onClick={() => void syncWebdav()}>
                                            {syncingWebdav ? "同步中" : "立即同步"}
                                        </Button>
                                        {webdavSyncStatus ? <span className="text-xs text-stone-500">{webdavSyncStatus}</span> : null}
                                    </div>
                                    {syncingWebdav || webdavSyncStatus ? <WebdavProgressGrid progress={webdavDomainProgress} /> : null}
                                </section>
                            </Form>
                        ),
                    },
                ]}
            />
        </Modal>
    );
}

function withChannels(config: AiConfig, channels: ModelChannel[]): AiConfig {
    const models = modelOptionsFromChannels(channels);
    const imageModels = keepOrSuggest(config.imageModels, filterModelsByCapability(models, "image"), models, "image");
    const videoModels = keepOrSuggest(config.videoModels, filterModelsByCapability(models, "video"), models, "video");
    const textModels = keepOrSuggest(config.textModels, filterModelsByCapability(models, "text"), models, "text");
    const audioModels = keepOrSuggest(config.audioModels, filterModelsByCapability(models, "audio"), models, "audio");
    return {
        ...config,
        channels,
        models,
        baseUrl: channels[0]?.baseUrl || config.baseUrl,
        apiKey: channels[0]?.apiKey || config.apiKey,
        apiFormat: channels[0]?.apiFormat || config.apiFormat,
        imageModels,
        videoModels,
        textModels,
        audioModels,
        imageModel: normalizeDefaultModel(config.imageModel, imageModels),
        videoModel: normalizeDefaultModel(config.videoModel, videoModels),
        textModel: normalizeDefaultModel(config.textModel, textModels),
        audioModel: normalizeDefaultModel(config.audioModel, audioModels),
    };
}

function keepOrSuggest(current: string[], suggested: string[], allModels: string[], capability: ModelCapability) {
    const available = new Set(allModels);
    const kept = uniqueModels(current).filter((model) => available.has(model) && filterModelsByCapability([model], capability).length);
    return kept.length ? kept : suggested;
}

function normalizeDefaultModel(value: string, options: string[]) {
    if (options.includes(value)) return value;
    return options[0] || value;
}

function normalizeImageCount(value: string) {
    return String(Math.max(1, Math.min(15, Math.floor(Math.abs(Number(value)) || 3))));
}

function uniqueModels(models: string[]) {
    return Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)));
}

function apiFormatLabel(apiFormat: ApiCallFormat) {
    if (apiFormat === "gemini") return "Gemini";
    if (apiFormat === "volcengine") return "Volcengine Seedance";
    if (apiFormat === "openai-json") return "Cai";
    if (apiFormat === "newtoken") return "NewToken";
    if (apiFormat === "duomiapi") return "Duomi";
    if (apiFormat === "lingdongapi") return "Lingdong";
    return "OpenAI";
}

function formatWebdavTime(value: string) {
    return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function WebdavProgressGrid({ progress }: { progress: Record<AppSyncDomainKey, WebdavDomainProgress> }) {
    return (
        <div className="mt-3 grid gap-2">
            {webdavDomainKeys.map((key) => {
                const item = progress[key];
                const count = item.total ? `${item.current || 0}/${item.total}` : "";
                return (
                    <div key={key} className="rounded-md border border-stone-200 px-3 py-2 dark:border-stone-800">
                        <div className="mb-1 flex min-w-0 items-center justify-between gap-3 text-xs">
                            <span className="shrink-0 font-medium text-stone-700 dark:text-stone-200">{item.label}</span>
                            <span className="min-w-0 truncate text-right text-stone-500">
                                {item.stage}
                                {count ? ` · ${count}` : ""}
                            </span>
                        </div>
                        <Progress percent={getWebdavProgressPercent(item)} size="small" status={getWebdavProgressStatus(item)} showInfo={false} />
                    </div>
                );
            })}
        </div>
    );
}

function getWebdavProgressPercent(item: WebdavDomainProgress) {
    if (item.status === "success") return 100;
    if (item.total) return Math.min(100, Math.round(((item.current || 0) / item.total) * 100));
    if (item.status === "exception") return 100;
    if (item.stage === "等待同步") return 0;
    if (item.stage === "读取远端清单") return 12;
    if (item.stage === "读取本地数据") return 24;
    if (item.stage === "下载缺失媒体") return 36;
    if (item.stage === "写入本地合并结果") return 58;
    if (item.stage === "上传新增媒体") return 66;
    if (item.stage === "媒体已齐全" || item.stage === "媒体无需上传") return 74;
    if (item.stage.startsWith("上传清单")) return 90;
    return item.status === "active" ? 30 : 0;
}

function getWebdavProgressStatus(item: WebdavDomainProgress): "normal" | "active" | "success" | "exception" {
    if (item.status === "success" || item.status === "exception") return item.status;
    return item.status === "active" ? "active" : "normal";
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
