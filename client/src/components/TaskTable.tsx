import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { formatDateTime, formatDuration, isOverdue, isRunning, liveSeconds } from '../lib/format';
import type { TaskSummary } from '../lib/types';
import { cx, Empty, Icon, PriorityBadge, StatusBadge } from './ui';

/** Re-renders every second while any listed timer runs, so durations tick live. */
export function useTicker(active: boolean) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (!active) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [active]);
    return now;
}

export function TaskTable({ tasks, showAssignee = true, empty = 'No tasks here yet.' }: { tasks: TaskSummary[]; showAssignee?: boolean; empty?: string }) {
    const now = useTicker(tasks.some(isRunning));
    if (tasks.length === 0) return <Empty>{empty}</Empty>;

    return (
        <div className="overflow-x-auto">
            <table className="table">
                <thead>
                    <tr>
                        <th>Task</th>
                        {showAssignee && <th>Assignee</th>}
                        <th>Status</th>
                        <th>Due</th>
                        <th className="text-right">Time</th>
                    </tr>
                </thead>
                <tbody>
                    {tasks.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50">
                            <td className="min-w-56">
                                <Link to={`/tasks/${t.id}`} className="font-medium text-slate-800 hover:text-brand-600">
                                    {t.title}
                                </Link>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                    {t.priority !== 'MEDIUM' && <PriorityBadge priority={t.priority} />}
                                    {t.project && <span>{t.project.name}</span>}
                                    {!t.project && t.client && <span>{t.client.name}</span>}
                                    {t._count.issues > 0 && (
                                        <span className="inline-flex items-center gap-1 text-rose-600">
                                            <Icon name="alert" className="size-3" />
                                            {t._count.issues} open issue{t._count.issues > 1 ? 's' : ''}
                                        </span>
                                    )}
                                    {t._count.attachments > 0 && (
                                        <span className="inline-flex items-center gap-0.5">
                                            <Icon name="paperclip" className="size-3" />
                                            {t._count.attachments}
                                        </span>
                                    )}
                                </div>
                            </td>
                            {showAssignee && (
                                <td className="whitespace-nowrap">
                                    {t.assignee.name}
                                    <div className="text-xs text-slate-400">by {t.creator.name}</div>
                                </td>
                            )}
                            <td>
                                <StatusBadge status={t.status} />
                            </td>
                            <td className={cx('whitespace-nowrap', isOverdue(t) ? 'font-medium text-rose-600' : 'text-slate-600')}>
                                {formatDateTime(t.dueDate)}
                            </td>
                            <td className="text-right whitespace-nowrap tabular-nums">
                                {isRunning(t) && <span className="mr-1.5 inline-block size-2 animate-pulse rounded-full bg-emerald-500" title="Timer running" />}
                                {formatDuration(liveSeconds(t, now))}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
