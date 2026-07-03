"use client";

import { ChevronDown, FolderPlus, Search } from "lucide-react";
import { type UIEvent, useEffect, useMemo, useState } from "react";
import { App, Button, Empty, Input, Spin } from "antd";

import { PromptCard } from "@/components/prompts/prompt-card";
import { PromptDetailDialog } from "@/components/prompts/prompt-detail-dialog";
import { usePromptList } from "@/components/prompts/use-prompt-list";
import { useCopyText } from "@/hooks/use-copy-text";
import { cn } from "@/lib/utils";
import { useAssetStore } from "@/stores/use-asset-store";
import { ALL_PROMPTS_OPTION, CATEGORY_MAP, cleanTag, type Prompt } from "@/services/api/prompts";

export default function PromptsPage() {
    const { message } = App.useApp();
    const [titleKeyword, setTitleKeyword] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState(ALL_PROMPTS_OPTION);
    const [tagsExpanded, setTagsExpanded] = useState(false);
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const addAsset = useAssetStore((state) => state.addAsset);
    const copyText = useCopyText();
    const { query, items: promptItems, tags: promptTags, categories: promptCategoryOptions, total: totalPrompts } = usePromptList({ keyword: titleKeyword, tags: selectedTags, category: selectedCategory });

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

    useEffect(() => {
        if (query.isError) {
            message.error(query.error instanceof Error ? query.error.message : "获取提示词失败");
        }
    }, [message, query.error, query.isError]);

    const toggleTag = (tag: string) => {
        if (tag === ALL_PROMPTS_OPTION) return setSelectedTags([]);
        setSelectedTags((items) => (items.includes(tag) ? items.filter((item) => item !== tag) : [...items, tag]));
    };

    const savePromptAsset = (item: Prompt) => {
        addAsset({ kind: "text", title: item.title, coverUrl: item.coverUrl, tags: item.tags, source: item.category, data: { content: item.prompt }, metadata: { source: "prompt-library", promptId: item.id, githubUrl: item.githubUrl } });
        message.success("已加入我的素材");
    };

    const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
        const target = event.currentTarget;
        if (query.hasNextPage && !query.isFetchingNextPage && target.scrollTop + target.clientHeight >= target.scrollHeight - 160) {
            void query.fetchNextPage();
        }
    };

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background text-stone-850 dark:text-stone-100">
            <main
                className="min-h-0 flex-1 overflow-y-auto bg-background bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] px-6 py-8 [background-size:16px_16px] dark:bg-[radial-gradient(rgba(245,245,244,.16)_1px,transparent_1px)]"
                onScroll={handleListScroll}
            >
                <div className="pb-8">
                    {/* Header Banner */}
                    <div className="relative overflow-hidden rounded-2xl border border-stone-200/60 bg-stone-50/50 p-8 dark:border-stone-800/40 dark:bg-stone-900/30 backdrop-blur-md mb-8 max-w-7xl mx-auto">
                        {/* Glow Effects */}
                        <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />
                        <div className="absolute -right-20 -bottom-20 h-40 w-40 rounded-full bg-purple-500/5 blur-3xl pointer-events-none" />
                        
                        <div className="relative mx-auto max-w-3xl text-center">
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/20 mb-3 select-none">
                                ⚡️ Prompt Hub
                            </span>
                            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-stone-950 via-stone-850 to-stone-750 bg-clip-text text-transparent dark:from-stone-50 dark:via-stone-200 dark:to-stone-350 sm:text-4xl">
                                提示词中心
                            </h1>
                            <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
                                探索并检索精心优化的提示词，支持分类与过滤。当前共收录 <span className="font-semibold text-stone-950 dark:text-stone-100">{totalPrompts}</span> 条灵感预设。
                            </p>
                        </div>
                    </div>

                    {query.isLoading ? (
                        <div className="flex h-60 items-center justify-center">
                            <Spin />
                        </div>
                    ) : null}
                    {!query.isLoading ? (
                        <>
                            {/* Search bar with modern border details */}
                            <div className="mx-auto w-full max-w-2xl mb-8">
                                <Input 
                                    size="large" 
                                    className="w-full h-11 rounded-xl border-stone-200/80 dark:border-stone-800 bg-white/70 dark:bg-stone-950/50 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder:text-stone-400" 
                                    prefix={<Search className="mr-1.5 size-4 text-stone-400" />} 
                                    value={titleKeyword} 
                                    placeholder="输入关键词，搜索标题与描述..." 
                                    allowClear
                                    onChange={(event) => setTitleKeyword(event.target.value)} 
                                />
                            </div>

                            {/* Filter Section */}
                            <div className="mx-auto max-w-7xl border border-stone-200/50 bg-white/40 dark:border-stone-800/40 dark:bg-stone-900/10 p-5 rounded-2xl backdrop-blur-sm grid gap-4 text-left mb-8">
                                <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-center">
                                    <div className="text-xs font-semibold text-stone-500 dark:text-stone-400">分类</div>
                                    <div className="flex flex-wrap gap-1 bg-stone-100/80 p-0.5 rounded-lg dark:bg-stone-900/60 w-fit border border-stone-200/30 dark:border-stone-800/20">
                                        {promptCategoryOptions.map((category) => {
                                            const active = selectedCategory === category;
                                            return (
                                                <button
                                                    key={category}
                                                    type="button"
                                                    className={cn(
                                                        "px-3.5 py-1.5 text-xs font-medium rounded-md transition-all duration-150 cursor-pointer",
                                                        active 
                                                            ? "bg-white text-stone-950 shadow-sm dark:bg-stone-800 dark:text-stone-50 font-semibold" 
                                                            : "text-stone-500 hover:text-stone-850 dark:text-stone-450 dark:hover:text-stone-200"
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
                                    <div className="pt-1.5 text-xs font-semibold text-stone-500 dark:text-stone-400">标签</div>
                                    <div className="min-w-0">
                                        <div className={cn("flex flex-wrap gap-2 overflow-hidden transition-[max-height] duration-200", !tagsExpanded && "max-h-[38px]")}>
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
                                        {visibleTags.length > 15 ? (
                                            <button
                                                type="button"
                                                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-750 dark:text-indigo-405 dark:hover:text-indigo-300 cursor-pointer transition-colors"
                                                onClick={() => setTagsExpanded((value) => !value)}
                                            >
                                                {tagsExpanded ? "收起标签" : `展开全部 (${visibleTags.length - 1} 个标签)`}
                                                <ChevronDown className={cn("size-3.5 transition-transform duration-200", tagsExpanded && "rotate-180")} />
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>

                {!query.isLoading ? (
                    <div>
                        <div className="mx-auto grid max-w-7xl gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {promptItems.map((item) => (
                                <PromptCard
                                    key={item.id}
                                    item={item}
                                    onOpen={() => setSelectedPrompt(item)}
                                    onCopy={() => copyText(item.prompt, "提示词已复制")}
                                    extraAction={
                                        <Button size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => savePromptAsset(item)} className="cursor-pointer">
                                            加入我的素材
                                        </Button>
                                    }
                                />
                            ))}
                        </div>
                        {promptItems.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有找到匹配的提示词" className="py-16" /> : null}
                        <div className="mx-auto mt-6 max-w-7xl text-center text-xs text-stone-500 dark:text-stone-400">
                            {query.isFetchingNextPage ? "加载中..." : query.hasNextPage ? "继续向下滚动加载更多" : promptItems.length > 0 ? "已经到底了" : null}
                        </div>
                    </div>
                ) : null}
            </main>

            <PromptDetailDialog prompt={selectedPrompt} onClose={() => setSelectedPrompt(null)} onCopy={(prompt) => copyText(prompt, "提示词已复制")} onSaveAsset={savePromptAsset} />
        </div>
    );
}
