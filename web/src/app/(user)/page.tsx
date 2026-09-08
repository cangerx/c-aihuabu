import { useState, type AnchorHTMLAttributes } from "react";
import {
    ArrowRight,
    BookOpen,
    Check,
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
import { Button } from "antd";
import { motion, AnimatePresence } from "motion/react";
import type { Variants } from "motion/react";

import { DOCS_URL, GITHUB_URL } from "@/constant/env";

function Link({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return <a href={href} {...props} />;
}

// 容器动效
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

// 腾讯 ARDOT 风格的从设计到开发 3 级堆叠卡片 (Switch Stack)
const stackTabs = [
    {
        id: "tab-storyboard",
        label: "高效拆解分镜",
        title: "结构化影视脚本拆解",
        desc: "可视化查看镜头景别、光影氛围与运镜指令，不遗漏任何细节，将单次提示词扩展为全套连续镜头。",
        badge: "剧本工业化",
        metric: "推演效率提升 300%",
        visual: {
            type: "prompt",
            headline: "镜头 01 · 远景推镜",
            sub: "赛博雨夜霓虹街道，魔法法杖微光闪烁，超写实电影质感",
        },
    },
    {
        id: "tab-visual",
        label: "查看所有生成变体",
        title: "自适应多规格画面生成",
        desc: "自适应匹配 GPT-Image、Gemini 与 Grok 官方原生比例，实时查看所有可能的画面变体与多任务并发结果。",
        badge: "多模型聚合",
        metric: "全比例原生适配",
        visual: {
            type: "image",
            headline: "Flux.1 & GPT-Image 2",
            sub: "1024 x 1024 px · 渲染完成 100%",
        },
    },
    {
        id: "tab-video",
        label: "首尾帧视频合成",
        title: "高精度动态镜头渲染",
        desc: "以首尾帧与关键帧画面为锚点，实时调用 Seedance 2.5 与 Videos-4 模型，后台长任务长效轮询。",
        badge: "电影级视效",
        metric: "连续平滑过渡",
        visual: {
            type: "video",
            headline: "Seedance 2.5 · 5.0s",
            sub: "首帧锁定 · 运镜轨迹渲染中",
        },
    },
];

export default function IndexPage() {
    const [activeStackIndex, setActiveStackIndex] = useState(0);
    const currentStack = stackTabs[activeStackIndex];

    return (
        <main className="relative h-full overflow-y-auto bg-[#F7F8FA] text-stone-900 selection:bg-blue-600 selection:text-white dark:bg-[#0E1015] dark:text-stone-100">
            {/* 关键帧动画 */}
            <style>{`
                @keyframes line-flow { to { stroke-dashoffset: -20; } }
                .animate-line-flow { animation: line-flow 8s linear infinite; }
                @keyframes aurora-glow {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
                .animate-aurora-glow {
                    background-size: 200% 200%;
                    animation: aurora-glow 14s ease infinite;
                }
            `}</style>

            {/* 腾讯 ARDOT 经典网格底纹背景 (Grid Background) */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[880px] overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#0000000a_1px,transparent_1px),linear-gradient(to_bottom,#0000000a_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] dark:bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)]" />
                <div className="absolute left-1/2 -top-24 h-[520px] w-[1100px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#089AE9]/15 via-[#0BEF63]/10 to-transparent blur-[140px] dark:from-[#089AE9]/20 dark:via-[#0BEF63]/10" />
            </div>

            <div className="relative mx-auto max-w-[1240px] px-6 sm:px-8 lg:px-12">
                {/* 01. Hero 首屏区 (First Screen Section) */}
                <motion.section
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="flex flex-col items-center pt-24 pb-16 text-center sm:pt-32 sm:pb-20 lg:pt-36 lg:pb-24"
                >
                    {/* 顶部英文标识 */}
                    <motion.div
                        variants={itemVariants}
                        className="mb-6 inline-flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/80 px-4 py-1.5 text-xs font-semibold tracking-wider text-stone-600 uppercase shadow-[0_2px_12px_rgba(0,0,0,0.02)] backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/80 dark:text-stone-300"
                    >
                        <span className="size-2 rounded-full bg-gradient-to-r from-[#089AE9] to-[#0BEF63]" />
                        <span>C-AI Canvas · Next-Gen Multimodal Studio</span>
                    </motion.div>

                    {/* 56px 磅礴主标题 */}
                    <motion.h1
                        variants={itemVariants}
                        className="max-w-4xl text-balance text-4xl font-extrabold tracking-tight text-stone-900 sm:text-6xl lg:text-7xl dark:text-white"
                    >
                        智能多模态推演引擎
                        <br />
                        <span className="bg-gradient-to-r from-[#0052D9] via-[#089AE9] to-[#0BEF63] bg-clip-text text-transparent">
                            让灵感鲜活落地
                        </span>
                    </motion.h1>

                    {/* 18px 腾讯经典副标题 */}
                    <motion.p
                        variants={itemVariants}
                        className="mt-8 max-w-2xl text-balance text-lg font-normal leading-relaxed text-stone-500 sm:text-xl dark:text-stone-400"
                    >
                        从单次生成，走向全链路连续推演。自由连接文本、图像与动态视频，重塑视觉设计与影视分镜的工业化生产流程。
                    </motion.p>

                    {/* 腾讯 ARDOT 同款大圆角主按钮组 */}
                    <motion.div variants={itemVariants} className="mt-12 flex flex-wrap items-center justify-center gap-4">
                        <Button
                            type="primary"
                            size="large"
                            href="/canvas"
                            className="group h-13 rounded-full bg-gradient-to-r from-[#0052D9] to-[#2693FF] px-8 text-base font-semibold text-white shadow-[0_4px_20px_rgba(0,82,217,0.3)] transition-all duration-300 hover:scale-[1.02] hover:opacity-95 dark:shadow-[0_4px_20px_rgba(0,82,217,0.2)]"
                        >
                            <span className="flex items-center gap-2">
                                <MousePointer className="size-4.5 transition-transform duration-200 group-hover:-rotate-12" />
                                开始推演
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
                            帮助文档
                        </Button>
                    </motion.div>
                </motion.section>

                {/* 02. 真实产品核心画布演示 (Product Interface: 视差浮动 UI 元件) */}
                <section className="relative mt-6 sm:mt-10">
                    <div className="relative mx-auto max-w-5xl rounded-3xl border border-stone-200/80 bg-white p-4 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-stone-800 dark:bg-stone-900/90">
                        {/* 画布核心工作区容器 */}
                        <div className="relative min-h-[420px] lg:h-[460px] overflow-hidden rounded-2xl bg-[#12141A] p-6 text-white flex flex-col justify-between">
                            {/* 顶部工具状态条 */}
                            <div className="flex items-center justify-between border-b border-stone-800/80 pb-4">
                                <div className="flex items-center gap-2">
                                    <div className="size-3 rounded-full bg-red-500/80" />
                                    <div className="size-3 rounded-full bg-yellow-500/80" />
                                    <div className="size-3 rounded-full bg-green-500/80" />
                                    <span className="ml-3 font-mono text-xs text-stone-400">c-ai-canvas / project_01.huabu</span>
                                </div>
                                <div className="inline-flex items-center gap-2 rounded-lg bg-stone-800/60 px-3 py-1 text-xs text-stone-300">
                                    <span className="size-2 rounded-full bg-[#0BEF63] animate-pulse" />
                                    <span>双通道实时调度正常</span>
                                </div>
                            </div>

                            {/* 中间模拟画布节点与有向流光连线 */}
                            <div className="relative my-auto flex flex-col lg:flex-row items-center justify-between gap-6 px-4">
                                {/* 浮动 UI 1: 提示词分镜卡 */}
                                <motion.div
                                    animate={{ y: [0, -4, 0] }}
                                    transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                                    className="w-full sm:w-64 rounded-xl border border-stone-700/60 bg-stone-900/90 p-4 shadow-xl backdrop-blur-md"
                                >
                                    <div className="flex items-center justify-between text-xs font-semibold text-stone-300 mb-2">
                                        <span className="flex items-center gap-1.5 text-blue-400">
                                            <FileText className="size-3.5" />
                                            剧本分镜 01
                                        </span>
                                        <span className="text-[10px] text-stone-500">文本节点</span>
                                    </div>
                                    <p className="text-xs text-stone-400 leading-relaxed font-mono">
                                        /prompt 赛博雨夜，霓虹高塔下的魔法猫咪，手握法杖微光...
                                    </p>
                                </motion.div>

                                {/* 连线动效 (SVG Bezier Lines) */}
                                <div className="hidden lg:flex items-center justify-center flex-1 px-4">
                                    <div className="h-0.5 w-full bg-gradient-to-r from-blue-500 via-teal-400 to-purple-500 relative">
                                        <div className="absolute top-1/2 -translate-y-1/2 size-2.5 rounded-full bg-white shadow-[0_0_10px_#0BEF63] animate-ping" />
                                    </div>
                                </div>

                                {/* 浮动 UI 2: 图像渲染节点 */}
                                <motion.div
                                    animate={{ y: [0, 4, 0] }}
                                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                                    className="w-full sm:w-56 rounded-xl border border-stone-700/60 bg-stone-900/90 p-3.5 shadow-xl backdrop-blur-md"
                                >
                                    <div className="flex items-center justify-between text-xs font-semibold text-stone-300 mb-2">
                                        <span className="flex items-center gap-1.5 text-purple-400">
                                            <ImageIcon className="size-3.5" />
                                            生图节点
                                        </span>
                                        <span className="text-[10px] text-stone-500">1024x1024</span>
                                    </div>
                                    <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-stone-950">
                                        <div className="absolute inset-0 bg-gradient-to-tr from-purple-700 via-blue-600 to-emerald-500 opacity-80 mix-blend-color-dodge animate-aurora-glow" />
                                        <div className="absolute inset-x-2 bottom-2 p-1.5 rounded bg-black/50 backdrop-blur-sm text-[10px] text-stone-200">
                                            已生成 #001.png
                                        </div>
                                    </div>
                                </motion.div>

                                {/* 连线动效 2 */}
                                <div className="hidden lg:flex items-center justify-center flex-1 px-4">
                                    <div className="h-0.5 w-full bg-gradient-to-r from-purple-500 to-emerald-400 relative">
                                        <div className="absolute top-1/2 -translate-y-1/2 size-2.5 rounded-full bg-white shadow-[0_0_10px_#0BEF63] animate-ping" />
                                    </div>
                                </div>

                                {/* 浮动 UI 3: 视频合成节点 */}
                                <motion.div
                                    animate={{ y: [0, -4, 0] }}
                                    transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
                                    className="w-full sm:w-64 rounded-xl border border-stone-700/60 bg-stone-900/90 p-4 shadow-xl backdrop-blur-md"
                                >
                                    <div className="flex items-center justify-between text-xs font-semibold text-stone-300 mb-2">
                                        <span className="flex items-center gap-1.5 text-emerald-400">
                                            <Video className="size-3.5" />
                                            视频合成
                                        </span>
                                        <span className="text-[10px] text-emerald-400 font-mono">Seedance 2.5</span>
                                    </div>
                                    <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-stone-950 flex items-center justify-center">
                                        <div className="size-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                                            <Play className="size-3.5 fill-white ml-0.5 text-white" />
                                        </div>
                                    </div>
                                    <div className="mt-2 text-[10px] text-stone-400 flex justify-between">
                                        <span>动态运镜推演</span>
                                        <span className="text-emerald-400 font-semibold">100% 就绪</span>
                                    </div>
                                </motion.div>
                            </div>

                            {/* 底部浮动参数栏 */}
                            <div className="flex items-center justify-between border-t border-stone-800/80 pt-3 text-xs text-stone-400">
                                <span>按住空格拖动画布 · 滚轮无级缩放</span>
                                <span className="font-mono text-stone-500">IndexedDB 本地持久化驱动</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 03. AI 协同推演体验区 (AI Collaboration: swiper-section) */}
                <section className="mt-28 sm:mt-36">
                    <div className="text-center mb-14">
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                            <Sparkles className="size-3.5 text-emerald-500" />
                            <span>AI 协同全生命周期</span>
                        </div>
                        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl dark:text-white">
                            从文字到画面，AI 协同落地每一个想法
                        </h2>
                        <p className="mt-3 text-base text-stone-500 dark:text-stone-400">
                            文生 UI 与动态视效，描述即生成，打破多工具割裂困境
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <div className="rounded-3xl border border-stone-200/80 bg-white p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all hover:border-blue-500/40 hover:-translate-y-1 dark:border-stone-800 dark:bg-stone-900">
                            <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                                <ImagePlus className="size-6" />
                            </div>
                            <h3 className="mt-6 text-xl font-bold text-stone-900 dark:text-white">文生图 · 描述即生成</h3>
                            <p className="mt-3 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                                原生适配 GPT-Image-2、Gemini、Grok 与 StepFun，尺寸按官方标准自适应锁定，并发秒级提交。
                            </p>
                        </div>

                        <div className="rounded-3xl border border-stone-200/80 bg-white p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all hover:border-purple-500/40 hover:-translate-y-1 dark:border-stone-800 dark:bg-stone-900">
                            <div className="flex size-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                                <Workflow className="size-6" />
                            </div>
                            <h3 className="mt-6 text-xl font-bold text-stone-900 dark:text-white">分镜脚本 · 智能拆解</h3>
                            <p className="mt-3 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                                文本大模型一键将小说或剧本转化为镜头序列，自动拆解派发图片与视频节点，赋能短剧工业化。
                            </p>
                        </div>

                        <div className="rounded-3xl border border-stone-200/80 bg-white p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all hover:border-emerald-500/40 hover:-translate-y-1 dark:border-stone-800 dark:bg-stone-900">
                            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                                <Video className="size-6" />
                            </div>
                            <h3 className="mt-6 text-xl font-bold text-stone-900 dark:text-white">电影级 · 视频合成</h3>
                            <p className="mt-3 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                                全面接入 Seedance 2.5 全能参考与 Videos-4 系列，首尾帧过渡平滑自然，后台实时追踪渲染进度。
                            </p>
                        </div>
                    </div>
                </section>

                {/* 04. 专业推演特性矩阵 (Professional Features: drag-section) */}
                <section className="mt-28 sm:mt-36">
                    <div className="text-center mb-14">
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                            <Layers className="size-3.5" />
                            <span>专业掌控力</span>
                        </div>
                        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl dark:text-white">
                            从布局到细节，自在掌控创作节奏
                        </h2>
                        <p className="mt-3 text-base text-stone-500 dark:text-stone-400">
                            无限扩展的节点架构，赋予专业创作者无与伦比的推演自由
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        {/* 特性卡 1 (暗色高质感背景) */}
                        <div className="flex flex-col justify-between rounded-3xl bg-[#12141A] p-8 sm:p-10 text-white shadow-xl">
                            <div>
                                <span className="inline-flex items-center rounded-md bg-stone-800/80 px-2.5 py-1 text-xs font-medium text-emerald-400">
                                    01 · 自由编排
                                </span>
                                <h3 className="mt-6 text-2xl font-bold">无限自由连线推演</h3>
                                <p className="mt-3 text-sm leading-relaxed text-stone-400">
                                    支持跨模态节点自由摆放、拖拽组合与双向折线连通。具备一键自动整理对齐算法（Tidy Up），全屏包围盒智能视口居中。
                                </p>
                            </div>
                            <div className="mt-8 pt-6 border-t border-stone-800 text-xs text-stone-500">
                                毫秒级视口对齐 · 支持键盘快捷键全覆盖
                            </div>
                        </div>

                        {/* 特性卡 2 (亮色高质感背景) */}
                        <div className="flex flex-col justify-between rounded-3xl border border-stone-200/80 bg-white p-8 sm:p-10 shadow-[0_4px_20px_rgba(0,0,0,0.02)] dark:border-stone-800 dark:bg-stone-900">
                            <div>
                                <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                                    02 · 协议标准
                                </span>
                                <h3 className="mt-6 text-2xl font-bold text-stone-900 dark:text-white">动态多模态调度</h3>
                                <p className="mt-3 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                                    全面收敛为标准 OpenAI 风格协议，上游接口变动自适应落参。单图图生视频、多图参考与长任务断线手动重新拉取全方位覆盖。
                                </p>
                            </div>
                            <div className="mt-8 pt-6 border-t border-stone-100 dark:border-stone-800 text-xs text-stone-500">
                                30 分钟后台守护 · 自动提取视频首帧
                            </div>
                        </div>

                        {/* 特性卡 3 (微渐变背景) */}
                        <div className="flex flex-col justify-between rounded-3xl border border-stone-200/80 bg-white p-8 sm:p-10 shadow-[0_4px_20px_rgba(0,0,0,0.02)] dark:border-stone-800 dark:bg-stone-900">
                            <div>
                                <span className="inline-flex items-center rounded-md bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                                    03 · 资产自主
                                </span>
                                <h3 className="mt-6 text-2xl font-bold text-stone-900 dark:text-white">自由的提示词与素材库</h3>
                                <p className="mt-3 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                                    六大开源提示词仓库定时拉取与智能标签清洗；内置 Canvas 图片无痕去元数据重编码，多端 WebDAV 跨设备隐私同步。
                                </p>
                            </div>
                            <div className="mt-8 pt-6 border-t border-stone-100 dark:border-stone-800 text-xs text-stone-500">
                                纯本地 IndexedDB 存储 · 零云端隐私外泄
                            </div>
                        </div>
                    </div>
                </section>

                {/* 05. 企业级安全与双通道调度 (Capability Cards: 微信/腾讯级安全架构) */}
                <section className="mt-28 sm:mt-36">
                    <div className="rounded-3xl border border-stone-200/80 bg-white p-8 sm:p-14 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-stone-800 dark:bg-stone-900">
                        <div className="max-w-2xl">
                            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0052D9] dark:text-blue-400 uppercase tracking-widest">
                                <ShieldCheck className="size-3.5" />
                                <span>企业级安全与可用性</span>
                            </div>
                            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white">
                                从链路安全到资产落盘，每次推演都安心托付
                            </h2>
                            <p className="mt-3 text-base text-stone-500 dark:text-stone-400">
                                覆盖同域代理、浏览器直连、本地存储与标准协议的全流程保障
                            </p>
                        </div>

                        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
                            <div className="flex flex-col">
                                <div className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                                    <Zap className="size-5.5" />
                                </div>
                                <h4 className="mt-5 text-lg font-bold text-stone-900 dark:text-white">双通道智能调度</h4>
                                <p className="mt-2 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                                    同域 AI 代理清洗边缘请求头，杜绝 CORS 限制；上游故障或超时自动秒级直连兜底。
                                </p>
                            </div>

                            <div className="flex flex-col">
                                <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                                    <ShieldCheck className="size-5.5" />
                                </div>
                                <h4 className="mt-5 text-lg font-bold text-stone-900 dark:text-white">100% 本地隐私自主</h4>
                                <p className="mt-2 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                                    工程与媒体资产全量落盘浏览器 IndexedDB，不上传第三方云端，支持 WebDAV 安全备份。
                                </p>
                            </div>

                            <div className="flex flex-col">
                                <div className="flex size-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                                    <Cpu className="size-5.5" />
                                </div>
                                <h4 className="mt-5 text-lg font-bold text-stone-900 dark:text-white">统一 OpenAI 契约</h4>
                                <p className="mt-2 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                                    协议彻底收敛，无缝兼容生图、视频、语音及各类多模态大模型，无需繁琐格式切换。
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 06. 场景落地堆叠卡片 (Switch Stack Tabs: 腾讯 ARDOT 同款交互) */}
                <section className="mt-28 sm:mt-36">
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-widest">
                            <Workflow className="size-3.5" />
                            <span>从创意到落地</span>
                        </div>
                        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl dark:text-white">
                            每个细节都精准落地
                        </h2>
                        <p className="mt-3 text-base text-stone-500 dark:text-stone-400">
                            深入内容创作核心场景，效率拉满
                        </p>
                    </div>

                    {/* 堆叠 Tab 选择器 */}
                    <div className="flex justify-center mb-8">
                        <div className="inline-flex rounded-full border border-stone-200/80 bg-white p-1.5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
                            {stackTabs.map((tab, idx) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveStackIndex(idx)}
                                    className={`rounded-full px-6 py-2.5 text-xs font-semibold transition-all duration-200 ${
                                        activeStackIndex === idx
                                            ? "bg-[#0052D9] text-white shadow-sm"
                                            : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 堆叠展示大卡片 */}
                    <div className="rounded-3xl border border-stone-200/80 bg-white p-8 sm:p-14 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-stone-800 dark:bg-stone-900">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentStack.id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                transition={{ duration: 0.35 }}
                                className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12"
                            >
                                <div className="lg:col-span-7">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                                        {currentStack.badge}
                                    </span>
                                    <h3 className="mt-4 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-white">
                                        {currentStack.title}
                                    </h3>
                                    <p className="mt-4 text-base leading-relaxed text-stone-500 dark:text-stone-400">
                                        {currentStack.desc}
                                    </p>
                                    <div className="mt-8 flex items-center gap-3">
                                        <Button type="primary" href="/canvas" className="rounded-full px-6 h-10 font-medium">
                                            进入该场景体验
                                        </Button>
                                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                            {currentStack.metric}
                                        </span>
                                    </div>
                                </div>

                                {/* 右侧视觉示意区 */}
                                <div className="lg:col-span-5 rounded-2xl bg-stone-900 p-6 text-white border border-stone-800 shadow-inner flex flex-col justify-between min-h-[220px]">
                                    <div className="flex items-center justify-between text-xs text-stone-400 border-b border-stone-800 pb-3 font-mono">
                                        <span>STATUS: READY</span>
                                        <span className="text-emerald-400 font-semibold">{currentStack.visual.headline}</span>
                                    </div>
                                    <div className="my-auto py-4">
                                        <div className="text-sm font-medium text-stone-200">{currentStack.visual.sub}</div>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-stone-500 pt-3 border-t border-stone-800">
                                        <span>C-AI 推演协议</span>
                                        <span className="text-blue-400">实时数据流绑定</span>
                                    </div>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </section>

                {/* 07. 底部品牌转化与页脚 (Footer Section: 腾讯 ARDOT 经典收口) */}
                <section className="mt-28 mb-16 sm:mt-36">
                    <div className="rounded-3xl bg-gradient-to-b from-[#12141A] to-[#0A0C10] px-8 py-16 text-center text-white sm:px-16 sm:py-20 shadow-2xl">
                        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                            C-AI 画布，让灵感鲜活落地
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-base text-stone-400">
                            无论是单张画面的极致打磨，还是整部短剧的分镜推演，一站式赋能创作者。
                        </p>
                        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                            <Button
                                type="primary"
                                size="large"
                                href="/canvas"
                                className="h-12 rounded-full bg-gradient-to-r from-[#0052D9] to-[#2693FF] px-8 text-sm font-semibold hover:opacity-95"
                            >
                                开始推演
                            </Button>
                            <Button
                                size="large"
                                href={GITHUB_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-12 rounded-full border-stone-700 bg-stone-800/80 px-7 text-sm font-medium text-stone-300 hover:bg-stone-700 hover:text-white"
                                icon={<GitBranch className="size-4" />}
                            >
                                开源仓库
                            </Button>
                        </div>
                    </div>

                    {/* 规范页脚 */}
                    <footer className="mt-16 flex flex-col items-center justify-between gap-4 pb-8 sm:flex-row text-xs text-stone-500 dark:text-stone-400">
                        <div>
                            <span className="font-semibold text-stone-800 dark:text-stone-200">C-AI 画布</span>
                            <span className="mx-2">·</span>
                            <span>智能多模态推演工作台</span>
                        </div>
                        <div className="flex items-center gap-6">
                            <a href="/canvas" className="hover:text-stone-950 dark:hover:text-white transition-colors">我的画布</a>
                            <a href="/image" className="hover:text-stone-950 dark:hover:text-white transition-colors">生图工作台</a>
                            <a href="/video" className="hover:text-stone-950 dark:hover:text-white transition-colors">视频创作台</a>
                            <a href="/prompts" className="hover:text-stone-950 dark:hover:text-white transition-colors">提示词库</a>
                            <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="hover:text-stone-950 dark:hover:text-white transition-colors inline-flex items-center gap-1">
                                <span>帮助文档</span>
                                <ExternalLink className="size-3" />
                            </a>
                        </div>
                    </footer>
                </section>
            </div>
        </main>
    );
}
