import { useState, type AnchorHTMLAttributes } from "react";
import {
    ArrowRight,
    BookOpen,
    Cpu,
    ExternalLink,
    FileText,
    GitBranch,
    Image as ImageIcon,
    ImagePlus,
    Images,
    Maximize2,
    MousePointer,
    Play,
    ShieldCheck,
    Sparkles,
    Video,
    Workflow,
    Zap,
} from "lucide-react";
import { Button } from "antd";
import { motion, AnimatePresence } from "motion/react";
import type { Variants } from "motion/react";

import { DOCS_URL } from "@/constant/env";

const GITHUB_URL = "https://github.com/cangerx/c-aihuabu";

function Link({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return <a href={href} {...props} />;
}

// 动画变体配置
const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
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
            duration: 0.8,
            ease: [0.16, 1, 0.3, 1],
        },
    },
};

// 交互式场景数据（对齐微信网关交互式场景 Tabs）
const scenarios = [
    {
        id: "storyboard",
        label: "短剧分镜拆解",
        tag: "影视工业化",
        title: "一键将故事文本转化为结构化分镜与镜头序列",
        desc: "传统短剧创作需要在提示词、生图、生成视频多个工具之间反复复制粘贴。在 C-AI 画布中，文本大模型一键生成连续镜头卡片，自动派发图片与视频推演工作流，全流程井然有序。",
        metric: "推演效率提升 300%",
    },
    {
        id: "continuity",
        label: "角色视觉连续性",
        tag: "多模态推演",
        title: "以参考图与首尾帧为锚点，锁定角色特征与光影质感",
        desc: "打破单次孤立生成的随机性，连线节点自动将上游角色形象、动作与风格作为参考输入，支持首尾帧过渡与全能参考模式，实现高保真连续推演。",
        metric: "多镜头一致性保持",
    },
    {
        id: "concept",
        label: "无边界灵感推演",
        tag: "自由连线图",
        title: "无限展开的无界画布，容纳万千灵感分叉与版本推演",
        desc: "没有固定的画幅与边界限制，无论是单个镜头推敲还是数十个推演分支横向对比，皆可通过有向折线自由连接、重组与自动对焦整理。",
        metric: "毫秒级视口对齐",
    },
    {
        id: "automation",
        label: "双通道高可用调度",
        tag: "生产级可靠",
        title: "同域代理头清洗与浏览器端直连兜底，告别中断与超时",
        desc: "独创双通道架构，同域代理清洗边缘节点请求头杜绝 CORS 与跨域混淆；上游故障或网络超时自动切换浏览器直连，保障全天候连续创作。",
        metric: "99.9% 链路高可用",
    },
];

const promptText = "赛博朋克风格的魔法猫咪，手握发光的能量法杖，正在调试复杂的代码全息屏幕，超写实摄影，电影质感";

export default function IndexPage() {
    const [activeScenarioIndex, setActiveScenarioIndex] = useState(0);
    const activeScenario = scenarios[activeScenarioIndex];

    return (
        <main className="relative h-full overflow-y-auto bg-[#FAFAFA] text-stone-900 selection:bg-emerald-500 selection:text-white dark:bg-stone-950 dark:text-stone-100">
            {/* 关键帧动画 */}
            <style>{`
                @keyframes caret-blink { 50% { opacity: 0; } }
                .animate-caret-blink { animation: caret-blink 1s step-end infinite; }
                @keyframes line-flow { to { stroke-dashoffset: -20; } }
                .animate-line-flow { animation: line-flow 8s linear infinite; }
                @keyframes aurora-glow {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
                .animate-aurora-glow {
                    background-size: 200% 200%;
                    animation: aurora-glow 15s ease infinite;
                }
            `}</style>

            {/* 顶部通透的背景微纹理 */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[640px] overflow-hidden">
                <div className="absolute left-1/2 -top-40 h-[480px] w-[1000px] -translate-x-1/2 rounded-full bg-gradient-to-b from-emerald-400/10 via-teal-400/5 to-transparent blur-[140px] dark:from-emerald-500/10 dark:via-teal-500/5" />
            </div>

            <div className="relative mx-auto max-w-[1224px] px-6 sm:px-8 lg:px-12">
                {/* 1. Hero 首屏区：微信网关大尺度呼吸感 */}
                <motion.section
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="flex flex-col items-center pt-24 pb-20 text-center sm:pt-32 sm:pb-28 lg:pt-40 lg:pb-36"
                >
                    {/* 徽标胶囊 */}
                    <motion.div
                        variants={itemVariants}
                        className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-stone-200/90 bg-white px-4 py-2 text-xs font-medium text-stone-700 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:border-stone-800 dark:bg-stone-900/90 dark:text-stone-300"
                    >
                        <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        <span>C-AI 画布 · 开发者多模态创意工作台</span>
                    </motion.div>

                    {/* 磅礴大标题（56px~72px 微信网关级视觉冲击） */}
                    <motion.h1
                        variants={itemVariants}
                        className="max-w-4xl text-balance text-4xl font-bold tracking-tight text-stone-900 sm:text-6xl lg:text-7xl dark:text-white"
                    >
                        从单次生成 到{" "}
                        <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 bg-clip-text text-transparent dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-400">
                            连续推演
                        </span>
                    </motion.h1>

                    {/* 20px 纯净大副标 */}
                    <motion.p
                        variants={itemVariants}
                        className="mt-8 max-w-2xl text-balance text-lg font-normal leading-relaxed text-stone-500 sm:text-xl sm:leading-relaxed dark:text-stone-400"
                    >
                        一站式连接无限画布、多模态生图与视频创作工坊。标准协议调度主流大模型，让视觉推演更连贯，赋能影视分镜与视觉工业化生产。
                    </motion.p>

                    {/* 微信网关同款大尺寸胶囊按钮组 */}
                    <motion.div variants={itemVariants} className="mt-12 flex flex-wrap items-center justify-center gap-4">
                        <Button
                            type="primary"
                            size="large"
                            href="/canvas"
                            className="group h-13 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 px-8 text-base font-semibold text-white shadow-[0_4px_20px_rgba(16,185,129,0.3)] transition-all duration-300 hover:scale-[1.02] hover:from-emerald-500 hover:to-emerald-400 dark:shadow-[0_4px_20px_rgba(16,185,129,0.2)]"
                        >
                            <span className="flex items-center gap-2">
                                打开无限画布
                                <ArrowRight className="size-4.5 transition-transform duration-200 group-hover:translate-x-1" />
                            </span>
                        </Button>
                        <Button
                            size="large"
                            href={DOCS_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-13 rounded-full border border-stone-200/90 bg-white px-7 text-base font-medium text-stone-800 shadow-sm transition hover:bg-stone-50 hover:text-stone-950 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
                            icon={<BookOpen className="size-4.5 text-stone-500" />}
                        >
                            开发文档
                        </Button>
                    </motion.div>
                </motion.section>

                {/* 2. 独家优势 Bento Grid（微信网关同款便当盒大网格：大数字、大格局、无杂乱） */}
                <section className="mt-12 sm:mt-20">
                    <div className="mb-10 text-center">
                        <h2 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-white">
                            核心架构优势
                        </h2>
                        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
                            面向专业视觉推演与生成场景设计的高性能基础设施
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {/* Bento 1: 核心大卡片 */}
                        <div className="flex flex-col justify-between rounded-3xl border border-stone-200/80 bg-white p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] sm:p-10 dark:border-stone-800 dark:bg-stone-900 lg:col-span-2">
                            <div>
                                <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                                    <Maximize2 className="size-6" />
                                </div>
                                <h3 className="mt-6 text-2xl font-bold text-stone-900 dark:text-white">
                                    无限画布自由推演
                                </h3>
                                <p className="mt-3 max-w-xl text-base leading-relaxed text-stone-500 dark:text-stone-400">
                                    打破传统工具单次输入的界限。在无限扩展的平面中摆放节点，双向流光连线实时传输素材与参数，实现从剧本构思到批量渲染的连续演进。
                                </p>
                            </div>
                            <div className="mt-8 flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                <span>支持文本 · 图片 · 视频 · 音频跨模态混排</span>
                            </div>
                        </div>

                        {/* Bento 2: 大指标卡片 (0 云端泄露) */}
                        <div className="flex flex-col justify-between rounded-3xl border border-stone-200/80 bg-white p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] sm:p-10 dark:border-stone-800 dark:bg-stone-900">
                            <div>
                                <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                                    <ShieldCheck className="size-6" />
                                </div>
                                <div className="mt-6 flex items-baseline gap-1">
                                    <span className="text-5xl font-extrabold tracking-tight text-stone-900 dark:text-white">0</span>
                                    <span className="text-lg font-medium text-stone-500">云端留痕</span>
                                </div>
                                <h4 className="mt-2 text-base font-semibold text-stone-900 dark:text-white">
                                    100% 本地隐私自主
                                </h4>
                                <p className="mt-2 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                                    工程资产全量持久化在浏览器 IndexedDB 中，杜绝数据外泄风险；支持 WebDAV 协议私有化跨端备份。
                                </p>
                            </div>
                        </div>

                        {/* Bento 3: 大指标卡片 (100% 协议收敛) */}
                        <div className="flex flex-col justify-between rounded-3xl border border-stone-200/80 bg-white p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] sm:p-10 dark:border-stone-800 dark:bg-stone-900">
                            <div>
                                <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                                    <Cpu className="size-6" />
                                </div>
                                <div className="mt-6 flex items-baseline gap-1">
                                    <span className="text-5xl font-extrabold tracking-tight text-stone-900 dark:text-white">统一</span>
                                    <span className="text-lg font-medium text-stone-500">OpenAI 契约</span>
                                </div>
                                <h4 className="mt-2 text-base font-semibold text-stone-900 dark:text-white">
                                    标准多模态模型网关
                                </h4>
                                <p className="mt-2 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                                    彻底消除碎片化私有接口差异。以统一协议调度 GPT-Image、Gemini、Grok、Seedance 及 Videos-4 前沿模型。
                                </p>
                            </div>
                        </div>

                        {/* Bento 4: 性能与调度大卡片 */}
                        <div className="flex flex-col justify-between rounded-3xl border border-stone-200/80 bg-white p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] sm:p-10 dark:border-stone-800 dark:bg-stone-900 lg:col-span-2">
                            <div>
                                <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                                    <Zap className="size-6" />
                                </div>
                                <h3 className="mt-6 text-2xl font-bold text-stone-900 dark:text-white">
                                    双通道链路智能调度
                                </h3>
                                <p className="mt-3 max-w-xl text-base leading-relaxed text-stone-500 dark:text-stone-400">
                                    同域 AI 代理自动清洗边缘请求头，杜绝 CORS 与 Mixed Content 拦截；在代理遭遇网络抖动或超时时，浏览器端无感自动直连兜底。
                                </p>
                            </div>
                            <div className="mt-8 flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                                <span>毫秒级故障自愈 · 99.9% 请求成功率</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. 核心功能矩阵（1 主打大横卡 + 2x2 大方卡 - 微信网关标准版式） */}
                <section className="mt-28 sm:mt-36">
                    <div className="mb-12 text-center">
                        <h2 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-white">
                            全流程产品功能矩阵
                        </h2>
                        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
                            打通多模态生成的关键环节，让每一次创作触手可及
                        </p>
                    </div>

                    {/* 主打大横卡 (Hero Feature Card) */}
                    <div className="rounded-3xl border border-stone-200/80 bg-white p-8 shadow-[0_4px_24px_rgba(0,0,0,0.03)] sm:p-12 dark:border-stone-800 dark:bg-stone-900">
                        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
                            {/* 左侧大幅可视化推演流水线 */}
                            <div className="relative min-h-[300px] lg:col-span-7 flex items-center justify-center rounded-2xl bg-stone-50 p-6 dark:bg-stone-950/60 border border-stone-100 dark:border-stone-800">
                                <svg className="absolute inset-0 size-full pointer-events-none hidden sm:block">
                                    <path d="M 120 150 C 180 150, 200 150, 260 150" fill="none" stroke="rgba(16, 185, 129, 0.4)" strokeWidth="2" strokeDasharray="4,8" className="animate-line-flow" />
                                    <path d="M 380 150 C 440 150, 460 150, 520 150" fill="none" stroke="rgba(168, 85, 247, 0.4)" strokeWidth="2" strokeDasharray="4,8" className="animate-line-flow" />
                                </svg>
                                <div className="relative flex flex-wrap items-center justify-center gap-4 z-10 w-full">
                                    <div className="w-44 rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
                                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                            <FileText className="size-3.5" />
                                            <span>提示词分镜</span>
                                        </div>
                                        <div className="mt-2 text-[11px] text-stone-500 font-mono line-clamp-2">/prompt 赛博魔法猫咪...</div>
                                    </div>
                                    <div className="w-44 rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
                                        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                                            <ImageIcon className="size-3.5" />
                                            <span>生图节点</span>
                                        </div>
                                        <div className="mt-2 text-[11px] text-stone-500 font-mono">1024x1024 · 渲染完毕</div>
                                    </div>
                                    <div className="w-44 rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
                                        <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
                                            <Video className="size-3.5" />
                                            <span>视频节点</span>
                                        </div>
                                        <div className="mt-2 text-[11px] text-stone-500 font-mono">Seedance 2.5 · 5.0s</div>
                                    </div>
                                </div>
                            </div>

                            {/* 右侧大标题与价值阐述 */}
                            <div className="lg:col-span-5">
                                <span className="text-xs font-semibold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
                                    核心引擎
                                </span>
                                <h3 className="mt-3 text-2xl font-bold text-stone-900 sm:text-3xl dark:text-white">
                                    工业化分镜推演管线
                                </h3>
                                <p className="mt-4 text-base leading-relaxed text-stone-500 dark:text-stone-400">
                                    通过文本大模型快速生成分镜脚本，一键拆分为完整的“分镜文本 ➔ 图片节点 ➔ 视频节点”流水线，实现多镜头连续生成与推演。
                                </p>
                                <div className="mt-8">
                                    <Button type="primary" href="/canvas" className="h-11 rounded-full px-6 font-medium">
                                        立即开启推演
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 下方 2x2 大方卡（大字号、精简文案、无碎标签） */}
                    <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                        {/* 卡片 1：生图 */}
                        <div className="flex flex-col justify-between rounded-3xl border border-stone-200/80 bg-white p-8 sm:p-12 shadow-[0_4px_20px_rgba(0,0,0,0.02)] dark:border-stone-800 dark:bg-stone-900">
                            <div>
                                <div className="inline-flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                                    <ImagePlus className="size-5.5" />
                                </div>
                                <h3 className="mt-6 text-xl font-bold text-stone-900 dark:text-white">
                                    全模态生图工作台
                                </h3>
                                <p className="mt-3 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                                    原生支持 GPT-Image-2、Gemini、Grok Imagine 与 StepFun 模型。尺寸自适应匹配各模型官方规格，多任务并发提交，结果即刻展示并后台无感落盘。
                                </p>
                            </div>
                            <div className="mt-8">
                                <Link href="/image" className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-900 hover:text-emerald-600 dark:text-stone-200 dark:hover:text-emerald-400">
                                    <span>进入生图工作台</span>
                                    <ArrowRight className="size-3.5" />
                                </Link>
                            </div>
                        </div>

                        {/* 卡片 2：视频 */}
                        <div className="flex flex-col justify-between rounded-3xl border border-stone-200/80 bg-white p-8 sm:p-12 shadow-[0_4px_20px_rgba(0,0,0,0.02)] dark:border-stone-800 dark:bg-stone-900">
                            <div>
                                <div className="inline-flex size-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                                    <Video className="size-5.5" />
                                </div>
                                <h3 className="mt-6 text-xl font-bold text-stone-900 dark:text-white">
                                    电影级视频创作工坊
                                </h3>
                                <p className="mt-3 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                                    全面适配 Seedance 2.5 全能参考与 Videos-4 系列模型。支持文生、图生与首尾帧平滑过渡，长任务后台 30 分钟不间断轮询，实时回传真实进度。
                                </p>
                            </div>
                            <div className="mt-8">
                                <Link href="/video" className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-900 hover:text-emerald-600 dark:text-stone-200 dark:hover:text-emerald-400">
                                    <span>进入视频创作台</span>
                                    <ArrowRight className="size-3.5" />
                                </Link>
                            </div>
                        </div>

                        {/* 卡片 3：提示词 */}
                        <div className="flex flex-col justify-between rounded-3xl border border-stone-200/80 bg-white p-8 sm:p-12 shadow-[0_4px_20px_rgba(0,0,0,0.02)] dark:border-stone-800 dark:bg-stone-900">
                            <div>
                                <div className="inline-flex size-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                                    <FileText className="size-5.5" />
                                </div>
                                <h3 className="mt-6 text-xl font-bold text-stone-900 dark:text-white">
                                    开源提示词灵感中心
                                </h3>
                                <p className="mt-3 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                                    深度集成六大多源开源提示词仓库，智能清洗无效标签并中文化映射。支持自定义数据源周期性拉取，一键快速引用至画布与生图面板。
                                </p>
                            </div>
                            <div className="mt-8">
                                <Link href="/prompts" className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-900 hover:text-emerald-600 dark:text-stone-200 dark:hover:text-emerald-400">
                                    <span>浏览提示词库</span>
                                    <ArrowRight className="size-3.5" />
                                </Link>
                            </div>
                        </div>

                        {/* 卡片 4：素材 */}
                        <div className="flex flex-col justify-between rounded-3xl border border-stone-200/80 bg-white p-8 sm:p-12 shadow-[0_4px_20px_rgba(0,0,0,0.02)] dark:border-stone-800 dark:bg-stone-900">
                            <div>
                                <div className="inline-flex size-11 items-center justify-center rounded-xl bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                                    <Images className="size-5.5" />
                                </div>
                                <h3 className="mt-6 text-xl font-bold text-stone-900 dark:text-white">
                                    本地数字资产存储
                                </h3>
                                <p className="mt-3 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                                    纯本地离线驱动，素材与记录不传第三方云端。支持画布内一键 Canvas 去元数据无痕重编码，并通过 WebDAV 实现私有环境安全同步。
                                </p>
                            </div>
                            <div className="mt-8">
                                <Link href="/assets" className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-900 hover:text-emerald-600 dark:text-stone-200 dark:hover:text-emerald-400">
                                    <span>管理我的素材</span>
                                    <ArrowRight className="size-3.5" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 4. 交互式应用场景选项卡（微信网关同款交互：痛点与方案大卡片） */}
                <section className="mt-28 sm:mt-36">
                    <div className="mb-10 text-center">
                        <h2 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-white">
                            业务场景与解决方案
                        </h2>
                        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
                            深入实际内容创作场景，解决视觉生成中的核心痛点
                        </p>
                    </div>

                    {/* 场景选项卡导航栏 */}
                    <div className="flex justify-center">
                        <div className="inline-flex max-w-full overflow-x-auto rounded-full border border-stone-200/80 bg-white p-1.5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
                            {scenarios.map((sc, i) => (
                                <button
                                    key={sc.id}
                                    type="button"
                                    onClick={() => setActiveScenarioIndex(i)}
                                    className={`rounded-full px-5 py-2 text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
                                        activeScenarioIndex === i
                                            ? "bg-emerald-600 text-white shadow-sm"
                                            : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
                                    }`}
                                >
                                    {sc.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 场景大卡片展示区 */}
                    <div className="mt-8 min-h-[260px] rounded-3xl border border-stone-200/80 bg-white p-8 sm:p-14 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-stone-800 dark:bg-stone-900">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeScenario.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12"
                            >
                                <div className="lg:col-span-8">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                        {activeScenario.tag}
                                    </span>
                                    <h3 className="mt-4 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-white">
                                        {activeScenario.title}
                                    </h3>
                                    <p className="mt-4 text-base leading-relaxed text-stone-500 dark:text-stone-400">
                                        {activeScenario.desc}
                                    </p>
                                </div>
                                <div className="flex flex-col items-start lg:items-end justify-center lg:col-span-4 border-t lg:border-t-0 lg:border-l border-stone-100 dark:border-stone-800 pt-6 lg:pt-0 lg:pl-10">
                                    <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">预期收益</span>
                                    <span className="mt-1 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                                        {activeScenario.metric}
                                    </span>
                                    <Button type="primary" href="/canvas" className="mt-6 rounded-full px-6">
                                        进入场景体验
                                    </Button>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </section>

                {/* 5. 底部试用大横幅与极简 Footer（微信网关风格） */}
                <section className="mt-28 mb-16 sm:mt-36">
                    <div className="rounded-3xl bg-gradient-to-b from-stone-900 to-stone-950 px-8 py-16 text-center text-white sm:px-16 sm:py-20 dark:from-stone-900/90 dark:to-stone-950">
                        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                            即刻开启新一代多模态创作推演
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-base text-stone-400">
                            从灵感火花到完整影视分镜，C-AI 画布全方位赋能专业创作者。
                        </p>
                        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                            <Button
                                type="primary"
                                size="large"
                                href="/canvas"
                                className="h-12 rounded-full bg-emerald-600 px-8 text-sm font-semibold hover:bg-emerald-500"
                            >
                                免费使用画布
                            </Button>
                            <Button
                                size="large"
                                href={GITHUB_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-12 rounded-full border-stone-700 bg-stone-800/80 px-7 text-sm font-medium text-stone-300 hover:bg-stone-700 hover:text-white"
                                icon={<GitBranch className="size-4" />}
                            >
                                GitHub 仓库
                            </Button>
                        </div>
                    </div>

                    {/* 极简清爽 Footer */}
                    <footer className="mt-16 flex flex-col items-center justify-between gap-4 pb-8 sm:flex-row text-xs text-stone-400">
                        <div>
                            <span className="font-semibold text-stone-700 dark:text-stone-300">C-AI 画布</span>
                            <span className="mx-2">·</span>
                            <span>新一代多模态连线推演平台</span>
                        </div>
                        <div className="flex items-center gap-6">
                            <a href="/canvas" className="hover:text-stone-900 dark:hover:text-white transition-colors">画布</a>
                            <a href="/image" className="hover:text-stone-900 dark:hover:text-white transition-colors">生图</a>
                            <a href="/video" className="hover:text-stone-900 dark:hover:text-white transition-colors">视频</a>
                            <a href="/prompts" className="hover:text-stone-900 dark:hover:text-white transition-colors">提示词</a>
                            <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="hover:text-stone-900 dark:hover:text-white transition-colors inline-flex items-center gap-1">
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
