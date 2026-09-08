import { LockKeyhole, Mail, Sparkles } from "lucide-react";
import { useState } from "react";
import { App, Button, Form, Input, Segmented } from "antd";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { loginMember, registerMember } from "@/services/api/membership";
import { useMemberStore } from "@/stores/use-member-store";

export default function AuthPage() {
    const { message } = App.useApp();
    const navigate = useNavigate();
    const location = useLocation();
    const user = useMemberStore((state) => state.user);
    const setSession = useMemberStore((state) => state.setSession);
    const [mode, setMode] = useState<"login" | "register">("login");
    const [loading, setLoading] = useState(false);

    if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/"} replace />;

    const submit = async (values: { email: string; password: string; nickname?: string }) => {
        setLoading(true);
        try {
            const session = mode === "login" ? await loginMember(values.email, values.password) : await registerMember(values.email, values.password, values.nickname || "");
            setSession(session.token, session.user);
            message.success(mode === "login" ? "欢迎回来" : "账号创建成功");
            const target = new URLSearchParams(location.search).get("redirect");
            navigate(target || (session.user.role === "admin" ? "/admin" : "/"), { replace: true });
        } catch (error) {
            message.error(error instanceof Error ? error.message : "操作失败");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#0c0d0f] px-5 py-10 text-white">
            <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_20%_20%,rgba(245,158,11,.18),transparent_30%),radial-gradient(circle_at_80%_75%,rgba(255,255,255,.08),transparent_34%)]" />
            <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-[#141518]/95 shadow-2xl shadow-black/40 lg:grid-cols-[1.05fr_.95fr]">
                <section className="hidden min-h-[620px] flex-col justify-between border-r border-white/10 p-12 lg:flex">
                    <div className="flex items-center gap-3 text-sm font-semibold tracking-wide"><span className="grid size-10 place-items-center rounded-xl bg-amber-400 text-black"><Sparkles className="size-5" /></span>C-AI 创作平台</div>
                    <div>
                        <div className="mb-5 text-xs font-semibold uppercase tracking-[.28em] text-amber-300">Create without limits</div>
                        <h1 className="max-w-lg text-5xl font-semibold leading-[1.08] tracking-[-.04em]">让每一次生成，<br />都清晰可计量。</h1>
                        <p className="mt-6 max-w-md text-base leading-7 text-white/55">统一管理创作积分、生成记录与模型消费。你的画布仍然自由，账单始终透明。</p>
                    </div>
                    <div className="text-xs text-white/35">会员与积分系统 · 安全登录</div>
                </section>
                <section className="flex min-h-[620px] flex-col justify-center p-7 sm:p-12">
                    <div className="mx-auto w-full max-w-sm">
                        <h2 className="text-3xl font-semibold tracking-[-.03em]">{mode === "login" ? "登录账号" : "创建账号"}</h2>
                        <p className="mb-8 mt-2 text-sm text-white/45">进入你的创作工作区与积分中心</p>
                        <Segmented block value={mode} options={[{ label: "登录", value: "login" }, { label: "注册", value: "register" }]} onChange={setMode} className="mb-7" />
                        <Form layout="vertical" requiredMark={false} onFinish={submit}>
                            {mode === "register" ? <Form.Item name="nickname" label={<span className="text-white/70">昵称</span>}><Input size="large" placeholder="你的称呼" /></Form.Item> : null}
                            <Form.Item name="email" label={<span className="text-white/70">邮箱</span>} rules={[{ required: true, type: "email", message: "请输入有效邮箱" }]}><Input size="large" prefix={<Mail className="size-4 text-white/35" />} placeholder="name@example.com" /></Form.Item>
                            <Form.Item name="password" label={<span className="text-white/70">密码</span>} rules={[{ required: true, min: 8, message: "密码至少 8 位" }]}><Input.Password size="large" prefix={<LockKeyhole className="size-4 text-white/35" />} placeholder="至少 8 位" /></Form.Item>
                            <Button type="primary" htmlType="submit" size="large" block loading={loading} className="mt-3 !h-12 !bg-amber-400 !font-semibold !text-black">{mode === "login" ? "进入工作区" : "免费注册"}</Button>
                        </Form>
                    </div>
                </section>
            </div>
        </main>
    );
}
