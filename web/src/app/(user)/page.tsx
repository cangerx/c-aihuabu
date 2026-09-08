import type { AnchorHTMLAttributes, ReactNode } from "react";
import { motion } from "motion/react";
import type { Variants } from "motion/react";
import {
    Check,
    Image as ImageIcon,
    MousePointer,
    Play,
    Sparkles,
    Video,
    FileText,
} from "lucide-react";

import { DOCS_URL } from "@/constant/env";

function Link({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return <a href={href} {...props} />;
}

// 首屏入场动画
const fadeUp: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: (delay: number = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] },
    }),
};

// 滚动渐入
const reveal: Variants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
    },
};

// 漂浮气泡通用动效
function Float({ children, className, duration = 6, delay = 0, rotate = 0 }: { children: ReactNode; className?: string; duration?: number; delay?: number; rotate?: number }) {
    return (
        <motion.div
            className={className}
            animate={{ y: [0, -14, 0], rotate: [rotate, rotate + 2, rotate] }}
            transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
        >
            {children}
        </motion.div>
    );
}

export default function IndexPage() {
    return (
        <main className="relative h-full overflow-y-auto bg-white text-stone-900 selection:bg-emerald-500 selection:text-white dark:bg-[#0E1015] dark:text-stone-100">
            <style>{`
                @keyframes line-flow { to { stroke-dashoffset: -20; } }
                .animate-line-flow { animation: line-flow 6s linear infinite; }
                @keyframes aurora-glow {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
                .animate-aurora-glow { background-size: 200% 200%; animation: aurora-glow 12s ease infinite; }
            `}</style>

            {/* ============ S1 Hero：极简中央品牌 + 漂浮气泡 ============ */}
            <section className="relative overflow-hidden">
                {/* 细网格底纹 + 顶部光晕 */}
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:40px_40px] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)]" />
                <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-b from-emerald-200/40 via-sky-100/30 to-transparent blur-[120px] dark:from-emerald-500/15 dark:via-sky-500/10" />

                {/* 漂浮彩色气泡群（大屏显示） */}
                <div className="pointer-events-none absolute inset-0 hidden lg:block">
                    {/* 渐变光球 */}
                    <Float className="absolute left-[6%] top-[16%]" duration={7}>
                        <div className="size-24 rounded-full bg-gradient-to-br from-amber-300 via-orange-400 to-rose-400 opacity-80 blur-[1px] shadow-[0_12px_40px_rgba(251,146,60,0.35)]" />
                    </Float>
                    <Float className="absolute right-[8%] top-[12%]" duration={8} delay={0.5}>
                        <div className="size-28 rounded-full bg-gradient-to-br from-violet-400 via-purple-500 to-fuchsia-400 opacity-75 blur-[1px] shadow-[0_12px_40px_rgba(168,85,247,0.35)]" />
                    </Float>
                    <Float className="absolute left-[14%] bottom-[10%]" duration={9} delay={1}>
                        <div className="size-32 rounded-full bg-gradient-to-br from-sky-300 via-blue-500 to-indigo-500 opacity-75 blur-[1px] shadow-[0_16px_48px_rgba(59,130,246,0.35)]" />
                    </Float>
                    <Float className="absolute right-[13%] bottom-[14%]" duration={7.5} delay={0.3}>
                        <div className="size-24 rounded-full bg-gradient-to-br from-emerald-300 via-teal-400 to-cyan-500 opacity-80 blur-[1px] shadow-[0_12px_40px_rgba(20,184,166,0.35)]" />
                    </Float>

                    {/* 迷你生图节点卡 */}
                    <Float className="absolute left-[22%] top-[20%]" duration={6.5} delay={0.8}>
                        <div className="w-36 overflow-hidden rounded-2xl border border-stone-200/70 bg-white/90 p-2.5 shadow-[0_16px_48px_rgba(0,0,0,0.08)] backdrop-blur-md dark:border-stone-700/60 dark:bg-stone-900/90">
                            <div className="relative aspect-square overflow-hidden rounded-xl bg-stone-900">
                                <div className="absolute inset-0 bg-gradient-to-tr from-purple-600 via-blue-500 to-emerald-400 opacity-85 mix-blend-color-dodge animate-aurora-glow" />
                                <div className="absolute inset-x-1.5 bottom-1.5 rounded bg-black/45 px-1.5 py-1 text-[9px] font-medium text-white backdrop-blur-sm">#001_灵感.png</div>
                            </div>
                            <div className="mt-2 flex items-center gap-1 text-[10px] text-stone-500"><ImageIcon className="size-3 text-purple-500" />生图节点</div>
                        </div>
                    </Float>

                    {/* 迷你视频节点卡 */}
                    <Float className="absolute right-[21%] top-[34%]" duration={7.2} delay={1.2}>
                        <div className="w-40 overflow-hidden rounded-2xl border border-stone-200/70 bg-white/90 p-2.5 shadow-[0_16px_48px_rgba(0,0,0,0.08)] backdrop-blur-md dark:border-stone-700/60 dark:bg-stone-900/90">
                            <div className="relative aspect-video overflow-hidden rounded-xl bg-stone-950">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-stone-900 to-purple-950" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="flex size-8 items-center justify-center rounded-full border border-white/25 bg-white/15 backdrop-blur-md"><Play className="ml-0.5 size-3 fill-white text-white" /></div>
                                </div>
                            </div>
                            <div className="mt-2 flex items-center gap-1 text-[10px] text-stone-500"><Video className="size-3 text-emerald-500" />视频节点 · 5.0s</div>
                        </div>
                    </Float>

                    {/* 迷你提示词卡 */}
                    <Float className="absolute left-[30%] bottom-[6%]" duration={8.5} delay={0.4}>
                        <div className="w-44 rounded-2xl border border-stone-200/70 bg-white/90 p-3 shadow-[0_16px_48px_rgba(0,0,0,0.08)] backdrop-blur-md dark:border-stone-700/60 dark:bg-stone-900/90">
                            <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"><FileText className="size-3" />提示词节点</div>
                            <p className="mt-1.5 line-clamp-2 font-mono text-[10px] leading-relaxed text-stone-500">/prompt 赛博朋克魔法猫咪，电影质感...</p>
                        </div>
                    </Float>

                    {/* 对勾徽章气泡 */}
                    <Float className="absolute right-[28%] bottom-[8%]" duration={6.8} delay={1.6}>
                        <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500 shadow-[0_12px_32px_rgba(16,185,129,0.4)]">
                            <Check className="size-6 text-white" strokeWidth={3} />
                        </div>
                    </Float>
                </div>

                {/* 中央品牌区 */}
                <div className="relative mx-auto flex min-h-[92vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
                    <motion.div custom={0.05} variants={fadeUp} initial="hidden" animate="visible">
                        <h1 className="text-7xl font-black tracking-tight text-stone-950 sm:text-8xl dark:text-white">
                            C-AI 画布
                        </h1>
                    </motion.div>
                    <motion.p custom={0.2} variants={fadeUp} initial="hidden" animate="visible" className="mt-2 font-serif text-2xl italic tracking-wide text-emerald-600 sm:text-3xl dark:text-emerald-400">
                        让灵感，连续生长
                    </motion.p>
                    <motion.p custom={0.35} variants={fadeUp} initial="hidden" animate="visible" className="mt-5 text-lg text-stone-500 dark:text-stone-400">
                        多模态 AI 创作画布
                    </motion.p>
                    <motion.div custom={0.5} variants={fadeUp} initial="hidden" animate="visible" className="mt-10">
                        <Link
                            href="/canvas"
                            className="group inline-flex h-14 items-center gap-2.5 rounded-full bg-stone-950 px-9 text-lg font-semibold text-white shadow-[0_16px_40px_rgba(0,0,0,0.2)] transition-all duration-300 hover:scale-105 hover:bg-black dark:bg-white dark:text-stone-950 dark:hover:bg-stone-100"
                        >
                            <MousePointer className="size-5 text-emerald-400 transition-transform duration-300 group-hover:-rotate-12 dark:text-emerald-500" />
                            开始创作
                        </Link>
                    </motion.div>
                </div>
            </section>

            {/* ============ S2 产品大演示：全宽渐变容器 + 拟真画布 ============ */}
            <section className="relative mx-auto max-w-[1240px] px-4 pb-8 sm:px-8">
                <motion.div
                    variants={reveal}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-80px" }}
                    className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-teal-300 via-emerald-300 to-cyan-300 p-4 shadow-[0_32px_80px_rgba(20,184,166,0.25)] sm:p-8 dark:from-teal-800 dark:via-emerald-800 dark:to-cyan-900"
                >
                    {/* 拟真画布窗口 */}
                    <div className="overflow-hidden rounded-2xl bg-[#12141A] shadow-2xl">
                        {/* 窗口栏 */}
                        <div className="flex items-center justify-between border-b border-stone-800/80 px-5 py-3.5">
                            <div className="flex items-center gap-2">
                                <span className="size-3 rounded-full bg-[#FF5F57]" />
                                <span className="size-3 rounded-full bg-[#FEBC2E]" />
                                <span className="size-3 rounded-full bg-[#28C840]" />
                            </div>
                            <span className="font-mono text-xs text-stone-500">c-ai-canvas · 未命名推演</span>
                            <span className="flex items-center gap-1.5 rounded-full bg-stone-800/80 px-2.5 py-1 text-[10px] text-emerald-400">
                                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                                已连接
                            </span>
                        </div>
                        {/* 画布主体：节点 + 流光连线 */}
                        <div className="relative h-[340px] sm:h-[400px]">
                            <svg className="absolute inset-0 size-full" fill="none">
                                <path d="M 300 130 C 380 130, 400 200, 490 200" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                                <path d="M 300 130 C 380 130, 400 200, 490 200" stroke="rgba(52,211,153,0.7)" strokeWidth="2" strokeDasharray="4 12" className="animate-line-flow" />
                                <path d="M 730 200 C 820 200, 840 130, 920 130" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                                <path d="M 730 200 C 820 200, 840 130, 920 130" stroke="rgba(168,85,247,0.7)" strokeWidth="2" strokeDasharray="4 12" className="animate-line-flow" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-between px-[6%] max-md:hidden">
                                {/* 提示词节点 */}
                                <Float duration={6}>
                                    <div className="w-52 rounded-xl border border-stone-700/60 bg-stone-900/95 p-3.5 shadow-xl">
                                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400"><FileText className="size-3.5" />提示词节点</div>
                                        <p className="mt-2 font-mono text-[11px] leading-relaxed text-stone-400">赛博雨夜，霓虹街道，<br />魔法法杖微光闪烁...</p>
                                    </div>
                                </Float>
                                {/* 生图节点 */}
                                <Float duration={7} delay={0.6}>
                                    <div className="w-48 rounded-xl border border-stone-700/60 bg-stone-900/95 p-3 shadow-xl">
                                        <div className="relative aspect-square overflow-hidden rounded-lg bg-stone-950">
                                            <div className="absolute inset-0 bg-gradient-to-tr from-purple-600 via-blue-500 to-emerald-400 opacity-85 mix-blend-color-dodge animate-aurora-glow" />
                                            <div className="absolute inset-x-2 bottom-2 rounded bg-black/50 px-1.5 py-1 text-[9px] text-white">#001_魔法猫咪.png</div>
                                        </div>
                                    </div>
                                </Float>
                                {/* 视频节点 */}
                                <Float duration={6.6} delay={1.1}>
                                    <div className="w-52 rounded-xl border border-stone-700/60 bg-stone-900/95 p-3.5 shadow-xl">
                                        <div className="flex items-center justify-between text-[11px] font-semibold text-stone-300">
                                            <span className="flex items-center gap-1.5 text-purple-400"><Video className="size-3.5" />视频节点</span>
                                            <span className="font-mono text-[9px] text-emerald-400">Seedance 2.5</span>
                                        </div>
                                        <div className="relative mt-2 aspect-video overflow-hidden rounded-lg bg-stone-950">
                                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-stone-900 to-purple-950" />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="flex size-9 items-center justify-center rounded-full border border-white/25 bg-white/15 backdrop-blur-md"><Play className="ml-0.5 size-3.5 fill-white text-white" /></div>
                                            </div>
                                        </div>
                                    </div>
                                </Float>
                            </div>
                            {/* 移动端简化展示 */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 md:hidden">
                                <div className="w-full max-w-xs rounded-xl border border-stone-700/60 bg-stone-900/95 p-4 text-center">
                                    <p className="font-mono text-xs leading-relaxed text-stone-400">赛博雨夜，霓虹街道，魔法法杖微光闪烁...</p>
                                </div>
                                <div className="h-0.5 w-24 bg-gradient-to-r from-emerald-400 to-purple-400" />
                                <div className="w-full max-w-[10rem]">
                                    <div className="relative aspect-square overflow-hidden rounded-xl bg-stone-950">
                                        <div className="absolute inset-0 bg-gradient-to-tr from-purple-600 via-blue-500 to-emerald-400 opacity-85 mix-blend-color-dodge animate-aurora-glow" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
                {/* 轮播圆点装饰 */}
                <div className="mt-6 flex justify-center gap-2">
                    <span className="h-1.5 w-8 rounded-full bg-stone-800 dark:bg-white" />
                    <span className="h-1.5 w-8 rounded-full bg-stone-200 dark:bg-stone-700" />
                    <span className="h-1.5 w-8 rounded-full bg-stone-200 dark:bg-stone-700" />
                </div>
            </section>

            {/* ============ S3 AI 能力：一章一标题 + 三张软渐变浮动卡 ============ */}
            <section className="mx-auto max-w-[1240px] px-4 py-24 sm:px-8 sm:py-32">
                <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} className="text-center">
                    <h2 className="text-3xl font-black tracking-tight sm:text-5xl">
                        从文字到画面，AI
                        <Sparkles className="mx-1 inline size-7 -translate-y-1 fill-emerald-500 text-emerald-500 sm:size-9" />
                        协同落地每一个想法
                    </h2>
                    <p className="mt-5 inline-block text-lg text-stone-500 dark:text-stone-400">
                        <span className="text-emerald-600 dark:text-emerald-400">「</span>描述即生成<span className="text-emerald-600 dark:text-emerald-400">」</span>
                    </p>
                </motion.div>

                <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
                    {/* 文生图 */}
                    <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} className="group">
                        <div className="relative h-72 overflow-hidden rounded-[28px] bg-gradient-to-br from-sky-200 to-blue-300 p-6 transition-transform duration-500 group-hover:-translate-y-2 dark:from-sky-900 dark:to-blue-950">
                            <Float duration={5.5} className="absolute left-6 top-8 w-4/5">
                                <div className="rounded-2xl bg-white/95 p-3.5 shadow-lg dark:bg-stone-900/95">
                                    <p className="text-xs text-stone-600 dark:text-stone-300">生成一张极简风格的旅行首页 ✨</p>
                                </div>
                            </Float>
                            <Float duration={6.5} delay={0.8} className="absolute bottom-8 right-6 w-3/5">
                                <div className="overflow-hidden rounded-xl shadow-xl">
                                    <div className="relative aspect-[4/3] bg-stone-900">
                                        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500 via-cyan-400 to-emerald-300 opacity-90 mix-blend-color-dodge animate-aurora-glow" />
                                    </div>
                                </div>
                            </Float>
                        </div>
                        <h3 className="mt-6 text-xl font-bold">文生图</h3>
                        <p className="mt-1.5 text-sm text-stone-500 dark:text-stone-400">描述即生成，原生比例自适应</p>
                    </motion.div>

                    {/* 分镜拆解 */}
                    <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} className="group md:mt-10">
                        <div className="relative h-72 overflow-hidden rounded-[28px] bg-gradient-to-br from-violet-200 to-purple-300 p-6 transition-transform duration-500 group-hover:-translate-y-2 dark:from-violet-900 dark:to-purple-950">
                            <Float duration={6} className="absolute left-6 top-8 w-4/5">
                                <div className="rounded-2xl bg-white/95 p-3.5 shadow-lg dark:bg-stone-900/95">
                                    <p className="text-xs text-stone-600 dark:text-stone-300">把这段故事拆成 12 个镜头...</p>
                                </div>
                            </Float>
                            <div className="absolute bottom-8 left-6 right-6 grid grid-cols-3 gap-2">
                                {[1, 2, 3].map((i) => (
                                    <Float key={i} duration={5 + i * 0.7} delay={i * 0.3}>
                                        <div className="overflow-hidden rounded-lg shadow-md">
                                            <div className="relative aspect-square bg-stone-900">
                                                <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-400 via-purple-500 to-indigo-500 opacity-80 animate-aurora-glow" style={{ animationDelay: `${i * 0.4}s` }} />
                                                <span className="absolute bottom-1 left-1.5 text-[9px] font-medium text-white/90">镜头 {i}</span>
                                            </div>
                                        </div>
                                    </Float>
                                ))}
                            </div>
                        </div>
                        <h3 className="mt-6 text-xl font-bold">分镜拆解</h3>
                        <p className="mt-1.5 text-sm text-stone-500 dark:text-stone-400">故事一键变镜头序列</p>
                    </motion.div>

                    {/* 视频合成 */}
                    <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} className="group md:mt-20">
                        <div className="relative h-72 overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-200 to-teal-300 p-6 transition-transform duration-500 group-hover:-translate-y-2 dark:from-emerald-900 dark:to-teal-950">
                            <Float duration={6.5} className="absolute left-6 right-6 top-10">
                                <div className="overflow-hidden rounded-2xl shadow-xl">
                                    <div className="relative aspect-video bg-stone-950">
                                        <div className="absolute inset-0 bg-gradient-to-br from-teal-500 via-emerald-600 to-cyan-700 opacity-85 animate-aurora-glow" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="flex size-11 items-center justify-center rounded-full border border-white/30 bg-white/20 backdrop-blur-md"><Play className="ml-0.5 size-4 fill-white text-white" /></div>
                                        </div>
                                    </div>
                                </div>
                            </Float>
                            <Float duration={5.5} delay={0.7} className="absolute bottom-8 left-6 right-6">
                                <div className="rounded-xl bg-white/95 p-3 shadow-lg dark:bg-stone-900/95">
                                    <div className="flex items-center justify-between text-[10px] text-stone-500 dark:text-stone-400">
                                        <span>渲染中</span><span className="font-medium text-emerald-600 dark:text-emerald-400">86%</span>
                                    </div>
                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                                        <motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" animate={{ width: ["40%", "86%", "40%"] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} />
                                    </div>
                                </div>
                            </Float>
                        </div>
                        <h3 className="mt-6 text-xl font-bold">视频合成</h3>
                        <p className="mt-1.5 text-sm text-stone-500 dark:text-stone-400">首尾帧平滑，进度实时可见</p>
                    </motion.div>
                </div>
            </section>

            {/* ============ S4 三特性彩色大卡（错落高度） ============ */}
            <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-8 sm:pb-32">
                <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} className="text-center">
                    <h2 className="text-3xl font-black tracking-tight sm:text-5xl">
                        从布局到细节<br />自在掌控<span className="mx-1 inline-block align-middle text-3xl sm:text-4xl">👌</span>创作节奏
                    </h2>
                </motion.div>

                <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
                    {/* 无限自由连线（蓝卡） */}
                    <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                        <div className="relative flex h-80 flex-col justify-between overflow-hidden rounded-[28px] bg-blue-600 p-8 text-white transition-transform duration-500 hover:-translate-y-2">
                            <svg className="pointer-events-none absolute inset-0 size-full opacity-30" fill="none">
                                <path d="M 30 240 C 100 200, 140 120, 220 90" stroke="white" strokeWidth="1.5" strokeDasharray="4 8" className="animate-line-flow" />
                                <circle cx="220" cy="90" r="5" fill="white" />
                                <circle cx="30" cy="240" r="5" fill="white" />
                            </svg>
                            <div className="relative">
                                <h3 className="text-2xl font-bold">无限自由连线</h3>
                                <p className="mt-3 text-sm leading-relaxed text-blue-100">跨模态节点自由编排，双向流光连线，一键对齐居中。</p>
                            </div>
                            <span className="relative text-xs text-blue-200">快捷键全覆盖 · 毫秒级响应</span>
                        </div>
                    </motion.div>

                    {/* 动态多模态（青柠卡） */}
                    <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} className="md:mt-12">
                        <div className="relative flex h-80 flex-col justify-between overflow-hidden rounded-[28px] bg-lime-400 p-8 text-stone-900 transition-transform duration-500 hover:-translate-y-2 dark:bg-lime-500">
                            <div className="absolute right-5 top-5 flex gap-1.5">
                                {["GPT", "GM", "GK", "SD"].map((t) => (
                                    <span key={t} className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-bold text-stone-700 backdrop-blur-sm">{t}</span>
                                ))}
                            </div>
                            <div className="relative">
                                <h3 className="text-2xl font-bold">动态多模态</h3>
                                <p className="mt-3 text-sm leading-relaxed text-lime-950/70">主流模型统一调度，参数自动适配，无感切换。</p>
                            </div>
                            <span className="relative text-xs text-lime-950/60">OpenAI 标准协议</span>
                        </div>
                    </motion.div>

                    {/* 自由素材库（抹茶卡） */}
                    <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} className="md:mt-24">
                        <div className="relative flex h-80 flex-col justify-between overflow-hidden rounded-[28px] bg-emerald-200 p-8 text-stone-900 transition-transform duration-500 hover:-translate-y-2 dark:bg-emerald-800 dark:text-white">
                            <div className="absolute bottom-6 right-6 grid grid-cols-2 gap-2 opacity-80">
                                {[0, 1, 2, 3].map((i) => (
                                    <div key={i} className="size-14 rounded-lg bg-gradient-to-br from-white/80 to-white/40 shadow-sm backdrop-blur-sm dark:from-white/20 dark:to-white/10" />
                                ))}
                            </div>
                            <div className="relative">
                                <h3 className="text-2xl font-bold">自由素材库</h3>
                                <p className="mt-3 text-sm leading-relaxed text-emerald-900/70 dark:text-emerald-100/80">灵感、作品与素材一库统管，一键复用。</p>
                            </div>
                            <span className="relative text-xs text-emerald-900/60 dark:text-emerald-100/60">创意和秩序一起发生</span>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ============ S5 安心托付（三粉彩卡 + 迷你 UI 浮层） ============ */}
            <section className="mx-auto max-w-[1240px] px-4 pb-28 sm:px-8 sm:pb-36">
                <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} className="text-center">
                    <h2 className="text-3xl font-black tracking-tight sm:text-5xl">
                        从链路到资产，每次生成<span className="text-emerald-500">都安心托付</span>
                    </h2>
                    <p className="mt-4 text-base text-stone-500 dark:text-stone-400">覆盖生成、存储与调度的全流程保障</p>
                </motion.div>

                <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
                    {/* 双通道调度（淡紫卡） */}
                    <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                        <div className="relative h-64 overflow-hidden rounded-[28px] bg-violet-100 p-6 dark:bg-violet-950/40">
                            <Float duration={6} className="absolute left-6 top-8 w-[calc(100%-3rem)]">
                                <div className="rounded-2xl bg-white p-4 shadow-lg dark:bg-stone-900">
                                    <div className="flex items-center justify-between text-[11px]">
                                        <span className="font-semibold text-stone-700 dark:text-stone-200">同域代理</span>
                                        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-500" />正常</span>
                                    </div>
                                    <div className="mt-2.5 flex items-center justify-between text-[11px]">
                                        <span className="font-semibold text-stone-700 dark:text-stone-200">浏览器直连</span>
                                        <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-600 dark:bg-blue-950 dark:text-blue-400"><span className="size-1.5 rounded-full bg-blue-500" />待命</span>
                                    </div>
                                </div>
                            </Float>
                        </div>
                        <h3 className="mt-5 text-lg font-bold">双通道调度</h3>
                        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">链路故障自动切换，创作不中断</p>
                    </motion.div>

                    {/* 100% 本地隐私（淡蓝卡） */}
                    <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                        <div className="relative h-64 overflow-hidden rounded-[28px] bg-sky-100 p-6 dark:bg-sky-950/40">
                            <Float duration={6.8} delay={0.4} className="absolute left-6 top-8 w-[calc(100%-3rem)]">
                                <div className="rounded-2xl bg-white p-4 shadow-lg dark:bg-stone-900">
                                    <div className="text-[11px] font-semibold text-stone-700 dark:text-stone-200">本地存储空间</div>
                                    <div className="mt-3 space-y-2">
                                        {[80, 60].map((w, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                                                    <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500" style={{ width: `${w}%` }} />
                                                </div>
                                                <span className="text-[10px] text-stone-400">{i === 0 ? "画布" : "素材"}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-3 flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400"><Check className="size-3" />0 云端留痕</div>
                                </div>
                            </Float>
                        </div>
                        <h3 className="mt-5 text-lg font-bold">100% 本地隐私</h3>
                        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">数据全量本地落盘，零外泄</p>
                    </motion.div>

                    {/* 统一协议网关（淡绿卡） */}
                    <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                        <div className="relative h-64 overflow-hidden rounded-[28px] bg-emerald-100 p-6 dark:bg-emerald-950/40">
                            <Float duration={6.2} delay={0.8} className="absolute left-6 top-8 w-[calc(100%-3rem)]">
                                <div className="rounded-2xl bg-white p-4 shadow-lg dark:bg-stone-900">
                                    <div className="space-y-2">
                                        {["生图模型", "视频模型", "文本模型"].map((label, i) => (
                                            <div key={label} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-[11px] dark:bg-stone-800">
                                                <span className="text-stone-600 dark:text-stone-300">{label}</span>
                                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Check className="size-3" />已接入</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Float>
                        </div>
                        <h3 className="mt-5 text-lg font-bold">统一协议网关</h3>
                        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">一个标准，畅连所有主流模型</p>
                    </motion.div>
                </div>
            </section>

            {/* ============ S6 页脚：大灰字宣言 + 极简链接 ============ */}
            <footer className="border-t border-stone-100 pb-12 pt-20 dark:border-stone-900">
                <div className="mx-auto max-w-[1240px] px-4 sm:px-8">
                    <p className="text-center text-3xl font-black tracking-tight text-stone-200 sm:text-5xl dark:text-stone-800">
                        C-AI 画布，让灵感鲜活落地
                    </p>
                    <div className="mt-16 flex flex-col items-center justify-between gap-4 text-xs text-stone-400 sm:flex-row">
                        <span>C-AI 画布 · 多模态 AI 创作画布</span>
                        <div className="flex items-center gap-6">
                            <Link href="/canvas" className="transition hover:text-stone-800 dark:hover:text-stone-200">画布</Link>
                            <Link href="/image" className="transition hover:text-stone-800 dark:hover:text-stone-200">生图</Link>
                            <Link href="/video" className="transition hover:text-stone-800 dark:hover:text-stone-200">视频</Link>
                            <Link href="/prompts" className="transition hover:text-stone-800 dark:hover:text-stone-200">提示词</Link>
                            <Link href="/assets" className="transition hover:text-stone-800 dark:hover:text-stone-200">素材</Link>
                            <Link href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="transition hover:text-stone-800 dark:hover:text-stone-200">帮助文档</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </main>
    );
}
