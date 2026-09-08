import { AudioLines, Building2, Coins, CreditCard, Crown, Gauge, Globe2, ImageIcon, KeyRound, LockKeyhole, LogOut, MessageSquareText, Package, ReceiptText, Settings2, ShieldAlert, ShieldCheck, Sparkles, UserRoundPlus, Users, Video, WalletCards } from "lucide-react";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { App, Avatar, Button, Dropdown, Tag } from "antd";
import { ModalForm, PageContainer, ProCard, ProForm, ProFormDigit, ProFormRadio, ProFormSelect, ProFormSwitch, ProFormText, ProFormTextArea, ProLayout, ProTable, StatisticCard, type ActionType, type ProColumns } from "@ant-design/pro-components";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { memberRequest, type AIChannel, type DashboardStats, type GenerationPrice, type MemberUser, type PointLedger, type PointPackage, type PaymentSettings, type GeneralSettings } from "@/services/api/membership";
import { useMemberStore } from "@/stores/use-member-store";
import { useThemeStore } from "@/stores/use-theme-store";

const menus = [
    { path: "/admin", name: "数据概览", icon: <Gauge className="size-4" /> },
    { path: "/admin/users", name: "用户管理", icon: <Users className="size-4" /> },
    { path: "/admin/packages", name: "积分套餐", icon: <Package className="size-4" /> },
    { path: "/admin/prices", name: "模型计价", icon: <Sparkles className="size-4" /> },
    { path: "/admin/channels", name: "模型渠道", icon: <KeyRound className="size-4" /> },
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
    if (path === "/admin/orders") return <EmptyModule title="充值订单" description="支付渠道接入后，这里展示待支付、已支付和已关闭订单。" />;
    if (path === "/admin/ledger") return <LedgerPage />;
    if (path === "/admin/settings/payment") return <PaymentSettingsPage />;
    if (path === "/admin/settings/general") return <GeneralSettingsPage />;
    return <DashboardPage />;
}

function DashboardPage() {
    const { data } = useQuery({ queryKey: ["admin-dashboard"], queryFn: () => memberRequest<DashboardStats>("/api/admin/dashboard") });
    return (
        <PageContainer title="数据概览" subTitle="会员、积分与收入的实时摘要">
            <div className="mb-5 overflow-hidden rounded-2xl bg-[#17181b] p-7 text-white shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[.22em] text-amber-300">Operations overview</div>
                <div className="mt-3 text-2xl font-semibold tracking-tight">每一笔积分，都能追溯到用户、订单或生成任务。</div>
                <div className="mt-2 text-sm text-white/45">当前为会员系统基础阶段，支付与生成扣费将在后续模块启用。</div>
            </div>
            <StatisticCard.Group direction="row">
                <StatisticCard statistic={{ title: "注册用户", value: data?.users || 0, suffix: "人" }} />
                <StatisticCard statistic={{ title: "流通积分", value: data?.totalPoints || 0, suffix: "积分" }} />
                <StatisticCard statistic={{ title: "已支付订单", value: data?.paidOrders || 0, suffix: "笔" }} />
                <StatisticCard statistic={{ title: "累计收入", value: (data?.revenueCent || 0) / 100, prefix: "¥", precision: 2 }} />
            </StatisticCard.Group>
        </PageContainer>
    );
}

function UsersPage() {
    const { message } = App.useApp();
    const actionRef = useRef<ActionType>(null);
    const [adjusting, setAdjusting] = useState<MemberUser | null>(null);
    const columns: ProColumns<MemberUser>[] = [
        { title: "用户", dataIndex: "nickname", render: (_, row) => <div><div className="font-medium">{row.nickname}</div><div className="text-xs text-stone-400">{row.email}</div></div> },
        { title: "角色", dataIndex: "role", hideInSearch: true, render: (_, row) => <Tag color={row.role === "admin" ? "gold" : "default"}>{row.role === "admin" ? "管理员" : "会员"}</Tag> },
        { title: "积分余额", dataIndex: "points", hideInSearch: true, render: (_, row) => <span className="font-semibold text-amber-600">{row.points}</span> },
        { title: "状态", dataIndex: "status", hideInSearch: true, render: (_, row) => <Tag color={row.status === "active" ? "green" : "red"}>{row.status === "active" ? "正常" : "禁用"}</Tag> },
        { title: "注册时间", dataIndex: "createdAt", valueType: "dateTime", hideInSearch: true },
        { title: "操作", valueType: "option", render: (_, row) => <Button type="link" onClick={() => setAdjusting(row)}>积分调账</Button> },
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

function ChannelsPage() { const { message }=App.useApp(); const actionRef=useRef<ActionType>(null); const [editing,setEditing]=useState<(AIChannel & { apiKey?:string })|null>(null); const columns:ProColumns<AIChannel>[]=[{title:"渠道",dataIndex:"name",render:(_,row)=><div><div className="font-medium">{row.name}</div><div className="text-xs text-stone-400">{row.baseUrl}</div></div>},{title:"密钥",dataIndex:"apiKeyConfigured",hideInSearch:true,render:(_,row)=><Tag color={row.apiKeyConfigured?"green":"red"}>{row.apiKeyConfigured?"已配置":"未配置"}</Tag>},{title:"模型数",dataIndex:"models",hideInSearch:true,render:(_,row)=>row.models.length},{title:"状态",dataIndex:"enabled",hideInSearch:true,render:(_,row)=><Tag color={row.enabled?"green":"default"}>{row.enabled?"启用":"停用"}</Tag>},{title:"操作",valueType:"option",render:(_,row)=>[<Button key="fetch" type="link" onClick={async()=>{ const models=await memberRequest<string[]>(`/api/admin/channels/${row.id}/fetch-models`,{method:"POST"}); message.success(`已获取 ${models.length} 个模型`); actionRef.current?.reload(); }}>获取模型</Button>,<Button key="edit" type="link" onClick={()=>setEditing(row)}>编辑</Button>,<Button key="delete" danger type="link" onClick={async()=>{ await memberRequest(`/api/admin/channels/${row.id}`,{method:"DELETE"}); message.success("渠道已删除"); actionRef.current?.reload(); }}>删除</Button>]}]; return <PageContainer title="模型渠道" subTitle="统一托管上游密钥，普通用户无法查看或修改"><ProTable<AIChannel> rowKey="id" actionRef={actionRef} columns={columns} search={false} request={async()=>({data:await memberRequest<AIChannel[]>("/api/admin/channels"),success:true})} toolBarRender={()=>[<Button key="new" type="primary" onClick={()=>setEditing({id:"",name:"",baseUrl:"",models:[],enabled:true,apiKeyConfigured:false})}>新增渠道</Button>]}/><ModalForm title={editing?.id?"编辑模型渠道":"新增模型渠道"} open={Boolean(editing)} initialValues={editing||undefined} modalProps={{destroyOnHidden:true}} onOpenChange={(open)=>!open&&setEditing(null)} onFinish={async(values)=>{ await memberRequest("/api/admin/channels",{method:"POST",body:JSON.stringify({...editing,...values})}); message.success("渠道已保存"); setEditing(null); actionRef.current?.reload(); return true; }}><ProFormText name="name" label="渠道名称" rules={[{required:true}]}/><ProFormText name="baseUrl" label="Base URL" rules={[{required:true,type:"url"}]}/><ProFormText name="apiKey" label={editing?.apiKeyConfigured?"API Key（已配置，留空保持不变）":"API Key"} fieldProps={{type:"password"}} rules={editing?.apiKeyConfigured?[]:[{required:true}]}/><ProFormSwitch name="enabled" label="启用"/></ModalForm></PageContainer> }

type PaymentSettingsForm = PaymentSettings & { privateKey?: string; publicKey?: string };

function PaymentSettingsPage() {
    const { message } = App.useApp();
    const { data, error, isFetching, refetch } = useQuery({ queryKey: ["admin-payment-settings"], queryFn: () => memberRequest<PaymentSettings>("/api/admin/settings/payment") });
    if (!data) return <PageContainer title="支付配置" subTitle="平台收款渠道与签名凭据">{error ? <ProCard><div className="grid min-h-52 place-items-center text-center"><div><div className="font-medium">支付配置加载失败</div><div className="mt-1 text-sm text-[var(--ant-color-text-secondary)]">{error.message}</div><Button className="mt-4" loading={isFetching} onClick={() => void refetch()}>重新加载</Button></div></div></ProCard> : <ProCard loading />}</PageContainer>;

    const identityReady = Boolean(data.orgId && data.mno && data.subMechId);
    const keysReady = data.privateKeyConfigured && data.publicKeyConfigured;
    const summaries = [
        { label: "渠道状态", value: data.enabled ? "收款已启用" : "收款未启用", note: data.enabled ? "用户可发起积分充值" : "用户无法创建支付订单" },
        { label: "当前环境", value: data.sandbox ? "沙箱环境" : "生产环境", note: data.sandbox ? "用于联调，不产生真实交易" : "将产生真实资金交易" },
        { label: "配置完整度", value: identityReady && keysReady ? "配置完整" : "需要补充", note: `商户信息${identityReady ? "已完成" : "未完成"} · 密钥${keysReady ? "已完成" : "未完成"}` },
    ];

    return (
        <PageContainer title="支付配置" subTitle="统一管理随行付 / TianQue 收款渠道，所有凭据仅保存在服务端">
            <div className="mb-5 grid gap-3 md:grid-cols-3">
                {summaries.map((item) => <div key={item.label} className="rounded-xl border border-[var(--ant-color-border-secondary)] bg-[var(--ant-color-bg-container)] px-5 py-4"><div className="text-xs text-[var(--ant-color-text-secondary)]">{item.label}</div><div className="mt-1 text-lg font-semibold text-[var(--ant-color-text)]">{item.value}</div><div className="mt-1 text-xs text-[var(--ant-color-text-tertiary)]">{item.note}</div></div>)}
            </div>
            <ProForm<PaymentSettingsForm>
                key={JSON.stringify(data)}
                initialValues={data}
                submitter={{ searchConfig: { submitText: "保存支付配置" }, resetButtonProps: false, submitButtonProps: { size: "large", type: "primary" } }}
                onFinish={async (values) => { await memberRequest("/api/admin/settings/payment", { method: "PUT", body: JSON.stringify(values) }); message.success("支付配置已安全保存"); await refetch(); return true; }}
            >
                <ProCard title={<span className="inline-flex items-center gap-2"><CreditCard className="size-4" />渠道状态与环境</span>} subTitle="建议先在沙箱完成下单和回调验证，再切换生产环境" bordered>
                    <div className="grid items-start gap-5 lg:grid-cols-[1fr_2fr]">
                        <div className="rounded-lg border border-[var(--ant-color-border-secondary)] bg-[var(--ant-color-fill-quaternary)] px-4 py-3"><div className="flex items-center justify-between gap-4"><div><div className="font-medium">启用积分充值</div><div className="mt-1 text-xs text-[var(--ant-color-text-secondary)]">关闭后保留配置，但停止创建新订单</div></div><ProFormSwitch name="enabled" noStyle /></div></div>
                        <ProFormRadio.Group name="sandbox" label="运行环境" options={[{ label: "沙箱环境", value: true }, { label: "生产环境", value: false }]} fieldProps={{ optionType: "button", buttonStyle: "solid" }} />
                    </div>
                    <div className="mt-4 border-t border-[var(--ant-color-border-secondary)] pt-4"><div className="mb-3"><div className="font-medium">启用支付方式</div><div className="mt-1 text-xs text-[var(--ant-color-text-secondary)]">用户充值页只会展示已开启的方式；服务端同步拦截关闭方式的下单请求。</div></div><div className="grid gap-3 md:grid-cols-2"><div className="flex items-center justify-between rounded-lg border border-[var(--ant-color-border-secondary)] px-4 py-3"><div><div className="font-medium">微信支付</div><div className="mt-1 text-xs text-[var(--ant-color-text-secondary)]">扫码使用微信完成支付</div></div><ProFormSwitch name="wechatEnabled" noStyle /></div><div className="flex items-center justify-between rounded-lg border border-[var(--ant-color-border-secondary)] px-4 py-3"><div><div className="font-medium">支付宝</div><div className="mt-1 text-xs text-[var(--ant-color-text-secondary)]">扫码使用支付宝完成支付</div></div><ProFormSwitch name="alipayEnabled" noStyle /></div></div></div>
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
        { title: "用户 ID", dataIndex: "userId", ellipsis: true },
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
