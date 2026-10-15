import { useState } from 'react';
import { Link } from 'react-router';
import { Card, Empty, Field, Loading, PageHeader } from '../components/ui';
import { query, useApi } from '../lib/api';
import { formatDateTime } from '../lib/format';
import type { ActivityItem, User } from '../lib/types';

export function ActivityPage() {
    const [filters, setFilters] = useState({ userId: '', from: '', to: '' });
    const { data: users } = useApi<User[]>('/users');
    const { data: items } = useApi<ActivityItem[]>(`/activity${query(filters)}`);

    // Group by calendar day for easier scanning.
    const groups = new Map<string, ActivityItem[]>();
    for (const a of items ?? []) {
        const key = new Date(a.createdAt).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        groups.set(key, [...(groups.get(key) ?? []), a]);
    }

    return (
        <>
            <PageHeader title="Work history" subtitle="Who assigned what to whom, status changes, issues and completions" />
            <Card>
                <div className="grid gap-3 border-b border-slate-100 p-3 sm:grid-cols-3">
                    <Field label="Person">
                        <select className="input" value={filters.userId} onChange={(e) => setFilters({ ...filters, userId: e.target.value })}>
                            <option value="">Everyone</option>
                            {users?.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label="From">
                        <input type="date" className="input" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
                    </Field>
                    <Field label="To">
                        <input type="date" className="input" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
                    </Field>
                </div>
                {!items ? (
                    <Loading />
                ) : items.length === 0 ? (
                    <Empty>No activity for these filters.</Empty>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {[...groups].map(([day, list]) => (
                            <section key={day} className="px-4 py-3">
                                <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{day}</h3>
                                <ul className="space-y-2">
                                    {list.map((a) => (
                                        <li key={a.id} className="flex gap-3 text-sm">
                                            <span className="w-12 shrink-0 text-xs text-slate-400 tabular-nums">
                                                {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <span className="text-slate-700">
                                                {a.task ? (
                                                    <Link to={`/tasks/${a.task.id}`} className="hover:text-brand-600">
                                                        {a.message}
                                                    </Link>
                                                ) : (
                                                    a.message
                                                )}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                )}
            </Card>
            {items && items.length >= 300 && (
                <p className="mt-2 text-xs text-slate-400">Showing the latest 300 entries up to {formatDateTime(items[items.length - 1].createdAt)}. Narrow the dates to see older history.</p>
            )}
        </>
    );
}
