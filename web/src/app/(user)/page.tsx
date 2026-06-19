"use client";

import { ArrowRight, FileText, Image as ImageIcon, Video, Play, Sparkles, MousePointer } from "lucide-react";
import { type ReactNode } from "react";
import { Button } from "antd";
import { motion } from "motion/react";

import { navigationTools } from "@/constant/navigation-tools";

// highlighter with smooth expansion scaleX animation
function Highlighter({ action, color, children, delay = 0.8 }: { action: "highlight" | "underline"; color: string; children: ReactNode; delay?: number }) {
    return (
        <span className="relative inline-block px-1">
            {action === "highlight" ? (
                <motion.span
                    className="absolute inset-x-0 bottom-0 top-1 rounded-sm opacity-35 dark:opacity-20"
                    style={{ backgroundColor: color }}
                    initial={{ scaleX: 0, originX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                />
            ) : (
                <motion.span
                    className="absolute inset-x-0 bottom-0 h-1 rounded-full opacity-65"
                    style={{ backgroundColor: color }}
                    initial={{ scaleX: 0, originX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                />
            )}
            <span className="relative font-semibold text-stone-900 dark:text-stone-100">{children}</span>
        </span>
    );
}

// container transition configuration
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.15,
            delayChildren: 0.1,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.8,
            ease: [0.16, 1, 0.3, 1], // easeOutExpo
        },
    },
};

export default function IndexPage() {
    const [primaryTool] = navigationTools;

    return (
        <main className="relative h-full overflow-y-auto bg-background bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] text-stone-950 dark:bg-[radial-gradient(rgba(245,245,244,.15)_1px,transparent_1px)] dark:text-stone-100">
            {/* inject component specific keyframe animations to keep code modular and self-contained */}
            <style jsx global>{`
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

            {/* floating ambient glow lights to establish depth */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <motion.div
                    className="absolute -left-20 top-[15%] h-[350px] w-[350px] rounded-full bg-blue-400/10 blur-[100px] dark:bg-blue-500/5"
                    animate={{
                        x: [0, 40, -20, 0],
                        y: [0, 50, 30, 0],
                        scale: [1, 1.15, 0.9, 1],
                    }}
                    transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
                <motion.div
                    className="absolute right-[5%] top-[25%] h-[300px] w-[300px] rounded-full bg-amber-400/10 blur-[90px] dark:bg-amber-500/5"
                    animate={{
                        x: [0, -35, 45, 0],
                        y: [0, 40, -40, 0],
                        scale: [1, 0.85, 1.1, 1],
                    }}
                    transition={{
                        duration: 24,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
                <motion.div
                    className="absolute left-[25%] bottom-[5%] h-[400px] w-[400px] rounded-full bg-purple-400/10 blur-[110px] dark:bg-purple-500/5"
                    animate={{
                        x: [0, 30, -40, 0],
                        y: [0, -30, 50, 0],
                        scale: [1, 1.2, 0.95, 1],
                    }}
                    transition={{
                        duration: 22,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
            </div>

            <section className="relative mx-auto min-h-[calc(100vh-4rem)] max-w-7xl px-6 py-12 lg:py-20 flex flex-col items-center justify-between">
                {/* hero content header section */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="relative flex flex-col items-center pt-8 text-center"
                >
                    <motion.div 
                        variants={itemVariants}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-stone-200 bg-stone-50/50 backdrop-blur-sm text-xs text-stone-600 dark:border-stone-800 dark:bg-stone-900/40 dark:text-stone-300 mb-6"
                    >
                        <Sparkles className="size-3 text-amber-500" />
                        <span>全新体验 · 无限创意连线推演</span>
                    </motion.div>

                    <motion.h1
                        variants={itemVariants}
                        className="ai-title-aurora max-w-5xl text-balance text-5xl font-semibold tracking-tight sm:text-7xl lg:text-8xl py-1"
                    >
                        C-AI画布
                    </motion.h1>

                    <motion.p
                        variants={itemVariants}
                        className="mt-6 max-w-3xl text-balance text-base sm:text-lg sm:leading-8 text-stone-500 dark:text-stone-400"
                    >
                        在{" "}
                        <Highlighter action="underline" color="#FF9800" delay={0.6}>
                            C-AI画布
                        </Highlighter>{" "}
                        中生成、连接和重组{" "}
                        <Highlighter action="highlight" color="#87CEFA" delay={0.9}>
                            图片、文字与图形
                        </Highlighter>
                        ，让创作从单次生成变成连续推演。
                    </motion.p>

                    <motion.div
                        variants={itemVariants}
                        className="mt-8 flex flex-wrap items-center justify-center gap-4"
                    >
                        <Button
                            type="primary"
                            size="large"
                            href={`/${primaryTool.slug}`}
                            className="group relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-stone-200/50 dark:hover:shadow-none"
                            style={{ height: 46, borderRadius: 23, paddingInline: 24 }}
                        >
                            <span className="flex items-center gap-1.5 font-medium">
                                开始使用
                                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                            </span>
                        </Button>
                        <Button
                            size="large"
                            href="/canvas"
                            className="transition-all duration-300 hover:scale-105 hover:bg-stone-50 dark:hover:bg-stone-900"
                            style={{ height: 46, borderRadius: 23, paddingInline: 24 }}
                        >
                            打开画布
                        </Button>
                    </motion.div>
                </motion.div>

                {/* dynamic, interactive canvas showcase */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    className="relative w-full max-w-5xl mt-16 md:mt-24"
                >
                    {/* decorative background nodes */}
                    <div className="pointer-events-none absolute -left-12 top-0 size-24 rounded-full border border-dashed border-stone-200 dark:border-stone-800" />
                    <div className="pointer-events-none absolute -right-8 bottom-0 size-20 rounded-full border border-dashed border-stone-200 dark:border-stone-800" />

                    {/* interactive floating node container */}
                    <div className="relative min-h-[380px] lg:h-[420px] flex flex-col lg:block gap-6 lg:gap-0 items-center justify-center">
                        
                        {/* connecting flowline vector graphics */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none hidden lg:block" style={{ zIndex: 0 }}>
                            {/* line 1: text node to image node */}
                            <motion.path
                                d="M 288 120 C 340 120, 360 260, 420 260"
                                fill="none"
                                stroke="rgba(120, 113, 108, 0.12)"
                                strokeWidth="1.8"
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ delay: 1.1, duration: 1.2, ease: "easeOut" }}
                            />
                            <motion.path
                                d="M 288 120 C 340 120, 360 260, 420 260"
                                fill="none"
                                stroke="rgba(59, 130, 246, 0.35)"
                                strokeWidth="1.8"
                                strokeDasharray="4,16"
                                className="animate-line-flow"
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ delay: 1.1, duration: 1.2, ease: "easeOut" }}
                            />

                            {/* line 2: image node to video node */}
                            <motion.path
                                d="M 640 260 C 700 260, 720 130, 768 130"
                                fill="none"
                                stroke="rgba(120, 113, 108, 0.12)"
                                strokeWidth="1.8"
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ delay: 1.4, duration: 1.2, ease: "easeOut" }}
                            />
                            <motion.path
                                d="M 640 260 C 700 260, 720 130, 768 130"
                                fill="none"
                                stroke="rgba(168, 85, 247, 0.35)"
                                strokeWidth="1.8"
                                strokeDasharray="4,16"
                                className="animate-line-flow"
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ delay: 1.4, duration: 1.2, ease: "easeOut" }}
                            />
                        </svg>

                        {/* card 1: prompt text node */}
                        <motion.div
                            className="w-full sm:w-72 rounded-2xl border border-stone-200 bg-stone-50/70 p-4 shadow-md backdrop-blur-md dark:border-stone-800/40 dark:bg-stone-900/60 dark:shadow-none lg:absolute lg:left-0 lg:top-[10%] z-10 cursor-default select-none hover:shadow-lg transition-shadow duration-300"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                            whileHover={{ scale: 1.02, rotate: -0.5 }}
                        >
                            <div className="flex items-center justify-between mb-3 border-b border-stone-200/50 pb-2 dark:border-stone-800/50">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-stone-300">
                                    <FileText className="size-3.5 text-blue-500" />
                                    <span>提示词节点</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-500 font-semibold uppercase tracking-wider">Active</span>
                                </div>
                            </div>
                            <div className="text-xs leading-relaxed text-stone-700 dark:text-stone-300 bg-stone-100/50 dark:bg-stone-950/40 p-2.5 rounded-lg border border-stone-200/20">
                                <span className="font-mono text-indigo-500 font-semibold dark:text-indigo-400">/imagine</span>{" "}
                                赛博朋克风格的魔法猫咪，手握发光的能量法杖，正在调试复杂的代码全息屏幕，超写实摄影，电影质感
                                <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-blue-500 animate-caret-blink" />
                            </div>
                        </motion.div>

                        {/* card 2: generative image node */}
                        <motion.div
                            className="w-full sm:w-[230px] rounded-2xl border border-stone-200 bg-stone-50/70 p-3.5 shadow-md backdrop-blur-md dark:border-stone-800/40 dark:bg-stone-900/60 dark:shadow-none lg:absolute lg:left-1/2 lg:top-[45%] lg:-translate-x-1/2 z-10 cursor-default select-none hover:shadow-lg transition-shadow duration-300"
                            animate={{ y: [0, 4, 0] }}
                            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
                            whileHover={{ scale: 1.02, rotate: 0.5 }}
                        >
                            <div className="flex items-center justify-between mb-2.5 border-b border-stone-200/50 pb-2 dark:border-stone-800/50">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-stone-300">
                                    <ImageIcon className="size-3.5 text-purple-500" />
                                    <span>生图节点</span>
                                </div>
                                <div className="text-[10px] text-stone-400 font-medium">Flux.1</div>
                            </div>
                            
                            {/* animated aurora placeholder mimicking generated art */}
                            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-stone-900">
                                <div className="absolute inset-0 bg-gradient-to-tr from-purple-600 via-blue-600 to-emerald-400 opacity-80 mix-blend-color-dodge animate-aurora-glow" />
                                <div className="absolute inset-0 bg-black/10 backdrop-blur-[0.5px]" />
                                <div className="absolute inset-x-2 bottom-2 flex flex-col justify-end p-2 rounded bg-black/40 backdrop-blur-sm">
                                    <span className="text-[10px] font-mono font-semibold text-white/90 truncate">#001_魔法猫咪.png</span>
                                    <span className="text-[8px] text-stone-300">1024 x 1024 px</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between mt-2.5 text-[10px] text-stone-500">
                                <span>比例 1:1</span>
                                <span className="text-emerald-500 font-semibold">渲染完成 100%</span>
                            </div>
                        </motion.div>

                        {/* card 3: video synthesize node */}
                        <motion.div
                            className="w-full sm:w-72 rounded-2xl border border-stone-200 bg-stone-50/70 p-4 shadow-md backdrop-blur-md dark:border-stone-800/40 dark:bg-stone-900/60 dark:shadow-none lg:absolute lg:right-0 lg:top-[12%] z-10 cursor-default select-none hover:shadow-lg transition-shadow duration-300"
                            animate={{ y: [0, -5, 0] }}
                            transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }}
                            whileHover={{ scale: 1.02, rotate: -0.5 }}
                        >
                            <div className="flex items-center justify-between mb-3 border-b border-stone-200/50 pb-2 dark:border-stone-800/50">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-stone-300">
                                    <Video className="size-3.5 text-amber-500" />
                                    <span>视频节点</span>
                                </div>
                                <div className="text-[10px] text-stone-400 font-medium">Luma.v2</div>
                            </div>

                            {/* mock video player component */}
                            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-stone-950">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-stone-900 to-purple-950 opacity-90" />
                                
                                {/* play button backdrop */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="flex size-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-md transition-transform duration-300 hover:scale-110">
                                        <Play className="size-3.5 fill-white ml-0.5" />
                                    </div>
                                </div>

                                {/* floating mouse cursor showing mock interaction */}
                                <motion.div 
                                    className="absolute right-4 bottom-4 text-white pointer-events-none drop-shadow-md hidden sm:block"
                                    animate={{ 
                                        x: [-20, 0, -20],
                                        y: [20, 0, 20]
                                    }}
                                    transition={{
                                        duration: 4,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                >
                                    <MousePointer className="size-4 fill-white text-stone-900" />
                                </motion.div>
                            </div>

                            {/* real-time progress indicator */}
                            <div className="mt-3">
                                <div className="flex items-center justify-between text-[10px] text-stone-500 mb-1">
                                    <span>生成视频 (5.0s)</span>
                                    <span className="text-blue-500 dark:text-blue-400 font-semibold animate-pulse">连续推演合成中...</span>
                                </div>
                                <div className="h-1 w-full bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                                        animate={{ width: ["20%", "85%", "20%"] }}
                                        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                                    />
                                </div>
                            </div>
                        </motion.div>

                    </div>
                </motion.div>
            </section>
        </main>
    );
}
