import { useEffect, useState } from "react";
import { App, Button, Drawer, Empty, Switch, Tag, Typography } from "antd";
import { Bug, Copy, Trash2 } from "lucide-react";

import { clearDebugLogs, formatDebugLogs, getDebugLogs, isDebugLogEnabled, setDebugLogEnabled, subscribeDebugLogs, type DebugLogEntry } from "@/lib/debug-log";
import { useCopyText } from "@/hooks/use-copy-text";

export function DebugLogFab() {
    const [enabled, setEnabled] = useState(isDebugLogEnabled);
    const [open, setOpen] = useState(false);
    const [logs, setLogs] = useState<DebugLogEntry[]>(() => getDebugLogs());

    useEffect(
        () =>
            subscribeDebugLogs((next) => {
                setLogs(next);
                setEnabled(isDebugLogEnabled());
            }),
        [],
    );

    if (!enabled) return null;

    return (
        <>
            <button
                type="button"
                className="fixed bottom-4 right-4 z-[1200] flex items-center gap-1.5 rounded-full bg-stone-900 px-3 py-2 text-xs text-white shadow-lg hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
                onClick={() => setOpen(true)}
            >
                <Bug className="size-3.5" />
                调试日志
                {logs.length ? <span className="rounded-full bg-white/20 px-1.5 dark:bg-black/10">{logs.length}</span> : null}
            </button>
            <DebugLogDrawer open={open} onClose={() => setOpen(false)} logs={logs} onEnabledChange={setEnabled} />
        </>
    );
}

export function DebugLogPreference() {
    const [enabled, setEnabled] = useState(isDebugLogEnabled);
    const [open, setOpen] = useState(false);
    const [logs, setLogs] = useState<DebugLogEntry[]>(() => getDebugLogs());

    useEffect(
        () =>
            subscribeDebugLogs((next) => {
                setLogs(next);
                setEnabled(isDebugLogEnabled());
            }),
        [],
    );

    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-3 dark:border-stone-800">
                <div className="min-w-0">
                    <div className="text-sm font-medium">调试日志</div>
                    <div className="mt-1 text-xs text-stone-500">开启后记录 AI 请求路径、状态码、代理回退与错误摘要，便于排查视频/生图失败；不记录 Key 与完整 base64。</div>
                </div>
                <div className="flex items-center gap-2">
                    {enabled ? (
                        <Button size="small" onClick={() => setOpen(true)}>
                            查看 ({logs.length})
                        </Button>
                    ) : null}
                    <Switch
                        checked={enabled}
                        onChange={(value) => {
                            setDebugLogEnabled(value);
                            setEnabled(value);
                        }}
                    />
                </div>
            </div>
            <DebugLogDrawer open={open} onClose={() => setOpen(false)} logs={logs} onEnabledChange={setEnabled} />
        </>
    );
}

function DebugLogDrawer({ open, onClose, logs, onEnabledChange }: { open: boolean; onClose: () => void; logs: DebugLogEntry[]; onEnabledChange: (value: boolean) => void }) {
    const { message } = App.useApp();
    const copyText = useCopyText();

    return (
        <Drawer
            title="调试日志"
            open={open}
            onClose={onClose}
            width={Math.min(560, typeof window !== "undefined" ? window.innerWidth - 24 : 560)}
            extra={
                <div className="flex items-center gap-2">
                    <Button
                        size="small"
                        icon={<Copy className="size-3.5" />}
                        onClick={() => {
                            copyText(formatDebugLogs(logs), "已复制调试日志");
                        }}
                        disabled={!logs.length}
                    >
                        复制
                    </Button>
                    <Button
                        size="small"
                        danger
                        icon={<Trash2 className="size-3.5" />}
                        onClick={() => {
                            clearDebugLogs();
                            message.success("已清空调试日志");
                        }}
                        disabled={!logs.length}
                    >
                        清空
                    </Button>
                </div>
            }
        >
            <div className="mb-3 flex items-center justify-between gap-3">
                <Typography.Text type="secondary" className="text-xs">
                    最近 {logs.length} 条，最多保留 200 条
                </Typography.Text>
                <div className="flex items-center gap-2 text-xs">
                    <span>开关</span>
                    <Switch
                        size="small"
                        checked={isDebugLogEnabled()}
                        onChange={(value) => {
                            setDebugLogEnabled(value);
                            onEnabledChange(value);
                            if (!value) onClose();
                        }}
                    />
                </div>
            </div>
            {!logs.length ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无日志，开启后发起视频/生图请求即可记录" />
            ) : (
                <div className="space-y-2">
                    {logs.map((entry) => (
                        <div key={entry.id} className="rounded-lg border border-stone-200 p-2.5 text-xs dark:border-stone-800">
                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                                <Tag color={entry.level === "error" ? "error" : entry.level === "warn" ? "warning" : "default"} className="mr-0">
                                    {entry.level}
                                </Tag>
                                <Tag className="mr-0">{entry.scope}</Tag>
                                <span className="opacity-55">{new Date(entry.ts).toLocaleTimeString()}</span>
                            </div>
                            <div className="font-medium leading-5">{entry.message}</div>
                            {entry.data ? (
                                <pre className="thin-scrollbar mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-stone-50 p-2 text-[11px] leading-4 text-stone-600 dark:bg-stone-950 dark:text-stone-300">
                                    {JSON.stringify(entry.data, null, 2)}
                                </pre>
                            ) : null}
                        </div>
                    ))}
                </div>
            )}
        </Drawer>
    );
}
