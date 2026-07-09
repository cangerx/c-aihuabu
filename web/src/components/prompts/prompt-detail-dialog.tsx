"use client";

import { Calendar, Copy, FolderPlus, Sparkles, Terminal } from "lucide-react";
import { Button, Modal } from "antd";

import { CATEGORY_MAP, cleanTag, formatPromptDate, type Prompt } from "@/services/api/prompts";

export function PromptDetailDialog({ prompt, onClose, onCopy, onSaveAsset }: { prompt: Prompt | null; onClose: () => void; onCopy: (prompt: string) => void; onSaveAsset?: (prompt: Prompt) => void }) {
    const createdStr = prompt ? formatPromptDate(prompt.createdAt) : "";
    const updatedStr = prompt ? formatPromptDate(prompt.updatedAt) : "";
    const hasDate = createdStr || updatedStr;

    return (
        <Modal 
            title={null} 
            open={Boolean(prompt)} 
            onCancel={onClose} 
            footer={null} 
            width={800} 
            centered
            className="prompt-detail-modal"
        >
            {prompt ? (
                <div className="pt-4 pb-2">
                    {/* Header Details */}
                    <div className="mb-6 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                                <Sparkles className="size-3" />
                                {CATEGORY_MAP[prompt.category] || prompt.category}
                            </span>
                        </div>
                        <h2 className="text-xl font-bold tracking-tight text-stone-950 dark:text-stone-50">
                            {prompt.title}
                        </h2>
                    </div>

                    <div className="grid gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
                        {/* Left Side: Preview Asset & Image */}
                        <div className="flex flex-col gap-4">
                            <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-950 shadow-sm">
                                <img src={prompt.coverUrl} alt={prompt.title} className="aspect-[4/3] w-full object-cover" />
                            </div>
                            
                            {prompt.preview ? (
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-1 text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                                        <Terminal className="size-3" />
                                        <span>输出预览</span>
                                    </div>
                                    <pre className="max-h-52 overflow-y-auto rounded-lg border border-stone-100 bg-stone-50 p-2.5 font-mono text-[10px] leading-relaxed text-stone-600 dark:border-stone-800 dark:bg-stone-950/50 dark:text-stone-400 thin-scrollbar whitespace-pre-wrap">
                                        {prompt.preview}
                                    </pre>
                                </div>
                            ) : null}
                        </div>

                        {/* Right Side: Tags, Prompt, Actions */}
                        <div className="flex flex-col">
                            {/* Standardized Tags */}
                            {prompt.tags && prompt.tags.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {prompt.tags.map((tag) => {
                                        const cleaned = cleanTag(tag);
                                        if (!cleaned) return null;
                                        return (
                                            <span 
                                                key={tag} 
                                                className="inline-flex items-center rounded bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600 dark:bg-stone-800/60 dark:text-stone-400"
                                            >
                                                {cleaned}
                                            </span>
                                        );
                                    })}
                                </div>
                            ) : null}

                            {/* Prompt Card Box */}
                            <div className="relative mt-4 flex-1 rounded-xl border border-stone-200/80 bg-stone-50/50 p-4 dark:border-stone-800 dark:bg-stone-900/40">
                                <div className="mb-2 text-[11px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                                    提示词内容
                                </div>
                                <div className="whitespace-pre-wrap text-sm leading-relaxed text-stone-900 dark:text-stone-200 select-all max-h-60 overflow-y-auto thin-scrollbar">
                                    {prompt.prompt}
                                </div>
                            </div>

                            {/* Meta & Actions Footer */}
                            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-stone-100 dark:border-stone-800 pt-4">
                                <div className="text-[11px] text-stone-400 dark:text-stone-500 flex items-center gap-1.5">
                                    {hasDate ? (
                                        <>
                                            <Calendar className="size-3" />
                                            <span>
                                                {createdStr ? `创建于 ${createdStr}` : ""}
                                                {createdStr && updatedStr ? " · " : ""}
                                                {updatedStr ? `更新于 ${updatedStr}` : ""}
                                            </span>
                                        </>
                                    ) : null}
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button 
                                        type="primary" 
                                        icon={<Copy className="size-3.5" />} 
                                        onClick={() => onCopy(prompt.prompt)}
                                        className="cursor-pointer"
                                    >
                                        复制提示词
                                    </Button>
                                    {onSaveAsset ? (
                                        <Button 
                                            icon={<FolderPlus className="size-3.5" />} 
                                            onClick={() => onSaveAsset(prompt)}
                                            className="cursor-pointer"
                                        >
                                            加入素材
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </Modal>
    );
}
