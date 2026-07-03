"use client";

import { Check, Search } from "lucide-react";
import { type UIEvent, useEffect, useMemo, useState } from "react";
import { App, Empty, Input, Modal, Spin } from "antd";

import { ALL_PROMPTS_OPTION, CATEGORY_MAP, cleanTag } from "@/services/api/prompts";
import { cn } from "@/lib/utils";
import { PromptCard } from "./prompt-card";
import { usePromptList } from "./use-prompt-list";

export function PromptSelectDialog({ open, onOpenChange, onSelect }: { open: boolean; onOpenChange: (open: boolean) => void; onSelect: (prompt: string) => void }) {
    const { message } = App.useApp();
    const [keyword, setKeyword] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState(ALL_PROMPTS_OPTION);
    const { query, items, tags: promptTags, categories: promptCategories } = usePromptList({ keyword, tags: selectedTags, category: selectedCategory, enabled: open });

    const visibleTags = useMemo(() => {
        const seen = new Set<string>();
        const result: { id: string; label: string }[] = [];
        
        result.push({ id: ALL_PROMPTS_OPTION, label: "全部" });
        seen.add("全部");
        
        for (const tag of promptTags) {
            if (tag === ALL_PROMPTS_OPTION) continue;
            const label = cleanTag(tag);
            if (label && !seen.has(label)) {
                seen.add(label);
                result.push({ id: tag, label });
            }
        }
        return result;
    }, [promptTags]);

    const toggleTag = (tag: string) => {
        if (tag === ALL_PROMPTS_OPTION) return setSelectedTags([]);
        setSelectedTags((items) => (items.includes(tag) ? items.filter((item) => item !== tag) : [...items, tag]));
    };
    const selectPrompt = (prompt: string) => {
        onSelect(prompt);
        onOpenChange(false);
    };

    useEffect(() => {
        if (query.isError) message.error(query.error instanceof Error ? query.error.message : "获取提示词失败");
    }, [message, query.error, query.isError]);

    const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
        const target = event.currentTarget;
        if (query.hasNextPage && !query.isFetchingNextPage && target.scrollTop + target.clientHeight >= target.scrollHeight - 160) void query.fetchNextPage();
    };

    return (
        <Modal title="提示词库" open={open} onCancel={() => onOpenChange(false)} footer={null} width={1040} centered>
            <div data-canvas-no-zoom onWheelCapture={(event) => event.stopPropagation()} className="pb-2">
                <div className="mx-auto max-w-2xl mb-5">
                    <Input 
                        size="large" 
                        prefix={<Search className="mr-1.5 size-4 text-stone-400" />} 
                        value={keyword} 
                        onChange={(event) => setKeyword(event.target.value)} 
                        placeholder="输入关键词，搜索标题与描述..." 
                        allowClear
                        className="rounded-xl border-stone-200 bg-white/70 dark:border-stone-800 dark:bg-stone-950/50 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder:text-stone-400"
                    />
                </div>
                
                {/* Clean, standardized filter interface inside Dialog */}
                <div className="grid gap-3 bg-stone-50/50 border border-stone-150 p-4 rounded-xl dark:bg-stone-900/10 dark:border-stone-850">
                    <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-center">
                        <div className="text-xs font-semibold text-stone-500 dark:text-stone-400">分类</div>
                        <div className="flex flex-wrap gap-1 bg-stone-100/80 p-0.5 rounded-lg dark:bg-stone-900/60 w-fit border border-stone-200/30 dark:border-stone-800/20">
                            {promptCategories.map((category) => {
                                const active = selectedCategory === category;
                                return (
                                    <button
                                        key={category}
                                        type="button"
                                        className={cn(
                                            "px-3 py-1 text-xs font-medium rounded-md transition-all duration-155 cursor-pointer",
                                            active 
                                                ? "bg-white text-stone-950 shadow-sm dark:bg-stone-800 dark:text-stone-50 font-semibold" 
                                                : "text-stone-500 hover:text-stone-855 dark:text-stone-450 dark:hover:text-stone-205"
                                        )}
                                        onClick={() => setSelectedCategory(category)}
                                    >
                                        {CATEGORY_MAP[category] || category}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-start">
                        <div className="pt-1 text-xs font-semibold text-stone-500 dark:text-stone-400">标签</div>
                        <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto thin-scrollbar">
                            {visibleTags.map((item) => {
                                const active = item.id === ALL_PROMPTS_OPTION ? selectedTags.length === 0 : selectedTags.includes(item.id);
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className={cn(
                                            "px-3 py-1 text-xs rounded-full border transition-all duration-150 cursor-pointer",
                                            active
                                                ? "bg-stone-900 border-stone-900 text-white dark:bg-white dark:border-white dark:text-stone-950 font-semibold shadow-sm"
                                                : "bg-stone-50 border-stone-200/80 text-stone-600 hover:border-stone-300 dark:bg-stone-900/50 dark:border-stone-800/80 dark:text-stone-400 dark:hover:border-stone-700"
                                        )}
                                        onClick={() => toggleTag(item.id)}
                                    >
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="thin-scrollbar mt-6 max-h-[520px] overflow-y-auto pr-2" data-canvas-no-zoom onScroll={handleListScroll} onWheelCapture={(event) => event.stopPropagation()}>
                    {query.isLoading ? (
                        <div className="flex h-40 items-center justify-center">
                            <Spin />
                        </div>
                    ) : null}
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {items.map((item) => (
                            <PromptCard key={item.id} item={item} onOpen={() => selectPrompt(item.prompt)} onCopy={() => selectPrompt(item.prompt)} actionLabel="使用此提示词" actionIcon={<Check className="size-3.5" />} actionType="primary" />
                        ))}
                    </div>
                    {!query.isLoading && items.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有找到匹配的提示词" className="py-8" /> : null}
                    {query.isFetchingNextPage ? (
                        <div className="py-4 text-center">
                            <Spin size="small" />
                        </div>
                    ) : null}
                </div>
            </div>
        </Modal>
    );
}
