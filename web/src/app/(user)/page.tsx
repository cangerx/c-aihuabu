import {
    ArrowRight,
    BookOpen,
    CheckCircle2,
    Cpu,
    ExternalLink,
    FileText,
    GitBranch,
    Image as ImageIcon,
    ImagePlus,
    Images,
    Layers,
    Maximize2,
    MousePointer,
    Play,
    ShieldCheck,
    Sparkles,
    Video,
    Workflow,
    Zap,
} from "lucide-react";
import { type AnchorHTMLAttributes, type ReactNode } from "react";
import { Button } from "antd";
import { motion } from "motion/react";
import type { Variants } from "motion/react";

import { DOCS_URL } from "@/constant/env";

const GITHUB_URL = "https://github.com/cangerx/c-aihuabu";

function Link({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return <a href={href} {...props} />;
}

// container transition configuration
const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.12,
            delayChildren: 0.05,
        },
    },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.7,
            ease: [0.16, 1, 0.3, 1],
        },
    },
};

const sentenceVariants: Variants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.04,
            delayChildren: 1.2,
        },
    },
};

const letterVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { duration: 0.1 },
    },
};

const promptText = "赛博朋克风格的魔法猫咪，手握发光的能量法杖，正在调试复杂的代码全息屏幕，超写实摄影，电影质感";

// 核心产品服务矩阵
const capabilityServices = [
    {
        id: "canvas",
        title: "无限连线画布",
        subtitle: "多模态推演核心",
        description: "自由摆放图片、文本、视频与音频节点，支持双向流光连线、脚本分镜一键拆解与自动对焦整理。",
        href: "/canvas",
        badge: "核心推荐",
        icon: Maximize2,
        colorClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/40",
        tags: ["分镜剧本拆解", "节点双向连线", "提示词魔法棒", "视口智能对焦"],
    },
    {
        id: "image",
        title: "AI 生图工作台",
        subtitle: "多模型聚合出图",
        description: "原生支持 GPT-Image-2、Gemini、Grok Imagine 与 StepFun 等模型，自适应宽高比与极速并发提交。",
        href: "/image",
        badge: "高频使用",
        icon: ImagePlus,
        colorClass: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200/60 dark:border-blue-800/40",
        tags: ["1K/2K/4K 规格", "多任务并发提交", "URL 先显后落盘", "原生比例自适应"],
    },
    {
        id: "video",
        title: "视频创作工坊",
        subtitle: "多模态动态视效",
        description: "支持文生视频、图生视频、首尾帧与全能参考模式；长任务 30 分钟后台轮询与实时进度追踪。",
        href: "/video",
        badge: "影视级",
        icon: Video,
        colorClass: "bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200/60 dark:border-purple-800/40",
        tags: ["Seedance 2.5 全能参考", "Videos-4 全系列", "断线续查与拉取", "自动提取首帧"],
    },
    {
        id: "prompts",
        title: "提示词灵感中心",
        subtitle: "六大来源深度聚合",
        description: "六大开源提示词仓库自动拉取与定时缓存，标签智能清洗与中文化映射，一键套用至生图与画布。",
        href: "/prompts",
        badge: "灵感库",
        icon: FileText,
        colorClass: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/40",
        tags: ["多源自动同步", "标签智能中文化", "分类药丸过滤", "一键快捷引用"],
    },
    {
        id: "assets",
        title: "本地素材中心",
        subtitle: "纯本地离线隐私",
        description: "全工程基于浏览器 IndexedDB 驱动，无痕去元数据重编码，支持 WebDAV 跨端私有数据备份。",
        href: "/assets",
        badge: "数据安全",
        icon: Images,
        colorClass: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border-stone-200 dark:border-stone-700",
        tags: ["零云端隐私外泄", "去 EXIF 与元数据", "WebDAV 直连同步", "多节点高频复用"],
    },
];

// 技术优势卡片（类似微信网关）
const gatewayAdvantages = [
    {
        icon: Zap,
        title: "双通道链路智能调度",
        description: "同域代理请求头清洗防 CORS 与 Mixed Content 拦截；遇到代理异常或超时自动秒级回退浏览器直连兜底，保障请求顺畅。",
    },
    {
        icon: ShieldCheck,
        title: "100% 本地隐私自主",
        description: "画布工程、历史生成记录与高清媒体全量落盘浏览器 IndexedDB，零云端隐私外泄；支持 WebDAV 协议私有云备份与多端同步。",
    },
    {
        icon: Cpu,
        title: "统一 OpenAI 协议网关",
        description: "全面收敛接口协议，以标准 OpenAI 格式无缝兼容生图、视频、语音与多模态大模型，无需繁琐的私有渠道格式切换。",
    },
    {
        icon: Workflow,
        title: "工业化分镜剧本拆解",
        description: "集成文本大模型一键生成分镜脚本卡片，自动化拆解为“提示词 -> 图 -> 视频”全链路推演工作流，赋能短剧与视觉工业化创作。",
    },
];

// 核心指标数据
const stats = [
    { label: "数据隐私", value: "0 云端留痕", hint: "IndexedDB 本地持久化" },
    { label: "模态矩阵", value: "文 / 图 / 视 / 音", hint: "全流程推演覆盖" },
    { label: "调度链路", value: "双通道兜底", hint: "同域代理 + 直连自适应" },
    { label: "画布交互", value: "毫秒级响应", hint: "无限自由连线推演" },
];

export default function IndexPage() {
    return (
        <main className="relative h-full overflow-y-auto bg-background bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px] text-stone-950 dark:bg-[radial-gradient(rgba(245,245,244,.1)_1px,transparent_1px)] dark:text-stone-100">
            {/* 关键帧动画定义 */}
            <style>{`
                @keyframes caret-blink {
                    50% { opacity: 0; }
                }
                .animate-caret-blink {
                    animation: caret-blink 1s step-end infinite;
                }
                @keyframes line-flow {
                    to {
                        stroke-dashoffset: -20;
                    }
                }
                .animate-line-flow {
                    animation: line-flow 8s linear infinite;
                }
                @keyframes aurora-glow {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
                .animate-aurora-glow {
                    background-size: 200% 200%;
                    animation: aurora-glow 15s ease infinite;
                }
            `}</style>

            {/* 顶部柔和的环境微光 */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] overflow-hidden">
                <div className="absolute left-1/2 -top-24 h-[360px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-b from-emerald-400/10 via-blue-400/5 to-transparent blur-[120px] dark:from-emerald-500/10 dark:via-blue-500/5" />
            </div>

            <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
                {/* 1. Hero 区域：极简清爽的微信开发者平台风格 */}
                <motion.section variants={containerVariants} initial="hidden" animate="visible" className="flex flex-col items-center pt-4 text-center sm:pt-8">
                    {/* 徽标胶囊标签 */}
                    <motion.div
                        variants={itemVariants}
                        className="mb-6 inline-flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/90 px-3.5 py-1.5 text-xs font-medium text-stone-700 shadow-[0_2px_8px_rgba(0,0,0,0.02)] backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/80 dark:text-stone-300"
                    >
                        <span className="flex size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                        <span>C-AI 画布 · 开发者多模态创意工作台</span>
                    </motion.div>

                    {/* 主标题 */}
                    <motion.h1
                        variants={itemVariants}
                        className="max-w-4xl text-balance text-4xl font-semibold tracking-tight text-stone-900 sm:text-6xl lg:text-7xl dark:text-stone-50"
                    >
                        从单次生成 到{" "}
                        <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 bg-clip-text text-transparent dark:from-emerald-400 dark:via-teal-300 dark:to-blue-400">
                            连续推演
                        </span>
                    </motion.h1>

                    {/* 微信风格副标：通透、直接、专业 */}
                    <motion.p
                        variants={itemVariants}
                        className="mt-6 max-w-2xl text-balance text-base text-stone-600 sm:text-lg sm:leading-relaxed dark:text-stone-400"
                    >
                        一站式连接无限画布、多模态生图与视频创作工坊。标准协议调度主流大模型，让创意推演更连贯，赋能影视分镜与视觉设计工业化生产。
                    </motion.p>

                    {/* CTA 按钮组 */}
                    <motion.div variants={itemVariants} className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
                        <Button
                            type="primary"
                            size="large"
                            href="/canvas"
                            className="group h-11 rounded-full px-6 text-sm font-medium shadow-sm transition hover:scale-[1.02]"
                        >
                            <span className="flex items-center gap-1.5">
                                打开无限画布
                                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                            </span>
                        </Button>
                        <Button
                            size="large"
                            href="#capabilities"
                            className="h-11 rounded-full border-stone-200 bg-white px-6 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 hover:text-stone-950 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800"
                        >
                            探索核心能力
                        </Button>
                        <Button
                            size="large"
                            href={DOCS_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-11 rounded-full border-stone-200 bg-white px-5 text-sm font-medium text-stone-600 shadow-sm transition hover:bg-stone-50 hover:text-stone-950 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400"
                            icon={<BookOpen className="size-4" />}
                        >
                            开发文档
                        </Button>
                    </motion.div>

                    {/* 核心指标条（微信网关风格的数据栏） */}
                    <motion.div
                        variants={itemVariants}
                        className="mt-14 w-full max-w-4xl rounded-2xl border border-stone-200/80 bg-white/70 p-4 shadow-[0_2px_16px_rgba(0,0,0,0.02)] backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/60"
                    >
                        <div className="grid grid-cols-2 gap-4 divide-y divide-stone-100 sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-stone-800">
                            {stats.map((stat, i) => (
                                <div key={i} className={`flex flex-col items-center justify-center ${i > 0 ? "pt-3 sm:pt-0" : ""}`}>
                                    <span className="text-lg font-semibold tracking-tight text-stone-900 sm:text-xl dark:text-stone-100">
                                        {stat.value}
                                    </span>
                                    <span className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                                        {stat.hint}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </motion.section>

                {/* 2. 核心产品与能力矩阵（Service Matrix - 微信开发者平台经典卡片布局） */}
                <section id="capabilities" className="mt-20 scroll-mt-12 sm:mt-28">
                    <div className="flex flex-col items-center text-center mb-12">
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                            <Layers className="size-3.5" />
                            <span>核心产品矩阵</span>
                        </div>
                        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl dark:text-stone-100">
                            一站式多模态创作与推演服务
                        </h2>
                        <p className="mt-2.5 max-w-xl text-sm text-stone-500 dark:text-stone-400">
                            覆盖从灵感整理、分镜拆解、图像生成到动态视频合成的全生命周期工具
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                        {capabilityServices.map((service, index) => {
                            const IconComponent = service.icon;
                            const isLarge = index === 0;
                            return (
                                <Link
                                    key={service.id}
                                    href={service.href}
                                    className={`group relative flex flex-col justify-between rounded-2xl border border-stone-200/80 bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-[0_12px_28px_rgba(0,0,0,0.06)] dark:border-stone-800 dark:bg-stone-900/70 dark:hover:border-emerald-500/30 ${
                                        isLarge ? "md:col-span-2 lg:col-span-2" : ""
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className={`flex size-11 items-center justify-center rounded-xl border ${service.colorClass}`}>
                                                <IconComponent className="size-5" />
                                            </div>
                                            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                                                {service.badge}
                                            </span>
                                        </div>

                                        <div className="mt-5">
                                            <h3 className="text-lg font-semibold text-stone-900 transition-colors group-hover:text-emerald-600 dark:text-stone-100 dark:group-hover:text-emerald-400">
                                                {service.title}
                                            </h3>
                                            <p className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                                                {service.description}
                                            </p>
                                        </div>

                                        <div className="mt-5 flex flex-wrap gap-1.5">
                                            {service.tags.map((tag, tIndex) => (
                                                <span
                                                    key={tIndex}
                                                    className="inline-flex items-center gap-1 rounded-md bg-stone-50 px-2 py-1 text-[11px] font-medium text-stone-600 border border-stone-100 dark:bg-stone-800/60 dark:text-stone-400 dark:border-stone-700/50"
                                                >
                                                    <CheckCircle2 className="size-3 text-emerald-500" />
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-6 flex items-center gap-1 text-xs font-medium text-stone-900 group-hover:text-emerald-600 dark:text-stone-200 dark:group-hover:text-emerald-400">
                                        <span>立即体验</span>
                                        <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </section>

                {/* 3. 架构优势与技术特性（微信网关风格布局） */}
                <section className="mt-20 sm:mt-28">
                    <div className="rounded-3xl border border-stone-200/80 bg-white/80 p-8 shadow-[0_2px_16px_rgba(0,0,0,0.02)] backdrop-blur-md sm:p-12 dark:border-stone-800 dark:bg-stone-900/60">
                        <div className="max-w-2xl">
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                                <ShieldCheck className="size-3.5" />
                                <span>安全 · 高可用 · 标准协议</span>
                            </div>
                            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl dark:text-stone-100">
                                面向生产级场景的技术架构与保障
                            </h2>
                            <p className="mt-2.5 text-sm text-stone-500 dark:text-stone-400">
                                融合前端离线存储、双通道高可用调度与统一大模型协议，保障创作链路稳定顺畅
                            </p>
                        </div>

                        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                            {gatewayAdvantages.map((adv, idx) => {
                                const Icon = adv.icon;
                                return (
                                    <div
                                        key={idx}
                                        className="flex flex-col rounded-2xl border border-stone-100 bg-stone-50/70 p-5 transition-colors hover:border-stone-200 dark:border-stone-800/80 dark:bg-stone-950/40 dark:hover:border-stone-700"
                                    >
                                        <div className="flex size-10 items-center justify-center rounded-xl bg-white shadow-xs dark:bg-stone-800">
                                            <Icon className="size-5 text-stone-800 dark:text-stone-200" />
                                        </div>
                                        <h3 className="mt-4 text-sm font-semibold text-stone-900 dark:text-stone-100">
                                            {adv.title}
                                        </h3>
                                        <p className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                                            {adv.description}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* 4. 动态连线推演工作流演示（Live Workflow Showcase） */}
                <section className="mt-20 sm:mt-28">
                    <div className="flex flex-col items-center text-center mb-10">
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                            <Sparkles className="size-3.5" />
                            <span>连线推演工作流演示</span>
                        </div>
                        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl dark:text-stone-100">
                            从灵感提示词到影视级视频渲染
                        </h2>
                        <p className="mt-2.5 max-w-xl text-sm text-stone-500 dark:text-stone-400">
                            节点间通过有向折线实时传输数据与媒体，实现全流程可视化协作
                        </p>
                    </div>

                    <div className="relative mx-auto w-full max-w-5xl rounded-3xl border border-stone-200/80 bg-stone-50/50 p-6 sm:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.03)] backdrop-blur-md dark:border-stone-800 dark:bg-stone-950/40">
                        <div className="relative min-h-[380px] lg:h-[400px] flex flex-col lg:block gap-6 lg:gap-0 items-center justify-center">
                            {/* SVG 连线流光 */}
                            <svg className="absolute inset-0 w-full h-full pointer-events-none hidden lg:block">
                                <motion.path
                                    d="M 288 120 C 340 120, 360 250, 420 250"
                                    fill="none"
                                    stroke="rgba(120, 113, 108, 0.15)"
                                    strokeWidth="1.8"
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
                                />
                                <motion.path
                                    d="M 288 120 C 340 120, 360 250, 420 250"
                                    fill="none"
                                    stroke="rgba(16, 185, 129, 0.5)"
                                    strokeWidth="1.8"
                                    strokeDasharray="4,16"
                                    className="animate-line-flow"
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
                                />

                                <motion.path
                                    d="M 640 250 C 700 250, 720 120, 768 120"
                                    fill="none"
                                    stroke="rgba(120, 113, 108, 0.15)"
                                    strokeWidth="1.8"
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ delay: 0.8, duration: 1, ease: "easeOut" }}
                                />
                                <motion.path
                                    d="M 640 250 C 700 250, 720 120, 768 120"
                                    fill="none"
                                    stroke="rgba(168, 85, 247, 0.5)"
                                    strokeWidth="1.8"
                                    strokeDasharray="4,16"
                                    className="animate-line-flow"
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ delay: 0.8, duration: 1, ease: "easeOut" }}
                                />

                                <motion.circle cx="420" cy="250" r="4" fill="#10b981" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1, duration: 0.4 }} />
                                <motion.circle cx="768" cy="120" r="4" fill="#a855f7" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.3, duration: 0.4 }} />
                            </svg>

                            {/* 节点 1：提示词卡片 */}
                            <motion.div
                                className="w-full sm:w-72 rounded-2xl border border-stone-200/90 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900 lg:absolute lg:left-0 lg:top-[8%]"
                                animate={{ y: [0, -3, 0] }}
                                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                            >
                                <div className="flex items-center justify-between mb-2.5 border-b border-stone-100 pb-2 dark:border-stone-800">
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300">
                                        <FileText className="size-3.5 text-emerald-500" />
                                        <span>提示词分镜</span>
                                    </div>
                                    <span className="text-[10px] rounded-full bg-emerald-50 text-emerald-600 px-2 py-0.5 font-medium dark:bg-emerald-950/50 dark:text-emerald-400">已就绪</span>
                                </div>
                                <div className="text-xs leading-relaxed text-stone-700 dark:text-stone-300 bg-stone-50 dark:bg-stone-950/50 p-2.5 rounded-xl border border-stone-100 dark:border-stone-800 min-h-[64px]">
                                    <span className="font-mono text-emerald-600 font-semibold dark:text-emerald-400">/prompt</span>{" "}
                                    <motion.span variants={sentenceVariants} initial="hidden" animate="visible">
                                        {promptText.split("").map((char, index) => (
                                            <motion.span key={index} variants={letterVariants}>
                                                {char}
                                            </motion.span>
                                        ))}
                                    </motion.span>
                                    <span className="inline-block w-1 h-3 ml-0.5 bg-emerald-500 animate-caret-blink" />
                                </div>
                            </motion.div>

                            {/* 节点 2：生图卡片 */}
                            <motion.div
                                className="w-full sm:w-[230px] rounded-2xl border border-stone-200/90 bg-white p-3.5 shadow-sm dark:border-stone-800 dark:bg-stone-900 lg:absolute lg:left-1/2 lg:top-[42%] lg:-translate-x-1/2"
                                animate={{ y: [0, 3, 0] }}
                                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                            >
                                <div className="flex items-center justify-between mb-2 border-b border-stone-100 pb-1.5 dark:border-stone-800">
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300">
                                        <ImageIcon className="size-3.5 text-blue-500" />
                                        <span>生图节点</span>
                                    </div>
                                    <div className="text-[10px] text-stone-400">Flux.1</div>
                                </div>
                                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-stone-900">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-purple-600 via-blue-600 to-emerald-400 opacity-80 mix-blend-color-dodge animate-aurora-glow" />
                                    <div className="absolute inset-0 bg-black/10 backdrop-blur-[0.5px]" />
                                    <div className="absolute inset-x-2 bottom-2 flex flex-col justify-end p-1.5 rounded bg-black/40 backdrop-blur-sm">
                                        <span className="text-[10px] font-mono font-medium text-white truncate">#001_魔法猫咪.png</span>
                                        <span className="text-[8px] text-stone-300">1024 x 1024 px · 1:1</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mt-2 text-[10px] text-stone-500">
                                    <span>图片参考已连接</span>
                                    <span className="text-emerald-500 font-medium">生成完成 100%</span>
                                </div>
                            </motion.div>

                            {/* 节点 3：视频卡片 */}
                            <motion.div
                                className="w-full sm:w-72 rounded-2xl border border-stone-200/90 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900 lg:absolute lg:right-0 lg:top-[10%]"
                                animate={{ y: [0, -4, 0] }}
                                transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
                            >
                                <div className="flex items-center justify-between mb-2.5 border-b border-stone-100 pb-2 dark:border-stone-800">
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300">
                                        <Video className="size-3.5 text-purple-500" />
                                        <span>视频合成节点</span>
                                    </div>
                                    <div className="text-[10px] text-stone-400">Seedance 2.5</div>
                                </div>
                                <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-stone-950">
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-stone-900 to-purple-950 opacity-90" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="flex size-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white">
                                            <Play className="size-3 fill-white ml-0.5" />
                                        </div>
                                    </div>
                                    <motion.div 
                                        className="absolute right-3 bottom-3 text-white pointer-events-none drop-shadow-md hidden sm:block"
                                        animate={{ x: [-15, 0, -15], y: [15, 0, 15] }}
                                        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                                    >
                                        <MousePointer className="size-3.5 fill-white text-stone-900" />
                                    </motion.div>
                                </div>
                                <div className="mt-2.5">
                                    <div className="flex items-center justify-between text-[10px] text-stone-500 mb-1">
                                        <span>动态视频渲染 (5.0s)</span>
                                        <span className="text-purple-600 dark:text-purple-400 font-medium">连续推演中...</span>
                                    </div>
                                    <div className="h-1 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full bg-gradient-to-r from-purple-500 to-emerald-500"
                                            animate={{ width: ["25%", "80%", "25%"] }}
                                            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* 5. 底部 CTA 与清爽 Footer（微信开发者平台风格） */}
                <section className="mt-20 border-t border-stone-200/80 pt-16 sm:mt-28 dark:border-stone-800">
                    <div className="rounded-3xl bg-gradient-to-b from-stone-900 to-stone-950 px-6 py-12 text-center text-white sm:px-12 sm:py-16 dark:from-stone-900/90 dark:to-stone-950">
                        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                            准备好开启新一代多模态创作推演了吗？
                        </h2>
                        <p className="mx-auto mt-3 max-w-xl text-sm text-stone-400">
                            无论单个镜头创作还是整套短剧镜头推演，C-AI 画布让一切井然有序。
                        </p>
                        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                            <Button
                                type="primary"
                                size="large"
                                href="/canvas"
                                className="h-11 rounded-full px-7 text-sm font-medium shadow-sm transition hover:scale-105"
                            >
                                立即进入画布
                            </Button>
                            <Button
                                size="large"
                                href={GITHUB_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-11 rounded-full border-stone-700 bg-stone-800/80 px-6 text-sm font-medium text-stone-300 hover:bg-stone-700 hover:text-white"
                                icon={<GitBranch className="size-4" />}
                            >
                                GitHub 开源仓库
                            </Button>
                        </div>
                    </div>

                    {/* Footer 链接与版权信息 */}
                    <footer className="mt-12 flex flex-col items-center justify-between gap-4 pb-8 sm:flex-row text-xs text-stone-500 dark:text-stone-400">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-stone-700 dark:text-stone-300">C-AI 画布</span>
                            <span>·</span>
                            <span>开源多模态创意工作台</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-5">
                            <a href="/canvas" className="transition hover:text-stone-950 dark:hover:text-stone-200">我的画布</a>
                            <a href="/image" className="transition hover:text-stone-950 dark:hover:text-stone-200">生图工作台</a>
                            <a href="/video" className="transition hover:text-stone-950 dark:hover:text-stone-200">视频创作台</a>
                            <a href="/prompts" className="transition hover:text-stone-950 dark:hover:text-stone-200">提示词库</a>
                            <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition hover:text-stone-950 dark:hover:text-stone-200">
                                <span>开发文档</span>
                                <ExternalLink className="size-3" />
                            </a>
                        </div>
                    </footer>
                </section>
            </div>
        </main>
    );
}
