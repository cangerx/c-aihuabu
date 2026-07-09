"use client";

import { Copy } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "antd";

import { cleanTag, formatPromptDate, type Prompt } from "@/services/api/prompts";

export function PromptCard({
    item,
    onOpen,
    onCopy,
    actionLabel = "复制",
    actionIcon = <Copy className="size-3.5" />,
    actionType = "text",
    extraAction,
}: {
    item: Prompt;
    onOpen: () => void;
    onCopy: () => void;
    actionLabel?: string;
    actionIcon?: ReactNode;
    actionType?: "text" | "primary";
    extraAction?: ReactNode;
}) {
    return (
        <div className="group flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-stone-800 dark:bg-stone-900/60">
            {/* Image section with hover scale */}
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100 dark:bg-stone-950">
                <button type="button" className="block h-full w-full cursor-pointer" onClick={onOpen}>
                    <img 
                        src={item.coverUrl} 
                        alt={item.title} 
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </button>
            </div>
            
            {/* Content section */}
            <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                    <button 
                        type="button" 
                        className="text-left font-semibold text-stone-950 hover:text-indigo-600 dark:text-stone-100 dark:hover:text-indigo-400 text-sm line-clamp-1 cursor-pointer transition-colors"
                        onClick={onOpen}
                    >
                        {item.title}
                    </button>
                    <span className="shrink-0 text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">
                        {formatPromptDate(item.updatedAt)}
                    </span>
                </div>
                
                <p className="mt-2 flex-1 line-clamp-3 text-xs leading-5 text-stone-600 dark:text-stone-400">
                    {item.prompt}
                </p>
                
                {/* Clean, standardized tags display */}
                {item.tags && item.tags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1">
                        {item.tags.slice(0, 3).map((tag) => {
                            const cleaned = cleanTag(tag);
                            if (!cleaned) return null;
                            return (
                                <span 
                                    key={tag} 
                                    className="inline-flex items-center rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600 dark:bg-stone-800/60 dark:text-stone-400"
                                >
                                    {cleaned}
                                </span>
                            );
                        })}
                        {item.tags.length > 3 ? (
                            <span className="inline-flex items-center rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-400 dark:bg-stone-800/60">
                                +{item.tags.length - 3}
                            </span>
                        ) : null}
                    </div>
                ) : null}
            </div>
            
            {/* Actions section */}
            <div className="flex items-center gap-2 border-t border-stone-100 bg-stone-50/50 p-3 dark:border-stone-800 dark:bg-stone-900/40">
                <Button 
                    block={actionType === "primary"} 
                    type={actionType} 
                    size="small" 
                    icon={actionIcon} 
                    onClick={onCopy}
                    className="flex-1 cursor-pointer"
                >
                    {actionLabel}
                </Button>
                {extraAction ? (
                    <div className="shrink-0">
                        {extraAction}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
