import { ArrowLeft, CheckCircle2, ChevronRight, Coins, Copy, CreditCard, LogOut, ReceiptText, RefreshCw, ShieldCheck, Sparkles, UserRound, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { App, Avatar, Button, Card, Empty, Modal, Segmented, Spin, Tag, Tooltip } from "antd";
import { Navigate, useNavigate } from "react-router-dom";

import { createRechargeOrder, getMember, getMemberLedger, getPaymentOptions, getPointPackages, type PointLedger } from "@/services/api/membership";
import { useMemberStore } from "@/stores/use-member-store";

type PayMethod = "WECHAT" | "ALIPAY";
type LedgerFilter = "all" | "income" | "expense";

function formatDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

function paymentLabel(value: PayMethod) { return value === "WECHAT" ? "微信支付" : "支付宝"; }

export default function AccountPage() {
    const navigate = useNavigate();
    const { message } = App.useApp();
    const member = useMemberStore((state) => state.user);
    const setUser = useMemberStore((state) => state.setUser);
    const logout = useMemberStore((state) => state.logout);
    const [payMethod, setPayMethod] = useState<PayMethod>("WECHAT");
    const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>("all");
    const [payingPackage, setPayingPackage] = useState<string | null>(null);
    const [qr, setQr] = useState<{ orderNo: string; qrCode: string } | null>(null);

    const me = useQuery({ queryKey: ["member-me"], queryFn: getMember, enabled: Boolean(member) });
    const ledger = useQuery({ queryKey: ["member-ledger"], queryFn: getMemberLedger, enabled: Boolean(member) });
    const packages = useQuery({ queryKey: ["point-packages"], queryFn: getPointPackages, enabled: Boolean(member) });
    const paymentOptions = useQuery({ queryKey: ["payment-options"], queryFn: getPaymentOptions, enabled: Boolean(member) });
    useEffect(() => { if (me.data) setUser(me.data); }, [me.data, setUser]);

    const enabledMethods = paymentOptions.data?.methods || [];
    useEffect(() => { if (enabledMethods.length && !enabledMethods.includes(payMethod)) setPayMethod(enabledMethods[0]); }, [enabledMethods, payMethod]);
    const currentPoints = me.data?.points ?? member?.points ?? 0;
    const ledgerRows = ledger.data || [];
    const income = useMemo(() => ledgerRows.filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0), [ledgerRows]);
    const expense = useMemo(() => ledgerRows.filter((row) => row.amount < 0).reduce((sum, row) => sum + Math.abs(row.amount), 0), [ledgerRows]);
    const filteredLedger = ledgerRows.filter((row) => ledgerFilter === "all" || (ledgerFilter === "income" ? row.amount >= 0 : row.amount < 0));

    if (!member) return <Navigate to="/auth?redirect=/account" replace />;

    const refreshAccount = async () => { await Promise.all([me.refetch(), ledger.refetch(), paymentOptions.refetch()]); };
    const startPay = async (packageId: string) => {
        if (!enabledMethods.length) { message.warning("当前暂未开放在线支付"); return; }
        setPayingPackage(packageId);
        try { setQr(await createRechargeOrder(packageId, payMethod)); } catch (error) { message.error(error instanceof Error ? error.message : "创建支付订单失败"); } finally { setPayingPackage(null); }
    };
    const completePayment = async () => { setQr(null); await refreshAccount(); message.info("已刷新账户状态，到账以支付回调为准"); };

    return <main className="min-h-full overflow-y-auto bg-[#f5f5f3] px-4 py-5 dark:bg-[#101112] sm:px-6 sm:py-8"><div className="mx-auto max-w-6xl">
        <header className="mb-7 flex items-center justify-between"><Button type="text" icon={<ArrowLeft className="size-4" />} onClick={() => navigate(-1)}>返回工作台</Button><div className="flex items-center gap-1"><Tooltip title="刷新账户数据"><Button type="text" icon={<RefreshCw className="size-4" />} loading={me.isFetching || ledger.isFetching} onClick={() => void refreshAccount()} aria-label="刷新账户数据" /></Tooltip><Button type="text" danger icon={<LogOut className="size-4" />} onClick={() => { logout(); navigate("/auth"); }}>退出登录</Button></div></header>

        <section className="mb-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div className="flex items-center gap-4"><Avatar size={64} className="!bg-amber-400 !text-2xl !text-black">{member.nickname.slice(0, 1)}</Avatar><div><div className="mb-1 flex items-center gap-2"><h1 className="m-0 text-2xl font-semibold tracking-tight text-[var(--ant-color-text)]">个人中心</h1><Tag color="green" bordered={false}>已登录</Tag></div><div className="text-sm text-[var(--ant-color-text-secondary)]">{member.nickname} · {member.email}</div></div></div><div className="text-sm text-[var(--ant-color-text-secondary)]">账户 ID <span className="font-mono text-xs">{member.id.slice(0, 8)}...</span></div></section>

        <section className="mb-6 grid gap-4 lg:grid-cols-[1.35fr_1fr]"><Card bordered={false} className="!overflow-hidden !rounded-2xl !bg-[#1c1d1f] !text-white"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-sm text-white/60"><WalletCards className="size-4" />可用积分</div><div className="mt-4 text-5xl font-semibold tracking-tight">{currentPoints.toLocaleString()}</div><div className="mt-2 text-sm text-white/50">可用于平台支持的生成服务</div></div><div className="rounded-xl bg-amber-400/15 p-3 text-amber-300"><Coins className="size-6" /></div></div><div className="mt-8 flex flex-wrap gap-2"><Button type="primary" className="!border-amber-400 !bg-amber-400 !text-black hover:!border-amber-300 hover:!bg-amber-300" onClick={() => document.getElementById("recharge-packages")?.scrollIntoView({ behavior: "smooth", block: "start" })}>充值积分 <ChevronRight className="ml-1 size-4" /></Button><Button ghost className="!border-white/20 !text-white hover:!border-white/50 hover:!text-white" onClick={() => document.getElementById("ledger")?.scrollIntoView({ behavior: "smooth", block: "start" })}>查看流水</Button></div></Card><Card bordered={false} className="!rounded-2xl"><div className="mb-4 flex items-center justify-between"><div><div className="text-sm text-[var(--ant-color-text-secondary)]">账户概况</div><div className="mt-1 text-lg font-semibold">积分活动</div></div><Sparkles className="size-5 text-amber-500" /></div><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-950/20"><div className="text-xs text-emerald-700 dark:text-emerald-300">累计获得</div><div className="mt-1 text-xl font-semibold text-emerald-700 dark:text-emerald-300">+{income.toLocaleString()}</div></div><div className="rounded-xl bg-orange-50 px-4 py-3 dark:bg-orange-950/20"><div className="text-xs text-orange-700 dark:text-orange-300">累计消耗</div><div className="mt-1 text-xl font-semibold text-orange-700 dark:text-orange-300">-{expense.toLocaleString()}</div></div></div><div className="mt-4 flex items-center gap-2 text-xs text-[var(--ant-color-text-tertiary)]"><ShieldCheck className="size-4 text-emerald-500" />积分变动均由服务端记录</div></Card></section>

        <section id="recharge-packages" className="mb-6 scroll-mt-5"><div className="mb-3 flex items-end justify-between"><div><h2 className="m-0 text-xl font-semibold">充值积分</h2><p className="mt-1 text-sm text-[var(--ant-color-text-secondary)]">选择套餐后扫码支付，到账以服务端回调为准。</p></div>{enabledMethods.length ? <Segmented value={payMethod} options={enabledMethods.map((value) => ({ label: paymentLabel(value), value }))} onChange={(value) => setPayMethod(value as PayMethod)} /> : <Tag>在线支付暂未开放</Tag>}</div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{packages.isLoading ? <Card bordered={false} className="!rounded-xl sm:col-span-2 xl:col-span-3"><div className="flex justify-center py-8"><Spin /></div></Card> : packages.data?.length ? packages.data.map((item) => <Card key={item.id} bordered={false} className="!rounded-xl transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div><div className="text-base font-semibold">{item.name}</div><div className="mt-2 text-3xl font-semibold tracking-tight">¥{(item.priceCent / 100).toFixed(2)}</div></div><Tag color="gold">{item.points.toLocaleString()} 积分</Tag></div><div className="mt-5 flex items-center justify-between border-t border-[var(--ant-color-border-secondary)] pt-4"><span className="text-xs text-[var(--ant-color-text-tertiary)]">支付后自动入账</span><Button type="primary" disabled={!enabledMethods.length} loading={payingPackage === item.id} onClick={() => void startPay(item.id)}>立即购买</Button></div></Card>) : <Card bordered={false} className="!rounded-xl sm:col-span-2 xl:col-span-3"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可购买套餐" /></Card>}</div></section>

        <section id="ledger" className="scroll-mt-5"><Card bordered={false} className="!rounded-2xl" title={<span className="flex items-center gap-2"><ReceiptText className="size-4" />积分流水</span>} extra={<Segmented size="small" value={ledgerFilter} options={[{ label: "全部", value: "all" }, { label: "获得", value: "income" }, { label: "消耗", value: "expense" }]} onChange={(value) => setLedgerFilter(value as LedgerFilter)} />}>{ledger.isLoading ? <div className="flex justify-center py-10"><Spin /></div> : ledger.isError ? <Empty description="流水加载失败，请点击右上角刷新" /> : filteredLedger.length ? <div className="divide-y divide-[var(--ant-color-border-secondary)]">{filteredLedger.map((row: PointLedger) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5"><div className="flex min-w-0 items-center gap-3"><div className={`grid size-8 shrink-0 place-items-center rounded-lg ${row.amount >= 0 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" : "bg-orange-50 text-orange-600 dark:bg-orange-950/30"}`}>{row.amount >= 0 ? <CheckCircle2 className="size-4" /> : <CreditCard className="size-4" />}</div><div className="min-w-0"><div className="truncate text-sm font-medium">{row.remark || row.type}</div><div className="mt-0.5 text-xs text-[var(--ant-color-text-tertiary)]">{formatDate(row.createdAt)}</div></div></div><div className="text-right"><div className={row.amount >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-orange-600"}>{row.amount >= 0 ? "+" : ""}{row.amount.toLocaleString()}</div><div className="text-xs text-[var(--ant-color-text-tertiary)]">余额 {row.balanceAfter.toLocaleString()}</div></div></div>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={ledgerFilter === "all" ? "暂无积分流水" : "暂无符合条件的记录"} />}</Card></section>

        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-[var(--ant-color-text-tertiary)]"><UserRound className="size-3.5" />账户信息和积分余额以服务端数据为准</div>
        <PaymentModal qr={qr} onClose={() => setQr(null)} onComplete={() => void completePayment()} />
    </div></main>;
}

function PaymentModal({ qr, onClose, onComplete }: { qr: { orderNo: string; qrCode: string } | null; onClose: () => void; onComplete: () => void }) {
    const { message } = App.useApp();
    return <Modal title="扫码支付" open={Boolean(qr)} footer={null} onCancel={onClose}><div className="flex flex-col items-center gap-4 py-3"><div className="rounded-xl border border-[var(--ant-color-border-secondary)] bg-white p-3"><img src={qr?.qrCode} alt="支付二维码" className="size-56 object-contain" /></div><div className="text-center"><div className="text-sm font-medium">请使用微信或支付宝扫码完成支付</div><div className="mt-1 flex items-center justify-center gap-1 text-xs text-[var(--ant-color-text-tertiary)]">订单号：{qr?.orderNo}<Tooltip title="复制订单号"><Button type="text" size="small" icon={<Copy className="size-3.5" />} onClick={() => { void navigator.clipboard?.writeText(qr?.orderNo || ""); message.success("订单号已复制"); }} aria-label="复制订单号" /></Tooltip></div></div><Button type="primary" block icon={<CheckCircle2 className="size-4" />} onClick={onComplete}>我已完成支付，刷新余额</Button><div className="text-center text-xs text-[var(--ant-color-text-tertiary)]">支付成功后由平台异步回调入账，未到账时请稍后刷新。</div></div></Modal>;
}
