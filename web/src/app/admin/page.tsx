import { Activity, AlertTriangle, AudioLines, Building2, CheckCircle2, Coins, CreditCard, Crown, Gauge, Globe2, ImageIcon, KeyRound, LockKeyhole, LogOut, MessageSquareText, Package, ReceiptText, RefreshCw, Settings2, ShieldAlert, ShieldCheck, Sparkles, UserRoundPlus, Users, Video, WalletCards, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, App, Avatar, Button, Dropdown, Modal, Progress, Select, Tag } from "antd";
import { ModalForm, PageContainer, ProCard, ProForm, ProFormDigit, ProFormRadio, ProFormSelect, ProFormSwitch, ProFormText, ProFormTextArea, ProLayout, ProTable, type ActionType, type ProColumns, type ProFormInstance } from "@ant-design/pro-components";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { memberRequest, type AIChannel, type AIUsageLog, type DashboardStats, type GenerationPrice, type MemberUser, type PointLedger, type PointPackage, type PaymentSettings, type GeneralSettings } from "@/services/api/membership";
import { useMemberStore } from "@/stores/use-member-store";
import { useThemeStore } from "@/stores/use-theme-store";

const menus = [
    { path: "/admin", name: "数据概览", icon: <Gauge className="size-4" /> },
    { path: "/admin/users", name: "用户管理", icon: <Users className="size-4" /> },
    { path: "/admin/packages", name: "积分套餐", icon: <Package className="size-4" /> },
    { path: "/admin/prices", name: "模型计价", icon: <Sparkles className="size-4" /> },
    { path: "/admin/channels", name: "模型渠道", icon: <KeyRound className="size-4" /> },
    { path: "/admin/usage-logs", name: "使用日志", icon: <Activity className="size-4" /> },
    { path: "/admin/orders", name: "充值订单", icon: <ReceiptText className="size-4" /> },
    { path: "/admin/ledger", name: "积分流水", icon: <WalletCards className="size-4" /> },
    { path: "/admin/settings/payment", name: "支付配置", icon: <Settings2 className="size-4" /> },
    { path: "/admin/settings/general", name: "其他设置", icon: <Settings2 className="size-4" /> },
];

export default function AdminPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const user = useMemberStore((state) => state.user);
    const logout = useMemberStore((state) => state.logout);
    const theme = useThemeStore((state) => state.theme);
    const setTheme = useThemeStore((state) => state.setTheme);
    if (!user) return <Navigate to={`/auth?redirect=${encodeURIComponent(location.pathname)}`} replace />;
    if (user.role !== "admin") return <Navigate to="/" replace />;

    return (
        <div className="h-dvh overflow-hidden bg-[#f4f5f7] dark:bg-[#090a0c]">
            <ProLayout
                title="C-AI 控制台"
                logo={<span className="grid size-8 place-items-center rounded-lg bg-amber-400 text-black"><Crown className="size-4" /></span>}
                location={{ pathname: location.pathname }}
                route={{ path: "/admin", routes: menus }}
                menuItemRender={(item, dom) => <button type="button" className="w-full text-left" onClick={() => navigate(item.path || "/admin")}>{dom}</button>}
                token={{ header: { colorBgHeader: "var(--ant-color-bg-container)" }, sider: { colorMenuBackground: "var(--ant-color-bg-container)" } }}
                actionsRender={() => [<AnimatedThemeToggler key="theme" theme={theme} onThemeChange={setTheme} className="inline-flex size-8 items-center justify-center rounded-md text-stone-500 transition hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-white" aria-label={theme === "dark" ? "切换到白色模式" : "切换到深色模式"} title={theme === "dark" ? "切换到白色模式" : "切换到深色模式"} />]}
                avatarProps={{
                    src: <Avatar className="!bg-amber-400 !text-black">{user.nickname.slice(0, 1)}</Avatar>,
                    title: user.nickname,
                    render: (_, dom) => <Dropdown menu={{ items: [{ key: "home", label: "返回创作平台", onClick: () => navigate("/") }, { type: "divider" }, { key: "logout", danger: true, icon: <LogOut className="size-4" />, label: "退出登录", onClick: () => { logout(); navigate("/auth"); } }] }}>{dom}</Dropdown>,
                }}
                layout="mix"
                fixedHeader
                fixSiderbar
            >
                <AdminContent path={location.pathname} />
            </ProLayout>
        </div>
    );
}

function AdminContent({ path }: { path: string }) {
    if (path === "/admin/users") return <UsersPage />;
    if (path === "/admin/packages") return <PackagesPage />;
    if (path === "/admin/prices") return <PricesPage />;
    if (path === "/admin/channels") return <ChannelsPage />;
    if (path === "/admin/usage-logs") return <UsageLogsPage />;
    if (path === "/admin/orders") return <EmptyModule title="充值订单" description="支付渠道接入后，这里展示待支付、已支付和已关闭订单。" />;
    if (path === "/admin/ledger") return <LedgerPage />;
    if (path === "/admin/settings/payment") return <PaymentSettingsPage />;
    if (path === "/admin/settings/general") return <GeneralSettingsPage />;
    return <DashboardPage />;
}

function UsageLogsPage() {
    const columns: ProColumns<AIUsageLog>[] = [
        { title: "时间", dataIndex: "createdAt", render: (value) => new Date(String(value)).toLocaleString("zh-CN", { hour12: false }) },
        { title: "模型", dataIndex: "model", render: (value) => value || "-" },
        { title: "接口", dataIndex: "path", ellipsis: true },
        { title: "状态", dataIndex: "status", render: (value) => <Tag color={Number(value) >= 200 && Number(value) < 400 ? "green" : "red"}>{String(value || "网络失败")}</Tag> },
        { title: "耗时", dataIndex: "durationMs", render: (value) => `${Number(value || 0)} ms` },
        { title: "错误摘要", dataIndex: "error", ellipsis: true },
    ];
    return <PageContainer title="使用日志" subTitle="记录模型请求路径、状态与耗时；不会保存 API Key、请求正文或完整上游地址"><ProTable<AIUsageLog> rowKey="id" columns={columns} search={false} request={async () => ({ data: await memberRequest<AIUsageLog[]>("/api/admin/usage-logs?limit=200"), success: true })} /></PageContainer>;
}

function DashboardPage() {
    const navigate = useNavigate();
    const [days, setDays] = useState<7 | 30>(7);
    const { data, isFetching, refetch } = useQuery({ queryKey: ["admin-dashboard", days], queryFn: () => memberRequest<DashboardStats>(`/api/admin/dashboard?days=${days}`) });
    const { data: channels = [] } = useQuery({ queryKey: ["admin-dashboard-channels"], queryFn: () => memberRequest<AIChannel[]>("/api/admin/channels") });
    const { data: prices = [] } = useQuery({ queryKey: ["admin-dashboard-prices"], queryFn: () => memberRequest<GenerationPrice[]>("/api/admin/prices") });
    const { data: payment } = useQuery({ queryKey: ["admin-dashboard-payment"], queryFn: () => memberRequest<PaymentSettings>("/api/admin/settings/payment") });
    const channelModels = channels.flatMap((channel) => channel.models);
    const pricedModels = new Set(prices.filter((price) => price.enabled).map((price) => price.model));
    const pricedChannelModels = channelModels.filter((model) => pricedModels.has(model));
    const configuredChannels = channels.filter((channel) => channel.enabled && channel.apiKeyConfigured);
    const issues = [
        ...(channels.filter((channel) => channel.enabled && !channel.apiKeyConfigured).map((channel) => ({ text: `${channel.name} 尚未配置 API Key`, path: "/admin/channels" }))),
        ...(channelModels.filter((model) => !pricedModels.has(model)).slice(0, 3).map((model) => ({ text: `${model} 尚未设置计价`, path: "/admin/prices" }))),
        ...(payment && !payment.enabled ? [{ text: "积分充值未启用", path: "/admin/settings/payment" }] : []),
    ];
    const maxRevenue = Math.max(...(data?.trend || []).map((item) => item.revenueCent), 1);
    const totalPointsFlow = (data?.pointsIssued || 0) + (data?.pointsSpent || 0);
    const formatMoney = (cent: number) => `¥${(cent / 100).toFixed(2)}`;
    const formatDate = (value: string) => value.slice(5).replace("-", "/");
    return (
        <PageContainer title="数据概览" subTitle="业务经营、积分流转与上游配置状态" extra={<div className="flex items-center gap-2"><div className="flex rounded-lg border border-[var(--ant-color-border)] p-0.5"><Button type={days === 7 ? "primary" : "text"} size="small" onClick={() => setDays(7)}>近 7 天</Button><Button type={days === 30 ? "primary" : "text"} size="small" onClick={() => setDays(30)}>近 30 天</Button></div><Button icon={<RefreshCw className="size-4" />} loading={isFetching} onClick={() => void refetch()}>刷新</Button></div>}>
            <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {[{ label: "今日收入", value: formatMoney(data?.todayRevenueCent || 0), note: `${data?.todayPaidOrders || 0} 笔已支付`, color: "text-emerald-600" }, { label: "今日新增用户", value: `${data?.todayUsers || 0}`, note: `累计 ${data?.users || 0} 人`, color: "text-sky-600" }, { label: "待支付订单", value: `${data?.pendingOrders || 0}`, note: "需要跟进的订单", color: "text-orange-600" }, { label: "积分余额", value: `${data?.totalPoints || 0}`, note: "全站会员余额", color: "text-amber-600" }, { label: "累计收入", value: formatMoney(data?.revenueCent || 0), note: `${data?.paidOrders || 0} 笔已支付`, color: "text-violet-600" }].map((item) => <div key={item.label} className="rounded-xl border border-[var(--ant-color-border-secondary)] bg-[var(--ant-color-bg-container)] px-4 py-4"><div className="text-sm text-[var(--ant-color-text-secondary)]">{item.label}</div><div className={`mt-2 text-2xl font-semibold ${item.color}`}>{item.value}</div><div className="mt-1 text-xs text-[var(--ant-color-text-tertiary)]">{item.note}</div></div>)}
            </div>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
                <ProCard title="收入与充值趋势" subTitle={`按自然日统计，${days} 天范围`} bordered>
                    <div className="flex h-56 items-end gap-1.5 sm:gap-2">{(data?.trend || []).map((item) => <div key={item.date} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><div className="relative flex h-44 w-full items-end justify-center"><div className="w-full max-w-8 rounded-t-md bg-amber-400 transition-all group-hover:bg-amber-500" style={{ height: `${Math.max(item.revenueCent ? (item.revenueCent / maxRevenue) * 100 : 3, 3)}%` }} title={`${item.date} ${formatMoney(item.revenueCent)}`} /></div><div className="truncate text-[10px] text-[var(--ant-color-text-tertiary)]">{days === 7 || item.date.endsWith("-01") ? formatDate(item.date) : ""}</div></div>)}</div>
                    <div className="mt-3 flex items-center gap-4 text-xs text-[var(--ant-color-text-secondary)]"><span><i className="mr-1 inline-block size-2 rounded-full bg-amber-400" />每日收入</span><span>合计 {formatMoney((data?.trend || []).reduce((sum, item) => sum + item.revenueCent, 0))}</span><span>订单 {(data?.trend || []).reduce((sum, item) => sum + item.paidOrders, 0)} 笔</span></div>
                </ProCard>
                <ProCard title="积分健康度" subTitle="近期开支与发放" bordered>
                    <div className="mb-4 flex items-center justify-between"><div><div className="text-3xl font-semibold">{data?.totalPoints || 0}</div><div className="text-xs text-[var(--ant-color-text-secondary)]">当前流通积分</div></div><Coins className="size-8 text-amber-500" /></div>
                    <div className="space-y-3"><div><div className="mb-1 flex justify-between text-xs"><span>发放积分</span><span>{data?.pointsIssued || 0}</span></div><Progress percent={totalPointsFlow ? Math.round(((data?.pointsIssued || 0) / totalPointsFlow) * 100) : 0} showInfo={false} strokeColor="#10b981" /></div><div><div className="mb-1 flex justify-between text-xs"><span>消耗积分</span><span>{data?.pointsSpent || 0}</span></div><Progress percent={totalPointsFlow ? Math.round(((data?.pointsSpent || 0) / totalPointsFlow) * 100) : 0} showInfo={false} strokeColor="#f59e0b" /></div><div className="flex justify-between border-t border-[var(--ant-color-border-secondary)] pt-3 text-xs text-[var(--ant-color-text-secondary)]"><span>人工调整</span><span>{data?.pointsAdjusted || 0}</span></div></div>
                </ProCard>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <ProCard title="上游接口可用性" subTitle="配置层检查；真实成功率和延迟监控尚未接入" bordered extra={<Button type="link" onClick={() => navigate("/admin/channels")}>管理渠道</Button>}>
                    <div className="mb-4 grid grid-cols-3 gap-3"><div className="rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-950/20"><div className="text-xs text-emerald-700 dark:text-emerald-300">可用渠道</div><div className="mt-1 text-xl font-semibold text-emerald-700 dark:text-emerald-300">{configuredChannels.length}/{channels.length}</div></div><div className="rounded-lg bg-sky-50 px-3 py-2 dark:bg-sky-950/20"><div className="text-xs text-sky-700 dark:text-sky-300">模型总数</div><div className="mt-1 text-xl font-semibold text-sky-700 dark:text-sky-300">{channelModels.length}</div></div><div className="rounded-lg bg-violet-50 px-3 py-2 dark:bg-violet-950/20"><div className="text-xs text-violet-700 dark:text-violet-300">计价覆盖</div><div className="mt-1 text-xl font-semibold text-violet-700 dark:text-violet-300">{channelModels.length ? `${Math.round((pricedChannelModels.length / channelModels.length) * 100)}%` : "-"}</div></div></div>
                    <div className="space-y-2">{channels.length ? channels.slice(0, 5).map((channel) => <div key={channel.id} className="flex items-center justify-between border-t border-[var(--ant-color-border-secondary)] py-2.5"><div className="flex min-w-0 items-center gap-2"><span className={`size-2 rounded-full ${channel.enabled && channel.apiKeyConfigured ? "bg-emerald-500" : channel.enabled ? "bg-orange-400" : "bg-stone-300"}`} /><span className="truncate text-sm">{channel.name}</span><span className="text-xs text-[var(--ant-color-text-tertiary)]">{channel.models.length} 个模型</span></div><Tag color={channel.enabled && channel.apiKeyConfigured ? "green" : channel.enabled ? "orange" : "default"}>{channel.enabled && channel.apiKeyConfigured ? "配置正常" : channel.enabled ? "缺少密钥" : "已停用"}</Tag></div>) : <div className="py-6 text-center text-sm text-[var(--ant-color-text-secondary)]">暂无上游渠道，请先添加模型渠道</div>}</div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-[var(--ant-color-text-tertiary)]"><Activity className="size-3.5" />接口成功率、P95 延迟将在生成任务日志接入后显示</div>
                </ProCard>
                <ProCard title="需要处理" subTitle="按影响优先级列出配置问题" bordered>
                    {issues.length ? <div className="space-y-1">{issues.slice(0, 6).map((issue, index) => <button key={`${issue.path}-${index}`} type="button" onClick={() => navigate(issue.path)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition hover:bg-[var(--ant-color-fill-quaternary)]"><AlertTriangle className="size-4 shrink-0 text-orange-500" /><span className="min-w-0 flex-1 truncate text-sm">{issue.text}</span><span className="text-xs text-[var(--ant-color-text-tertiary)]">处理</span></button>)}</div> : <div className="flex min-h-36 flex-col items-center justify-center gap-2 text-center text-sm text-[var(--ant-color-text-secondary)]"><CheckCircle2 className="size-7 text-emerald-500" />当前没有待处理配置</div>}
                </ProCard>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <ProCard title="套餐表现" subTitle="近期开通收入排名" bordered extra={<Button type="link" onClick={() => navigate("/admin/packages")}>管理套餐</Button>}>
                    {data?.packages?.length ? <div className="space-y-3">{data.packages.map((item, index) => <div key={item.name} className="flex items-center gap-3"><span className="w-5 text-center text-xs font-semibold text-[var(--ant-color-text-tertiary)]">{index + 1}</span><div className="min-w-0 flex-1"><div className="flex justify-between gap-3 text-sm"><span className="truncate">{item.name}</span><span className="font-medium">{formatMoney(item.revenueCent)}</span></div><div className="mt-1 text-xs text-[var(--ant-color-text-tertiary)]">{item.paidOrders} 笔已支付</div></div></div>)}</div> : <div className="py-8 text-center text-sm text-[var(--ant-color-text-secondary)]">所选时间范围暂无成交数据</div>}
                </ProCard>
                <ProCard title="监控说明" subTitle="当前数据的可信边界" bordered>
                    <div className="space-y-3 text-sm text-[var(--ant-color-text-secondary)]"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" /><span>用户、订单、积分和渠道配置均来自服务端实时数据库。</span></div><div className="flex gap-3"><XCircle className="mt-0.5 size-4 shrink-0 text-stone-400" /><span>上游生成成功率、响应时间、错误分类暂未统计，不显示虚假百分比。</span></div><div className="flex gap-3"><RefreshCw className="mt-0.5 size-4 shrink-0 text-sky-500" /><span>刷新按钮只重新拉取当前范围数据，不会触发上游生成请求。</span></div></div>
                </ProCard>
            </div>
        </PageContainer>
    );
}

function UsersPage() {
    const { message } = App.useApp();
    const actionRef = useRef<ActionType>(null);
    const [adjusting, setAdjusting] = useState<MemberUser | null>(null);
    const columns: ProColumns<MemberUser>[] = [
        { title: "用户 ID", dataIndex: "id", width: 90, hideInSearch: true, render: (value) => <span className="font-mono text-xs text-[var(--ant-color-text-secondary)]">{shortUserId(String(value))}</span> },
        { title: "用户", dataIndex: "nickname", render: (_, row) => <div><div className="font-medium">{row.nickname}</div><div className="text-xs text-stone-400">{row.email}</div></div> },
        { title: "角色", dataIndex: "role", hideInSearch: true, render: (_, row) => <Tag color={row.role === "admin" ? "gold" : "default"}>{row.role === "admin" ? "管理员" : "会员"}</Tag> },
        { title: "积分余额", dataIndex: "points", hideInSearch: true, render: (_, row) => <span className="font-semibold text-amber-600">{row.points}</span> },
        { title: "状态", dataIndex: "status", hideInSearch: true, render: (_, row) => <Tag color={row.status === "active" ? "green" : "red"}>{row.status === "active" ? "正常" : "禁用"}</Tag> },
        { title: "注册时间", dataIndex: "createdAt", valueType: "dateTime", hideInSearch: true },
        { title: "操作", valueType: "option", render: (_, row) => [<Button key="points" type="link" onClick={() => setAdjusting(row)}>积分调账</Button>, <Button key="status" type="link" danger={row.status === "active"} onClick={async () => { await memberRequest(`/api/admin/users/${row.id}/status`, { method: "PATCH", body: JSON.stringify({ status: row.status === "active" ? "disabled" : "active" }) }); message.success(row.status === "active" ? "用户已禁用" : "用户已启用"); actionRef.current?.reload(); }}>{row.status === "active" ? "禁用" : "启用"}</Button>] },
    ];
    return (
        <PageContainer title="用户管理" subTitle="查看会员状态并执行可审计的积分调整">
            <ProTable<MemberUser>
                rowKey="id" actionRef={actionRef} columns={columns}
                request={async ({ current, pageSize, nickname }) => {
                    const data = await memberRequest<{ list: MemberUser[]; total: number }>(`/api/admin/users?page=${current || 1}&pageSize=${pageSize || 20}&keyword=${encodeURIComponent(String(nickname || ""))}`);
                    return { data: data.list, total: data.total, success: true };
                }}
                search={{ labelWidth: "auto" }} pagination={{ defaultPageSize: 20 }}
            />
            <ModalForm<{ amount: number; remark: string }> title={`积分调账 · ${adjusting?.nickname || ""}`} open={Boolean(adjusting)} onOpenChange={(open) => !open && setAdjusting(null)} modalProps={{ destroyOnHidden: true }} onFinish={async (values) => {
                if (!adjusting) return false;
                await memberRequest(`/api/admin/users/${adjusting.id}/points`, { method: "POST", body: JSON.stringify({ ...values, idempotencyKey: crypto.randomUUID() }) });
                message.success("积分调整成功"); setAdjusting(null); actionRef.current?.reload(); return true;
            }}>
                <ProFormDigit name="amount" label="变动积分" tooltip="正数充值，负数扣减" rules={[{ required: true }]} fieldProps={{ precision: 0 }} />
                <ProFormText name="remark" label="调整原因" rules={[{ required: true, message: "请填写调整原因" }]} />
            </ModalForm>
        </PageContainer>
    );
}

function shortUserId(id: string) {
    if (/^\d{5}$/.test(id)) return id;
    let hash = 7;
    for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return String(hash % 100000).padStart(5, "0");
}

function PackagesPage() {
    const { message } = App.useApp();
    const actionRef = useRef<ActionType>(null);
    const [editing, setEditing] = useState<PointPackage | null>(null);
    const columns: ProColumns<PointPackage>[] = [
        { title: "套餐名称", dataIndex: "name" }, { title: "积分", dataIndex: "points", hideInSearch: true },
        { title: "售价", dataIndex: "priceCent", hideInSearch: true, render: (_, row) => `¥${(row.priceCent / 100).toFixed(2)}` },
        { title: "状态", dataIndex: "enabled", hideInSearch: true, render: (_, row) => <Tag color={row.enabled ? "green" : "default"}>{row.enabled ? "上架" : "下架"}</Tag> },
        { title: "排序", dataIndex: "sort", hideInSearch: true }, { title: "操作", valueType: "option", render: (_, row) => <Button type="link" onClick={() => setEditing(row)}>编辑</Button> },
    ];
    return <PageContainer title="积分套餐" subTitle="配置会员可购买的积分商品"><ProTable<PointPackage> rowKey="id" actionRef={actionRef} columns={columns} search={false} request={async () => ({ data: await memberRequest<PointPackage[]>("/api/admin/packages"), success: true })} toolBarRender={() => [<Button key="new" type="primary" onClick={() => setEditing({ id: "", name: "", points: 100, priceCent: 1000, enabled: true, sort: 0 })}>新建套餐</Button>]} />
        <ModalForm<PointPackage> title={editing?.id ? "编辑套餐" : "新建套餐"} open={Boolean(editing)} initialValues={editing || undefined} modalProps={{ destroyOnHidden: true }} onOpenChange={(open) => !open && setEditing(null)} onFinish={async (values) => { await memberRequest("/api/admin/packages", { method: "POST", body: JSON.stringify({ ...editing, ...values }) }); message.success("套餐已保存"); setEditing(null); actionRef.current?.reload(); return true; }}>
            <ProFormText name="name" label="套餐名称" rules={[{ required: true }]} /><ProFormDigit name="points" label="积分数量" min={1} fieldProps={{ precision: 0 }} rules={[{ required: true }]} /><ProFormDigit name="priceCent" label="价格（分）" min={1} fieldProps={{ precision: 0 }} rules={[{ required: true }]} /><ProFormDigit name="sort" label="排序" fieldProps={{ precision: 0 }} /><ProFormSwitch name="enabled" label="上架" />
        </ModalForm></PageContainer>;
}

function PricesPage() {
    const { message } = App.useApp(); const actionRef = useRef<ActionType>(null); const [editing, setEditing] = useState<GenerationPrice | null>(null); const { data: channels = [] } = useQuery({ queryKey: ["admin-price-channels"], queryFn: () => memberRequest<AIChannel[]>("/api/admin/channels") }); const modelOptions = channels.filter((channel) => channel.enabled).flatMap((channel) => channel.models.map((model) => ({ label: `${model}（${channel.name}）`, value: model }))).filter((option, index, all) => all.findIndex((item) => item.value === option.value) === index);
    const columns: ProColumns<GenerationPrice>[] = [{ title: "模型", dataIndex: "model" }, { title: "类型", dataIndex: "mediaType", valueEnum: { image: "图片", video: "视频", text: "文本", audio: "音频" } }, { title: "每次积分", dataIndex: "points", hideInSearch: true }, { title: "状态", dataIndex: "enabled", hideInSearch: true, render: (_, row) => <Tag color={row.enabled ? "green" : "default"}>{row.enabled ? "启用" : "停用"}</Tag> }, { title: "操作", valueType: "option", render: (_, row) => <Button type="link" onClick={() => setEditing(row)}>编辑</Button> }];
    return <PageContainer title="模型计价" subTitle="生成扣费只读取服务端启用的价格"><ProTable<GenerationPrice> rowKey="id" actionRef={actionRef} columns={columns} request={async ({ model, mediaType }) => { const rows = await memberRequest<GenerationPrice[]>("/api/admin/prices"); const list = rows.filter((row) => (!model || row.model.toLowerCase().includes(String(model).toLowerCase())) && (!mediaType || row.mediaType === mediaType)); return { data: list, success: true }; }} toolBarRender={() => [<Button key="new" type="primary" onClick={() => setEditing({ id: "", model: "", mediaType: "image", points: 1, enabled: true })}>新增计价</Button>]} />
        <ModalForm<GenerationPrice> title={editing?.id ? "编辑计价" : "新增计价"} open={Boolean(editing)} initialValues={editing || undefined} modalProps={{ destroyOnHidden: true }} onOpenChange={(open) => !open && setEditing(null)} onFinish={async (values) => { await memberRequest("/api/admin/prices", { method: "POST", body: JSON.stringify({ ...editing, ...values }) }); message.success("计价已保存"); setEditing(null); actionRef.current?.reload(); return true; }}><ProFormSelect name="model" label="模型 ID" showSearch options={modelOptions} fieldProps={{ allowClear: true }} rules={[{ required: true, message: modelOptions.length ? "请选择已配置渠道中的模型" : "请先在创作平台配置渠道并拉取模型" }]} /><ProFormSelect name="mediaType" label="生成类型" options={[{ label: "图片", value: "image" }, { label: "视频", value: "video" }, { label: "文本", value: "text" }, { label: "音频", value: "audio" }]} rules={[{ required: true }]} /><ProFormDigit name="points" label="单次积分" min={1} fieldProps={{ precision: 0 }} rules={[{ required: true }]} /><ProFormSwitch name="enabled" label="启用" /></ModalForm></PageContainer>;
}

function ChannelsPage() {
    const { message } = App.useApp();
    const actionRef = useRef<ActionType>(null);
    const [editing, setEditing] = useState<(AIChannel & { apiKey?: string }) | null>(null);
    const [probing, setProbing] = useState<{ channel: AIChannel; type: "text" | "image" } | null>(null);
    const [probeModel, setProbeModel] = useState("");
    const fetchModels = async (channel: AIChannel) => {
        try {
            const models = await memberRequest<string[]>(`/api/admin/channels/${channel.id}/fetch-models`, { method: "POST" });
            message.success(`${channel.name} 已获取 ${models.length} 个模型`);
            actionRef.current?.reload();
            return models;
        } catch (error) {
            message.error(error instanceof Error ? error.message : "模型拉取失败");
            throw error;
        }
    };
    const columns: ProColumns<AIChannel>[] = [
        { title: "渠道", dataIndex: "name", render: (_, row) => <div><div className="font-medium">{row.name}</div><div className="mt-1 max-w-96 truncate font-mono text-xs text-[var(--ant-color-text-tertiary)]">{row.baseUrl}</div></div> },
        { title: "密钥", dataIndex: "apiKeyConfigured", hideInSearch: true, render: (_, row) => <Tag color={row.apiKeyConfigured ? "green" : "red"}>{row.apiKeyConfigured ? "已配置" : "未配置"}</Tag> },
        { title: "模型", dataIndex: "models", hideInSearch: true, render: (_, row) => <div><div className="font-medium">{row.models.length} 个</div><div className="max-w-52 truncate text-xs text-[var(--ant-color-text-tertiary)]">{row.models.slice(0, 3).join(" · ") || "尚未拉取"}</div></div> },
        { title: "状态", dataIndex: "enabled", hideInSearch: true, render: (_, row) => <Tag color={row.enabled ? "green" : "default"}>{row.enabled ? "启用" : "停用"}</Tag> },
        { title: "操作", valueType: "option", render: (_, row) => [<Button key="fetch" type="link" disabled={!row.apiKeyConfigured} onClick={() => void fetchModels(row)}>{row.models.length ? "重新拉取" : "拉取模型"}</Button>, <Button key="text" type="link" disabled={!row.models.length || !row.apiKeyConfigured} onClick={() => { setProbeModel(row.models[0] || ""); setProbing({ channel: row, type: "text" }); }}>测文本</Button>, <Button key="image" type="link" disabled={!row.models.length || !row.apiKeyConfigured} onClick={() => { setProbeModel(row.models[0] || ""); setProbing({ channel: row, type: "image" }); }}>测图片</Button>, <Button key="edit" type="link" onClick={() => setEditing(row)}>编辑</Button>, <Button key="delete" danger type="link" onClick={async () => { await memberRequest(`/api/admin/channels/${row.id}`, { method: "DELETE" }); message.success("渠道已删除"); actionRef.current?.reload(); }}>删除</Button>] },
    ];
    return <PageContainer title="模型渠道" subTitle="保存渠道后自动拉取模型；密钥只保存在服务端" extra={<Button type="primary" icon={<KeyRound className="size-4" />} onClick={() => setEditing({ id: "", name: "", baseUrl: "", models: [], enabled: true, apiKeyConfigured: false })}>新增渠道</Button>}>
        <div className="mb-4 grid gap-3 md:grid-cols-3"><div className="rounded-lg border border-[var(--ant-color-border-secondary)] bg-[var(--ant-color-bg-container)] px-4 py-3"><div className="text-xs text-[var(--ant-color-text-secondary)]">1. 填写连接信息</div><div className="mt-1 font-medium">名称、Base URL 与 API Key</div></div><div className="rounded-lg border border-[var(--ant-color-border-secondary)] bg-[var(--ant-color-bg-container)] px-4 py-3"><div className="text-xs text-[var(--ant-color-text-secondary)]">2. 保存并拉取模型</div><div className="mt-1 font-medium">自动匹配 `/models` 与 `/v1/models`</div></div><div className="rounded-lg border border-[var(--ant-color-border-secondary)] bg-[var(--ant-color-bg-container)] px-4 py-3"><div className="text-xs text-[var(--ant-color-text-secondary)]">3. 配置模型计价</div><div className="mt-1 font-medium">仅已计价模型可用于扣费</div></div></div>
        <ProTable<AIChannel> rowKey="id" actionRef={actionRef} columns={columns} search={false} request={async () => ({ data: await memberRequest<AIChannel[]>("/api/admin/channels"), success: true })} />
        <ModalForm<(AIChannel & { apiKey?: string })> title={editing?.id ? "编辑模型渠道" : "新增模型渠道"} open={Boolean(editing)} initialValues={editing || undefined} modalProps={{ destroyOnHidden: true }} onOpenChange={(open) => !open && setEditing(null)} submitter={{ searchConfig: { submitText: "保存并拉取模型" } }} onFinish={async (values) => {
            const channel = await memberRequest<AIChannel>("/api/admin/channels", { method: "POST", body: JSON.stringify({ ...editing, ...values }) });
            try { await fetchModels(channel); } catch { message.warning("渠道已保存，但模型未拉取成功；请修正连接信息后点击“重新拉取”"); }
            setEditing(null); actionRef.current?.reload(); return true;
        }}>
            <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-100">可填写域名根地址或带 <code>/v1</code> 的 OpenAI 兼容地址。系统会自动探测 <code>/models</code> 与 <code>/v1/models</code>，并保存可用的最终地址。</div>
            <ProFormText name="name" label="渠道名称" placeholder="例如：主力生产渠道" rules={[{ required: true, message: "请输入渠道名称" }]} />
            <ProFormText name="baseUrl" label="Base URL" placeholder="https://api.example.com/v1" rules={[{ required: true, message: "请输入 Base URL" }, { type: "url", message: "请输入完整 URL" }]} />
            <ProFormText name="apiKey" label={editing?.apiKeyConfigured ? "API Key（已配置，留空保持不变）" : "API Key"} fieldProps={{ type: "password", autoComplete: "new-password" }} rules={editing?.apiKeyConfigured ? [] : [{ required: true, message: "请输入 API Key" }]} />
            <ProFormSwitch name="enabled" label="立即启用" tooltip="启用后拉取到的模型会同步到用户端可选模型列表" />
        </ModalForm>
        <Modal title={probing?.type === "image" ? "图片模型探测" : "文本模型探测"} open={Boolean(probing)} okText="开始测试" cancelText="取消" confirmLoading={false} onCancel={() => setProbing(null)} onOk={async () => { if (!probing || !probeModel) return; const started = Date.now(); try { const result = await memberRequest<{ status: number; durationMs: number }>(`/api/admin/channels/${probing.channel.id}/probe`, { method: "POST", body: JSON.stringify({ model: probeModel, mediaType: probing.type }) }); message.success(`探测成功 · HTTP ${result.status} · ${result.durationMs || Date.now() - started}ms`); setProbing(null); } catch (error) { message.error(error instanceof Error ? error.message : "模型探测失败"); } }}>
            <div className="mb-2 text-sm text-[var(--ant-color-text-secondary)]">仅发送最小测试请求，不保存生成内容。</div>
            <Select className="w-full" showSearch value={probeModel} onChange={setProbeModel} options={probing?.channel.models.map((model) => ({ label: model, value: model })) || []} />
        </Modal>
    </PageContainer>;
}

type PaymentSettingsForm = PaymentSettings & { privateKey?: string; publicKey?: string };

function PaymentSettingsPage() {
    const { message } = App.useApp();
    const formRef = useRef<ProFormInstance<PaymentSettingsForm>>(null);
    const [saving, setSaving] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const { data, error, isFetching, refetch } = useQuery({ queryKey: ["admin-payment-settings"], queryFn: () => memberRequest<PaymentSettings>("/api/admin/settings/payment") });
    if (!data) return <PageContainer title="支付配置" subTitle="平台收款渠道与签名凭据">{error ? <ProCard><div className="grid min-h-52 place-items-center text-center"><div><div className="font-medium">支付配置加载失败</div><div className="mt-1 text-sm text-[var(--ant-color-text-secondary)]">{error.message}</div><Button className="mt-4" loading={isFetching} onClick={() => void refetch()}>重新加载</Button></div></div></ProCard> : <ProCard loading />}</PageContainer>;

    const identityReady = Boolean(data.orgId && data.mno && data.subMechId);
    const keysReady = data.privateKeyConfigured && data.publicKeyConfigured;
    const summaries = [
        { label: "渠道状态", value: data.enabled ? "收款已启用" : "收款未启用", note: data.enabled ? "用户可发起积分充值" : "用户无法创建支付订单" },
        { label: "当前环境", value: data.sandbox ? "沙箱环境" : "生产环境", note: data.sandbox ? "用于联调，不产生真实交易" : "将产生真实资金交易" },
        { label: "配置完整度", value: identityReady && keysReady ? "配置完整" : "需要补充", note: `商户信息${identityReady ? "已完成" : "未完成"} · 密钥${keysReady ? "已完成" : "未完成"}` },
    ];

    const savePayment = async () => {
        if (!formRef.current || saving) return;
        setSaving(true);
        setSaveFeedback(null);
        try {
            const values = await formRef.current.validateFields();
            await memberRequest("/api/admin/settings/payment", { method: "PUT", body: JSON.stringify(values) });
            message.success("支付配置保存成功");
            setSaveFeedback({ type: "success", message: "支付配置已保存，服务端配置已立即生效。" });
            await refetch();
        } catch (saveError) {
            const errorMessage = saveError instanceof Error ? saveError.message : "请检查必填项后重试";
            message.error(errorMessage);
            setSaveFeedback({ type: "error", message: `保存失败：${errorMessage}` });
        } finally {
            setSaving(false);
        }
    };

    return (
        <PageContainer title="支付配置" subTitle="统一管理随行付 / TianQue 收款渠道，所有凭据仅保存在服务端" extra={<Button type="primary" size="large" loading={saving} onClick={() => void savePayment()}>保存支付配置</Button>}>
            {saveFeedback ? <Alert className="mb-4" showIcon closable type={saveFeedback.type} message={saveFeedback.message} onClose={() => setSaveFeedback(null)} /> : null}
            <div className="mb-5 grid gap-3 md:grid-cols-3">
                {summaries.map((item) => <div key={item.label} className="rounded-xl border border-[var(--ant-color-border-secondary)] bg-[var(--ant-color-bg-container)] px-5 py-4"><div className="text-xs text-[var(--ant-color-text-secondary)]">{item.label}</div><div className="mt-1 text-lg font-semibold text-[var(--ant-color-text)]">{item.value}</div><div className="mt-1 text-xs text-[var(--ant-color-text-tertiary)]">{item.note}</div></div>)}
            </div>
            <ProForm<PaymentSettingsForm>
                formRef={formRef}
                key={JSON.stringify(data)}
                initialValues={data}
                submitter={false}
                onFinish={async () => true}
            >
                <ProCard title={<span className="inline-flex items-center gap-2"><CreditCard className="size-4" />渠道状态与环境</span>} subTitle="建议先在沙箱完成下单和回调验证，再切换生产环境" bordered>
                    <div className="grid items-start gap-5 lg:grid-cols-[1fr_2fr]">
                        <div className="rounded-lg border border-[var(--ant-color-border-secondary)] bg-[var(--ant-color-fill-quaternary)] px-4 py-3"><div className="flex items-center justify-between gap-4"><div><div className="font-medium">启用积分充值</div><div className="mt-1 text-xs text-[var(--ant-color-text-secondary)]">关闭后保留配置，但停止创建新订单</div></div><ProFormSwitch name="enabled" /></div></div>
                        <ProFormRadio.Group name="sandbox" label="运行环境" options={[{ label: "沙箱环境", value: true }, { label: "生产环境", value: false }]} fieldProps={{ optionType: "button", buttonStyle: "solid" }} />
                    </div>
                    <div className="mt-4 border-t border-[var(--ant-color-border-secondary)] pt-4"><div className="mb-3"><div className="font-medium">启用支付方式</div><div className="mt-1 text-xs text-[var(--ant-color-text-secondary)]">用户充值页只会展示已开启的方式；服务端同步拦截关闭方式的下单请求。</div></div><div className="grid gap-3 md:grid-cols-2"><div className="flex items-center justify-between rounded-lg border border-[var(--ant-color-border-secondary)] px-4 py-3"><div><div className="font-medium">微信支付</div><div className="mt-1 text-xs text-[var(--ant-color-text-secondary)]">扫码使用微信完成支付</div></div><ProFormSwitch name="wechatEnabled" /></div><div className="flex items-center justify-between rounded-lg border border-[var(--ant-color-border-secondary)] px-4 py-3"><div><div className="font-medium">支付宝</div><div className="mt-1 text-xs text-[var(--ant-color-text-secondary)]">扫码使用支付宝完成支付</div></div><ProFormSwitch name="alipayEnabled" /></div></div></div>
                    {!data.sandbox ? <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-100"><ShieldAlert className="mr-2 inline size-4" />当前保存的是生产环境，启用后会产生真实交易。</div> : null}
                </ProCard>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <ProCard title={<span className="inline-flex items-center gap-2"><Building2 className="size-4" />商户身份</span>} subTitle="由随行付服务商提供，三项信息需保持一致" bordered>
                        <ProFormText name="orgId" label="机构号（orgId）" placeholder="请输入机构号" rules={[{ required: true, message: "请输入机构号" }]} />
                        <ProFormText name="mno" label="商户号（mno）" placeholder="请输入商户号" rules={[{ required: true, message: "请输入商户号" }]} />
                        <ProFormText name="subMechId" label="子商户号（subMechId）" placeholder="请输入子商户号" rules={[{ required: true, message: "请输入子商户号" }]} />
                    </ProCard>
                    <ProCard title={<span className="inline-flex items-center gap-2"><Globe2 className="size-4" />网关与协议</span>} subTitle="分别配置联调、正式网关与异步通知地址" bordered>
                        <ProFormText name="host" label="沙箱网关" rules={[{ required: true }, { type: "url", message: "请输入完整 URL" }]} />
                        <ProFormText name="productionHost" label="生产网关" rules={[{ required: true }, { type: "url", message: "请输入完整 URL" }]} />
                        <ProFormText name="notifyUrl" label="支付回调地址" tooltip="必须是随行付服务器可访问的公网 HTTPS 地址" rules={[{ required: true }, { type: "url", message: "请输入完整 URL" }]} />
                        <div className="grid gap-x-4 md:grid-cols-2"><ProFormSelect name="signType" label="签名算法" options={["RSA", "RSA2"].map((value) => ({ label: value, value }))} rules={[{ required: true }]} /><ProFormText name="version" label="接口版本" rules={[{ required: true }]} /></div>
                    </ProCard>
                </div>

                <ProCard className="mt-4" title={<span className="inline-flex items-center gap-2"><LockKeyhole className="size-4" />签名密钥</span>} subTitle="密钥不会返回浏览器；留空保存表示继续使用现有密钥" bordered extra={<span className="inline-flex gap-2"><Tag color={data.privateKeyConfigured ? "green" : "red"}>商户私钥{data.privateKeyConfigured ? "已配置" : "未配置"}</Tag><Tag color={data.publicKeyConfigured ? "green" : "red"}>平台公钥{data.publicKeyConfigured ? "已配置" : "未配置"}</Tag></span>}>
                    <div className="mb-4 flex gap-2 rounded-lg border border-[var(--ant-color-border-secondary)] bg-[var(--ant-color-fill-quaternary)] px-4 py-3 text-sm text-[var(--ant-color-text-secondary)]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" /><span>系统只记录密钥是否已配置，不会在页面、接口响应或日志中显示密钥明文。</span></div>
                    <div className="grid gap-x-4 xl:grid-cols-2">
                        <ProFormTextArea name="privateKey" label="商户私钥" placeholder={data.privateKeyConfigured ? "已配置；如不更换请保持为空" : "粘贴 RSA 商户私钥（支持 PEM 或 Base64）"} fieldProps={{ autoSize: { minRows: 5, maxRows: 10 }, spellCheck: false }} />
                        <ProFormTextArea name="publicKey" label="随行付平台公钥" placeholder={data.publicKeyConfigured ? "已配置；如不更换请保持为空" : "粘贴随行付平台公钥（支持 PEM 或 Base64）"} fieldProps={{ autoSize: { minRows: 5, maxRows: 10 }, spellCheck: false }} />
                    </div>
                </ProCard>
            </ProForm>
        </PageContainer>
    );
}

function GeneralSettingsPage() {
    const { message } = App.useApp();
    const { data, refetch } = useQuery({ queryKey: ["admin-general-settings"], queryFn: () => memberRequest<GeneralSettings>("/api/admin/settings/general") });
    if (!data) return <PageContainer title="其他设置" subTitle="平台级策略与默认值"><ProCard loading /></PageContainer>;

    const summaries = [
        { label: "注册入口", value: data.registrationEnabled ? "已开放" : "已关闭", note: `新用户赠送 ${data.registrationGiftPoints} 积分` },
        { label: "登录有效期", value: `${data.tokenTtlHours} 小时`, note: "修改后对新签发登录生效" },
        { label: "系统状态", value: data.maintenanceMode ? "维护中" : "运行正常", note: data.maintenanceMode ? "用户服务已受限" : "用户服务正常开放" },
    ];

    return (
        <PageContainer title="其他设置" subTitle="管理注册策略、积分默认值与平台运行状态">
            <div className="mb-5 grid gap-3 md:grid-cols-3">
                {summaries.map((item) => <div key={item.label} className="rounded-xl border border-[var(--ant-color-border-secondary)] bg-[var(--ant-color-bg-container)] px-5 py-4"><div className="text-xs text-[var(--ant-color-text-secondary)]">{item.label}</div><div className="mt-1 text-lg font-semibold text-[var(--ant-color-text)]">{item.value}</div><div className="mt-1 text-xs text-[var(--ant-color-text-tertiary)]">{item.note}</div></div>)}
            </div>
            <ProForm<GeneralSettings>
                key={JSON.stringify(data)}
                initialValues={data}
                submitter={{ searchConfig: { submitText: "保存全部设置" }, resetButtonProps: false, submitButtonProps: { size: "large", type: "primary" } }}
                onFinish={async (values) => { await memberRequest("/api/admin/settings/general", { method: "PUT", body: JSON.stringify(values) }); message.success("平台设置已保存"); await refetch(); return true; }}
            >
                <div className="grid gap-4 xl:grid-cols-2">
                    <ProCard title={<span className="inline-flex items-center gap-2"><UserRoundPlus className="size-4" />账号与注册</span>} subTitle="控制新会员入口和初始权益" bordered>
                        <ProFormSwitch name="registrationEnabled" label="开放用户注册" tooltip="关闭后仅影响新用户注册，已有账号仍可登录" />
                        <div className="grid gap-x-4 md:grid-cols-2">
                            <ProFormDigit name="registrationGiftPoints" label="注册赠送积分" min={0} max={1000000} fieldProps={{ precision: 0, className: "w-full" }} extra="新账号创建成功后自动发放" />
                            <ProFormDigit name="tokenTtlHours" label="登录有效期" min={1} max={8760} fieldProps={{ precision: 0, addonAfter: "小时", className: "w-full" }} extra="只影响之后签发的登录凭证" />
                        </div>
                    </ProCard>
                    <ProCard title={<span className="inline-flex items-center gap-2"><Coins className="size-4" />默认生成积分</span>} subTitle="未设置模型专属价格时使用" bordered>
                        <div className="grid gap-x-4 md:grid-cols-2">
                            <ProFormDigit name="defaultImagePoints" label={<span className="inline-flex items-center gap-1.5"><ImageIcon className="size-3.5" />图片生成</span>} min={1} fieldProps={{ precision: 0, addonAfter: "积分", className: "w-full" }} />
                            <ProFormDigit name="defaultVideoPoints" label={<span className="inline-flex items-center gap-1.5"><Video className="size-3.5" />视频生成</span>} min={1} fieldProps={{ precision: 0, addonAfter: "积分", className: "w-full" }} />
                            <ProFormDigit name="defaultTextPoints" label={<span className="inline-flex items-center gap-1.5"><MessageSquareText className="size-3.5" />文本生成</span>} min={1} fieldProps={{ precision: 0, addonAfter: "积分", className: "w-full" }} />
                            <ProFormDigit name="defaultAudioPoints" label={<span className="inline-flex items-center gap-1.5"><AudioLines className="size-3.5" />音频生成</span>} min={1} fieldProps={{ precision: 0, addonAfter: "积分", className: "w-full" }} />
                        </div>
                    </ProCard>
                </div>
                <ProCard className="mt-4" title={<span className="inline-flex items-center gap-2"><ShieldAlert className="size-4" />运行与维护</span>} subTitle="高风险操作，请确认公告和恢复方案后再开启" bordered>
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-900/60 dark:bg-orange-950/20">
                        <div><div className="font-medium text-orange-950 dark:text-orange-100">平台维护模式</div><div className="mt-1 text-xs text-orange-800/70 dark:text-orange-200/60">开启后限制普通用户使用业务功能，管理员后台保持可访问。</div></div>
                        <ProFormSwitch name="maintenanceMode" noStyle />
                    </div>
                </ProCard>
            </ProForm>
        </PageContainer>
    );
}

function LedgerPage() {
    const columns: ProColumns<PointLedger>[] = [
        { title: "时间", dataIndex: "createdAt", valueType: "dateTime" },
        { title: "用户 ID", dataIndex: "userId", render: (value) => <span className="font-mono text-xs text-[var(--ant-color-text-secondary)]">{shortUserId(String(value))}</span> },
        { title: "类型", dataIndex: "type" },
        { title: "变动", dataIndex: "amount", render: (_, row) => <span className={row.amount >= 0 ? "text-emerald-600" : "text-red-500"}>{row.amount >= 0 ? "+" : ""}{row.amount}</span> },
        { title: "变动后余额", dataIndex: "balanceAfter" },
        { title: "备注", dataIndex: "remark" },
    ];
    return <PageContainer title="积分流水" subTitle="全站积分变动记录，支持审计追踪"><ProTable<PointLedger> rowKey="id" columns={columns} search={false} request={async () => ({ data: await memberRequest<PointLedger[]>("/api/admin/ledger"), success: true })} pagination={{ defaultPageSize: 50 }} /></PageContainer>;
}

function EmptyModule({ title, description }: { title: string; description: string }) {
    return <PageContainer title={title}><div className="grid min-h-[360px] place-items-center rounded-2xl border border-dashed border-stone-300 bg-white text-center dark:border-stone-700 dark:bg-stone-900"><div><div className="text-lg font-semibold">{title}</div><p className="mt-2 text-sm text-stone-500">{description}</p></div></div></PageContainer>;
}
