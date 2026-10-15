import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { TaskForm } from '../components/TaskForm';
import { useTicker } from '../components/TaskTable';
import { Badge, Button, Card, Empty, ErrorText, errorMessage, Field, Icon, Loading, Modal, PriorityBadge, StatusBadge } from '../components/ui';
import { api, download, uploadFiles, useApi } from '../lib/api';
import { formatBytes, formatClock, formatDateTime, formatDuration, isOverdue, isRunning, liveSeconds, timeAgo } from '../lib/format';
import type { TaskDetail } from '../lib/types';

export function TaskDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data: task, error, reload } = useApi<TaskDetail>(`/tasks/${id}`);
    const [dialog, setDialog] = useState<'edit' | 'issue' | 'complete' | null>(null);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState<string>();
    const running = !!task && isRunning(task);
    const now = useTicker(running);

    if (error) return <ErrorText>{error}</ErrorText>;
    if (!task) return <Loading />;

    const act = async (fn: () => Promise<unknown>) => {
        setBusy(true);
        setActionError(undefined);
        try {
            await fn();
            reload();
        } catch (err) {
            setActionError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };
    const post = (path: string, body?: unknown) => act(() => api(`/tasks/${task.id}${path}`, { method: 'POST', body }));

    const remove = () => {
        if (!confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
        void act(async () => {
            await api(`/tasks/${task.id}`, { method: 'DELETE' });
            navigate('/tasks');
        });
    };

    const open = task.status !== 'COMPLETED';
    const seconds = liveSeconds(task, now);

    return (
        <>
            <div className="mb-4 text-sm">
                <Link to="/tasks" className="text-slate-500 hover:text-brand-600">
                    ← Tasks
                </Link>
            </div>

            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={task.status} />
                        <PriorityBadge priority={task.priority} />
                        {isOverdue(task) && <Badge className="bg-rose-600 text-white ring-rose-600">Overdue</Badge>}
                    </div>
                    <h1 className="mt-2 text-2xl font-semibold text-slate-900">{task.title}</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Assigned to <b className="font-medium text-slate-700">{task.assignee.name}</b> by {task.creator.name} ·{' '}
                        {timeAgo(task.createdAt)}
                    </p>
                </div>

                <div className="card flex items-center gap-4 px-4 py-3">
                    <div>
                        <p className="text-xs font-medium text-slate-500">{running ? 'Timer running' : 'Time spent'}</p>
                        <p className="font-mono text-2xl font-semibold tabular-nums">{formatClock(seconds)}</p>
                    </div>
                    {task.isAssignee && open && (
                        <div className="flex flex-col gap-1.5">
                            {running ? (
                                <Button variant="secondary" size="sm" disabled={busy} onClick={() => post('/stop')}>
                                    <Icon name="pause" /> Pause
                                </Button>
                            ) : (
                                <Button size="sm" disabled={busy || task.status === 'BLOCKED'} onClick={() => post('/start')}>
                                    <Icon name="play" /> {task.status === 'NEW' ? 'Start' : 'Resume'}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="mb-6 flex flex-wrap gap-2">
                {task.isAssignee && open && (
                    <>
                        <Button disabled={busy || task.status === 'BLOCKED'} onClick={() => setDialog('complete')}>
                            <Icon name="check" /> Mark completed
                        </Button>
                        <Button variant="secondary" disabled={busy} onClick={() => setDialog('issue')}>
                            <Icon name="alert" /> Report an issue
                        </Button>
                    </>
                )}
                {task.canManage && (
                    <>
                        <Button variant="secondary" onClick={() => setDialog('edit')}>
                            <Icon name="edit" /> Edit
                        </Button>
                        {!open && (
                            <Button variant="secondary" disabled={busy} onClick={() => post('/reopen')}>
                                Reopen
                            </Button>
                        )}
                        <Button variant="ghost" className="text-rose-600" onClick={remove}>
                            <Icon name="trash" /> Delete
                        </Button>
                    </>
                )}
            </div>
            {task.status === 'BLOCKED' && (
                <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    This task is blocked. {task.isAssignee ? 'Your manager or lead has been notified.' : 'Resolve the open issue below so work can continue.'}
                </p>
            )}
            <ErrorText>{actionError}</ErrorText>

            <div className="mt-4 grid gap-6 xl:grid-cols-3">
                <div className="space-y-6 xl:col-span-2">
                    <Card title="Details">
                        <div className="space-y-4 p-4">
                            <TextBlock label="Description" text={task.description} />
                            <TextBlock label="Notes" text={task.notes} />
                            {task.status === 'COMPLETED' && <TextBlock label="Final notes" text={task.finalNotes} />}
                        </div>
                    </Card>
                    <IssuesCard task={task} onChange={reload} />
                    <AttachmentsCard task={task} onChange={reload} />
                    <Card title="Work history">
                        {task.activities.length === 0 ? (
                            <Empty>No history yet.</Empty>
                        ) : (
                            <ol className="space-y-3 p-4">
                                {task.activities.map((a) => (
                                    <li key={a.id} className="flex gap-3 text-sm">
                                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" />
                                        <span>
                                            <span className="text-slate-700">{a.message}</span>
                                            <span className="block text-xs text-slate-400">{formatDateTime(a.createdAt)}</span>
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card title="Summary">
                        <dl className="divide-y divide-slate-100 text-sm">
                            <Row label="Client">{task.client?.name ?? '—'}</Row>
                            <Row label="Project">{task.project?.name ?? '—'}</Row>
                            <Row label="Team">{task.team?.name ?? '—'}</Row>
                            <Row label="Due">{formatDateTime(task.dueDate)}</Row>
                            <Row label="Started">{formatDateTime(task.startedAt)}</Row>
                            <Row label="Completed">{formatDateTime(task.completedAt)}</Row>
                            <Row label="Total time">{formatDuration(seconds)}</Row>
                        </dl>
                    </Card>
                    <Card title="Time log">
                        {task.timeLogs.length === 0 ? (
                            <Empty>No time tracked yet.</Empty>
                        ) : (
                            <ul className="divide-y divide-slate-100 text-sm">
                                {task.timeLogs.map((l) => (
                                    <li key={l.id} className="flex justify-between gap-3 px-4 py-2">
                                        <span className="text-slate-600">
                                            {formatDateTime(l.startedAt)}
                                            {l.endedAt ? ` – ${new Date(l.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                                        </span>
                                        <span className="font-medium tabular-nums">
                                            {l.endedAt ? formatDuration(l.seconds) : <span className="text-emerald-600">running</span>}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>
            </div>

            {dialog === 'edit' && (
                <TaskForm
                    task={task}
                    onClose={() => setDialog(null)}
                    onSaved={() => {
                        setDialog(null);
                        reload();
                    }}
                />
            )}
            {dialog === 'issue' && (
                <TextDialog
                    title="Report an issue"
                    label="What is blocking you?"
                    hint="The task is paused and marked blocked until a manager or lead resolves it."
                    submitLabel="Report issue"
                    required
                    onClose={() => setDialog(null)}
                    onSubmit={async (description) => {
                        await api(`/tasks/${task.id}/issues`, { body: { description } });
                        setDialog(null);
                        reload();
                    }}
                />
            )}
            {dialog === 'complete' && (
                <TextDialog
                    title="Complete task"
                    label="Final notes"
                    hint={`The timer stops and ${formatDuration(seconds)} is recorded as the total time.`}
                    submitLabel="Mark completed"
                    onClose={() => setDialog(null)}
                    onSubmit={async (finalNotes) => {
                        await api(`/tasks/${task.id}/complete`, { body: { finalNotes } });
                        setDialog(null);
                        reload();
                    }}
                />
            )}
        </>
    );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex justify-between gap-3 px-4 py-2.5">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-right font-medium text-slate-700">{children}</dd>
        </div>
    );
}

function TextBlock({ label, text }: { label: string; text: string }) {
    return (
        <div>
            <h3 className="label">{label}</h3>
            <p className="text-sm whitespace-pre-wrap text-slate-700">{text || <span className="text-slate-400">—</span>}</p>
        </div>
    );
}

function IssuesCard({ task, onChange }: { task: TaskDetail; onChange: () => void }) {
    const [resolving, setResolving] = useState<string | null>(null);
    if (task.issues.length === 0) return null;

    return (
        <Card title="Issues & blockers">
            <ul className="divide-y divide-slate-100">
                {task.issues.map((i) => (
                    <li key={i.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-sm whitespace-pre-wrap text-slate-800">{i.description}</p>
                                <p className="mt-1 text-xs text-slate-400">
                                    Reported by {i.reporter.name} · {formatDateTime(i.createdAt)}
                                </p>
                                {i.status === 'RESOLVED' && (
                                    <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                        <b className="font-medium">Resolved by {i.resolver?.name}</b>
                                        {i.resolution && `: ${i.resolution}`}
                                    </p>
                                )}
                            </div>
                            {i.status === 'OPEN' ? (
                                task.canManage ? (
                                    <Button size="sm" onClick={() => setResolving(i.id)}>
                                        Resolve
                                    </Button>
                                ) : (
                                    <Badge className="bg-rose-50 text-rose-700 ring-rose-200">Open</Badge>
                                )
                            ) : (
                                <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">Resolved</Badge>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
            {resolving && (
                <TextDialog
                    title="Resolve issue"
                    label="Resolution"
                    hint="The assignee is notified and the task goes back to In progress."
                    submitLabel="Resolve"
                    onClose={() => setResolving(null)}
                    onSubmit={async (resolution) => {
                        await api(`/tasks/${task.id}/issues/${resolving}/resolve`, { body: { resolution } });
                        setResolving(null);
                        onChange();
                    }}
                />
            )}
        </Card>
    );
}

function AttachmentsCard({ task, onChange }: { task: TaskDetail; onChange: () => void }) {
    const [error, setError] = useState<string>();
    const [uploading, setUploading] = useState(false);

    const upload = async (files: FileList | null) => {
        if (!files?.length) return;
        setUploading(true);
        setError(undefined);
        try {
            await uploadFiles([...files], { taskId: task.id });
            onChange();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setUploading(false);
        }
    };

    return (
        <Card
            title={`Attachments · ${task.attachments.length}`}
            actions={
                <label className="cursor-pointer text-xs font-medium text-brand-600 hover:underline">
                    {uploading ? 'Uploading…' : 'Upload files'}
                    <input type="file" multiple className="hidden" disabled={uploading} onChange={(e) => upload(e.target.files)} />
                </label>
            }
        >
            {error && <div className="p-3"><ErrorText>{error}</ErrorText></div>}
            {task.attachments.length === 0 ? (
                <Empty>No documents attached.</Empty>
            ) : (
                <AttachmentList files={task.attachments} onChange={onChange} />
            )}
        </Card>
    );
}

export function AttachmentList({
    files,
    onChange,
}: {
    files: { id: string; originalName: string; size: number; createdAt: string; uploader?: { name: string } }[];
    onChange?: () => void;
}) {
    return (
        <ul className="divide-y divide-slate-100">
            {files.map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <Icon name="paperclip" className="text-slate-400" />
                    <span className="min-w-0 flex-1">
                        <button onClick={() => download(`/attachments/${f.id}/download`, f.originalName)} className="block truncate text-left font-medium text-slate-700 hover:text-brand-600">
                            {f.originalName}
                        </button>
                        <span className="text-xs text-slate-400">
                            {formatBytes(f.size)}
                            {f.uploader && ` · ${f.uploader.name}`} · {timeAgo(f.createdAt)}
                        </span>
                    </span>
                    {onChange && (
                        <button
                            className="text-slate-400 hover:text-rose-600"
                            aria-label={`Remove ${f.originalName}`}
                            onClick={async () => {
                                if (!confirm(`Remove ${f.originalName}?`)) return;
                                try {
                                    await api(`/attachments/${f.id}`, { method: 'DELETE' });
                                    onChange();
                                } catch (err) {
                                    alert(errorMessage(err));
                                }
                            }}
                        >
                            <Icon name="trash" />
                        </button>
                    )}
                </li>
            ))}
        </ul>
    );
}

function TextDialog({
    title,
    label,
    hint,
    submitLabel,
    required,
    onClose,
    onSubmit,
}: {
    title: string;
    label: string;
    hint?: string;
    submitLabel: string;
    required?: boolean;
    onClose: () => void;
    onSubmit: (text: string) => Promise<void>;
}) {
    const [text, setText] = useState('');
    const [error, setError] = useState<string>();
    const [busy, setBusy] = useState(false);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            await onSubmit(text.trim());
        } catch (err) {
            setError(errorMessage(err));
            setBusy(false);
        }
    };

    return (
        <Modal title={title} onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                <Field label={label} hint={hint}>
                    <textarea className="input min-h-28" autoFocus required={required} value={text} onChange={(e) => setText(e.target.value)} />
                </Field>
                <ErrorText>{error}</ErrorText>
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={busy}>
                        {submitLabel}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
