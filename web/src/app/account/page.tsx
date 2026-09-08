import { ArrowLeft, Coins, LogOut, ReceiptText, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { App, Avatar, Button, Card, Col, Empty, Modal, Row, Segmented, Tag } from "antd";
import { Navigate, useNavigate } from "react-router-dom";

import { createRechargeOrder, getMember, getMemberLedger, getPointPackages } from "@/services/api/membership";
import { useMemberStore } from "@/stores/use-member-store";

export default function AccountPage() {
    const navigate = useNavigate(); const { message } = App.useApp();
    const member = useMemberStore((state) => state.user); const setUser = useMemberStore((state) => state.setUser); const logout = useMemberStore((state) => state.logout);
    const [payMethod, setPayMethod] = useState<"WECHAT" | "ALIPAY">("WECHAT");
    const [paying, setPaying] = useState(false); const [qr, setQr] = useState<{ orderNo: string; qrCode: string } | null>(null);
    const me = useQuery({ queryKey: ["member-me"], queryFn: getMember, enabled: Boolean(member) });
    const ledger = useQuery({ queryKey: ["member-ledger"], queryFn: getMemberLedger, enabled: Boolean(member) });
    const packages = useQuery({ queryKey: ["point-packages"], queryFn: getPointPackages, enabled: Boolean(member) });
    useEffect(() => { if (me.data) setUser(me.data); }, [me.data, setUser]);
    if (!member) return <Navigate to="/auth?redirect=/account" replace />;
    const startPay = async (packageId: string) => { setPaying(true); try { setQr(await createRechargeOrder(packageId, payMethod)); } catch (error) { message.error(error instanceof Error ? error.message : "创建支付订单失败"); } finally { setPaying(false); } };
    return <main className="min-h-full overflow-y-auto bg-[#f5f5f3] px-5 py-8 dark:bg-[#101112]"><div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between"><Button type="text" icon={<ArrowLeft className="size-4" />} onClick={() => navigate(-1)}>返回</Button><Button type="text" danger icon={<LogOut className="size-4" />} onClick={() => { logout(); navigate("/auth"); }}>退出登录</Button></div>
        <div className="mb-6 flex items-center gap-4"><Avatar size={56} className="!bg-amber-400 !text-xl !text-black">{member.nickname.slice(0, 1)}</Avatar><div><h1 className="m-0 text-2xl font-semibold">{member.nickname}</h1><div className="mt-1 text-sm text-stone-500">{member.email}</div></div></div>
        <Row gutter={[16, 16]}><Col xs={24} md={8}><Card bordered={false} className="!rounded-2xl"><div className="flex items-center gap-3 text-stone-500"><Coins className="size-5 text-amber-500" />积分余额</div><div className="mt-3 text-4xl font-semibold text-amber-600">{me.data?.points ?? member.points}</div><div className="mt-2 text-xs text-stone-400">生成扣费将在计费模块上线后启用</div></Card></Col><Col xs={24} md={16}><Card bordered={false} className="!rounded-2xl" title={<span className="flex items-center gap-2"><ReceiptText className="size-4" />积分流水</span>}><div className="max-h-52 overflow-y-auto">{ledger.data?.length ? ledger.data.map((row) => <div key={row.id} className="flex items-center justify-between border-b border-stone-100 py-2.5 text-sm last:border-0 dark:border-stone-800"><span className="text-stone-500">{row.remark || row.type}</span><span className={row.amount >= 0 ? "font-medium text-emerald-600" : "font-medium text-red-500"}>{row.amount >= 0 ? "+" : ""}{row.amount}<span className="ml-2 text-xs text-stone-400">余额 {row.balanceAfter}</span></span></div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无积分流水" />}</div></Card></Col></Row>
        <section className="mt-6"><div className="mb-3 flex items-center gap-2 text-lg font-semibold"><UserRound className="size-5" />积分套餐</div><div className="mb-4 flex items-center gap-3 text-sm text-stone-500">支付方式<Segmented value={payMethod} options={[{ label: "微信", value: "WECHAT" }, { label: "支付宝", value: "ALIPAY" }]} onChange={(value) => setPayMethod(value as "WECHAT" | "ALIPAY")} /></div><Row gutter={[16, 16]}>{packages.data?.length ? packages.data.map((item) => <Col key={item.id} xs={24} sm={12} lg={8}><Card bordered={false} className="!rounded-2xl" title={item.name} extra={<Tag color="gold">{item.points} 积分</Tag>}><div className="flex items-center justify-between"><span className="text-2xl font-semibold">¥{(item.priceCent / 100).toFixed(2)}</span><Button type="primary" loading={paying} onClick={() => void startPay(item.id)}>购买积分</Button></div></Card></Col>) : <Col span={24}><Empty description="暂无可购买套餐" /></Col>}</Row></section>
        <Modal title="扫码支付" open={Boolean(qr)} footer={null} onCancel={() => setQr(null)}><div className="flex flex-col items-center gap-3 py-4"><img src={qr?.qrCode} alt="支付二维码" className="size-56 object-contain" /><div className="text-sm text-stone-500">订单号：{qr?.orderNo}</div><div className="text-xs text-stone-400">支付完成后请刷新积分中心，到账以服务端回调为准。</div></div></Modal>
    </div></main>;
}
