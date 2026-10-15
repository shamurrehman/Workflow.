import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router';
import { Avatar, Button, cx, Empty, ErrorText, errorMessage, Field, Icon, Loading, Modal } from '../components/ui';
import { api, useApi } from '../lib/api';
import { useMe } from '../lib/auth';
import { formatDate, ROLE_LABEL } from '../lib/format';
import type { ChannelDetail, ChannelSummary, ChatMessage, ChatPerson } from '../lib/types';

const MESSAGE_POLL_MS = 3_000;
const CHANNEL_POLL_MS = 10_000;

const channelTitle = (c: { kind: string; name: string; other?: ChatPerson | null }) => (c.kind === 'DIRECT' ? (c.other?.name ?? 'Direct message') : c.name);

export function ChatPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data: channels, reload } = useApi<ChannelSummary[]>('/chat/channels');
    const [creating, setCreating] = useState<'channel' | 'direct' | null>(null);

    useEffect(() => {
        const timer = setInterval(reload, CHANNEL_POLL_MS);
        return () => clearInterval(timer);
    }, [reload]);

    // On wide screens open a channel straight away; on phones the list is the landing view.
    useEffect(() => {
        if (id || !channels?.length || !window.matchMedia('(min-width: 768px)').matches) return;
        const first = channels.find((c) => c.joined && c.kind !== 'DIRECT') ?? channels[0];
        navigate(`/chat/${first.id}`, { replace: true });
    }, [id, channels, navigate]);

    const open = (channelId: string) => {
        setCreating(null);
        reload();
        navigate(`/chat/${channelId}`);
    };

    return (
        <div className="card flex h-[calc(100dvh-7rem)] min-h-[28rem] overflow-hidden">
            <aside className={cx('w-full shrink-0 flex-col border-r border-slate-200 bg-slate-50/60 md:flex md:w-72', id ? 'hidden' : 'flex')}>
                <ChannelList channels={channels} activeId={id} onNewChannel={() => setCreating('channel')} onNewDirect={() => setCreating('direct')} />
            </aside>
            <section className={cx('min-w-0 flex-1 flex-col', id ? 'flex' : 'hidden md:flex')}>
                {id ? (
                    <Conversation key={id} id={id} onChanged={reload} />
                ) : (
                    <div className="grid flex-1 place-items-center">
                        <Empty>Pick a channel or start a direct message.</Empty>
                    </div>
                )}
            </section>
            {creating === 'channel' && <NewChannel onClose={() => setCreating(null)} onCreated={open} />}
            {creating === 'direct' && <NewDirect onClose={() => setCreating(null)} onOpened={open} />}
        </div>
    );
}

function ChannelList({
    channels,
    activeId,
    onNewChannel,
    onNewDirect,
}: {
    channels?: ChannelSummary[];
    activeId?: string;
    onNewChannel: () => void;
    onNewDirect: () => void;
}) {
    if (!channels) return <Loading />;
    const byName = (a: ChannelSummary, b: ChannelSummary) => channelTitle(a).localeCompare(channelTitle(b));
    const joined = channels.filter((c) => c.kind !== 'DIRECT' && c.joined).sort(byName);
    const direct = channels.filter((c) => c.kind === 'DIRECT');
    const more = channels.filter((c) => c.kind === 'PUBLIC' && !c.joined).sort(byName);

    return (
        <div className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
            <ListSection title="Channels" onAdd={onNewChannel} addLabel="Create a channel">
                {joined.map((c) => (
                    <ChannelLink key={c.id} channel={c} active={c.id === activeId} />
                ))}
                {joined.length === 0 && <p className="px-3 text-xs text-slate-400">You haven't joined any channels yet.</p>}
            </ListSection>
            <ListSection title="Direct messages" onAdd={onNewDirect} addLabel="Message someone">
                {direct.map((c) => (
                    <ChannelLink key={c.id} channel={c} active={c.id === activeId} />
                ))}
                {direct.length === 0 && <p className="px-3 text-xs text-slate-400">No conversations yet.</p>}
            </ListSection>
            {more.length > 0 && (
                <ListSection title="Other channels">
                    {more.map((c) => (
                        <ChannelLink key={c.id} channel={c} active={c.id === activeId} muted />
                    ))}
                </ListSection>
            )}
        </div>
    );
}

function ListSection({ title, onAdd, addLabel, children }: { title: string; onAdd?: () => void; addLabel?: string; children: ReactNode }) {
    return (
        <div>
            <div className="mb-1 flex items-center justify-between px-3">
                <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h3>
                {onAdd && (
                    <button onClick={onAdd} className="rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800" aria-label={addLabel} title={addLabel}>
                        <Icon name="plus" />
                    </button>
                )}
            </div>
            <ul className="space-y-0.5">{children}</ul>
        </div>
    );
}

function ChannelLink({ channel: c, active, muted }: { channel: ChannelSummary; active: boolean; muted?: boolean }) {
    const unread = !active && c.unread > 0;
    return (
        <li>
            <NavLink
                to={`/chat/${c.id}`}
                className={cx(
                    'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition',
                    active ? 'bg-brand-600 text-white' : unread ? 'font-semibold text-slate-900 hover:bg-slate-200/70' : 'text-slate-600 hover:bg-slate-200/70',
                    muted && !active && 'text-slate-400',
                )}
            >
                {c.kind === 'DIRECT' ? (
                    <Avatar user={c.other ?? { name: '?' }} size="xs" />
                ) : (
                    <Icon name={c.kind === 'PRIVATE' ? 'lock' : 'hash'} className={cx('size-4', active ? 'text-white/80' : 'text-slate-400')} />
                )}
                <span className="min-w-0 flex-1 truncate">{channelTitle(c)}</span>
                {unread && (
                    <span className="grid min-w-5 place-items-center rounded-full bg-accent-600 px-1.5 text-[11px] leading-5 font-semibold text-white">
                        {c.unread > 99 ? '99+' : c.unread}
                    </span>
                )}
            </NavLink>
        </li>
    );
}

function Conversation({ id, onChanged }: { id: string; onChanged: () => void }) {
    const me = useMe();
    const navigate = useNavigate();
    const { data: channel, error: channelError, reload: reloadChannel } = useApi<ChannelDetail>(`/chat/channels/${id}`);
    const [messages, setMessages] = useState<ChatMessage[]>();
    const [hasMore, setHasMore] = useState(false);
    const [loadError, setLoadError] = useState<string>();
    const [showSettings, setShowSettings] = useState(false);

    const listRef = useRef<HTMLDivElement>(null);
    const stickToBottom = useRef(true);
    const prependedFrom = useRef<number | null>(null);
    const latest = useRef<string | null>(null);

    const markRead = useCallback(() => {
        api(`/chat/channels/${id}/read`, { method: 'POST' })
            .then(() => {
                window.dispatchEvent(new Event('chat:read'));
                onChanged();
            })
            .catch(() => {});
    }, [id, onChanged]);

    /** Adds messages we don't have yet, keeping chronological order. */
    const merge = useCallback((incoming: ChatMessage[]) => {
        setMessages((prev = []) => {
            const known = new Set(prev.map((m) => m.id));
            const fresh = incoming.filter((m) => !known.has(m.id));
            return fresh.length ? [...prev, ...fresh] : prev;
        });
        const last = incoming.at(-1);
        if (last && (!latest.current || last.createdAt > latest.current)) latest.current = last.createdAt;
    }, []);

    useEffect(() => {
        let cancelled = false;
        const startedAt = new Date().toISOString();
        api<{ items: ChatMessage[]; hasMore: boolean }>(`/chat/channels/${id}/messages`)
            .then((page) => {
                if (cancelled) return;
                setMessages(page.items);
                setHasMore(page.hasMore);
                latest.current = page.items.at(-1)?.createdAt ?? startedAt;
                markRead();
            })
            .catch((err) => !cancelled && setLoadError(errorMessage(err)));
        return () => {
            cancelled = true;
        };
    }, [id, markRead]);

    // Poll for new messages while the conversation is open.
    useEffect(() => {
        const timer = setInterval(async () => {
            const since = latest.current;
            if (!since || document.hidden) return;
            try {
                const page = await api<{ items: ChatMessage[] }>(`/chat/channels/${id}/messages?after=${encodeURIComponent(since)}`);
                merge(page.items);
                if (page.items.some((m) => m.authorId !== me.id && m.createdAt > since)) markRead();
            } catch {
                // keep polling; a transient failure shouldn't break the conversation
            }
        }, MESSAGE_POLL_MS);
        return () => clearInterval(timer);
    }, [id, me.id, merge, markRead]);

    useLayoutEffect(() => {
        const el = listRef.current;
        if (!el) return;
        if (prependedFrom.current !== null) {
            el.scrollTop += el.scrollHeight - prependedFrom.current;
            prependedFrom.current = null;
        } else if (stickToBottom.current) {
            el.scrollTop = el.scrollHeight;
        }
    }, [messages]);

    const onScroll = () => {
        const el = listRef.current;
        if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };

    const loadOlder = async () => {
        if (!messages?.length) return;
        const page = await api<{ items: ChatMessage[]; hasMore: boolean }>(`/chat/channels/${id}/messages?before=${messages[0].id}`);
        prependedFrom.current = listRef.current?.scrollHeight ?? null;
        setMessages((prev = []) => [...page.items, ...prev]);
        setHasMore(page.hasMore);
    };

    const send = async (body: string) => {
        const message = await api<ChatMessage>(`/chat/channels/${id}/messages`, { body: { body } });
        stickToBottom.current = true;
        merge([message]);
        if (!channel?.joined) reloadChannel();
        onChanged();
    };

    const remove = async (message: ChatMessage) => {
        if (!confirm('Delete this message?')) return;
        await api(`/chat/messages/${message.id}`, { method: 'DELETE' });
        setMessages((prev) => prev?.filter((m) => m.id !== message.id));
    };

    const join = async () => {
        await api(`/chat/channels/${id}/join`, { method: 'POST' });
        reloadChannel();
        markRead();
    };

    if (channelError || loadError) {
        return (
            <div className="grid flex-1 place-items-center p-6 text-center">
                <div>
                    <Empty>{channelError ?? loadError}</Empty>
                    <Link to="/chat" className="text-sm font-medium text-brand-600 hover:underline">
                        Back to chat
                    </Link>
                </div>
            </div>
        );
    }
    if (!channel || !messages) return <Loading />;

    const other = channel.kind === 'DIRECT' ? (channel.members.find((m) => m.id !== me.id) ?? channel.members[0]) : undefined;
    const title = other ? other.name : channel.name;

    return (
        <>
            <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
                <Link to="/chat" className="-ml-1 rounded-lg p-1 text-slate-500 hover:bg-slate-100 md:hidden" aria-label="All conversations">
                    <Icon name="chevronLeft" className="size-5" />
                </Link>
                {other ? (
                    <Avatar user={other} size="sm" />
                ) : (
                    <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-600">
                        <Icon name={channel.kind === 'PRIVATE' ? 'lock' : 'hash'} />
                    </span>
                )}
                <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold text-slate-900">{title}</h2>
                    <p className="truncate text-xs text-slate-500">
                        {other ? ROLE_LABEL[other.role] : channel.description || (channel.kind === 'PRIVATE' ? 'Private channel' : 'Public channel')}
                    </p>
                </div>
                {channel.kind !== 'DIRECT' && (
                    <Button variant="secondary" size="sm" onClick={() => setShowSettings(true)} aria-label="Members and settings">
                        <Icon name="users" /> {channel.members.length}
                    </Button>
                )}
            </header>

            <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto py-3">
                {hasMore ? (
                    <div className="py-2 text-center">
                        <Button variant="ghost" size="sm" onClick={loadOlder}>
                            Load earlier messages
                        </Button>
                    </div>
                ) : (
                    <div className="px-4 pt-4 pb-2">
                        <p className="font-semibold text-slate-800">{other ? `This is the start of your conversation with ${other.name}.` : `Welcome to #${channel.name}`}</p>
                        {!other && <p className="text-sm text-slate-500">{channel.description || 'This is the very beginning of the channel.'}</p>}
                    </div>
                )}
                {messages.map((m, i) => {
                    const prev = messages[i - 1];
                    const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
                    const grouped = !newDay && prev.authorId === m.authorId && +new Date(m.createdAt) - +new Date(prev.createdAt) < 5 * 60_000;
                    return (
                        <Fragment key={m.id}>
                            {newDay && <DayDivider date={m.createdAt} />}
                            <MessageRow message={m} grouped={grouped} canDelete={m.authorId === me.id || me.role === 'ADMIN'} onDelete={() => remove(m)} />
                        </Fragment>
                    );
                })}
            </div>

            {channel.joined || channel.kind === 'DIRECT' ? (
                <Composer key={id} placeholder={other ? `Message ${other.name}` : `Message #${channel.name}`} onSend={send} />
            ) : (
                <div className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    You're viewing <strong>#{channel.name}</strong>
                    <Button size="sm" onClick={join}>
                        Join channel
                    </Button>
                </div>
            )}

            {showSettings && (
                <ChannelSettings
                    channel={channel}
                    onClose={() => setShowSettings(false)}
                    onChanged={() => {
                        reloadChannel();
                        onChanged();
                    }}
                    onGone={() => {
                        setShowSettings(false);
                        onChanged();
                        navigate('/chat');
                    }}
                />
            )}
        </>
    );
}

function DayDivider({ date }: { date: string }) {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86_400_000);
    const label = d.toDateString() === today.toDateString() ? 'Today' : d.toDateString() === yesterday.toDateString() ? 'Yesterday' : formatDate(d);
    return (
        <div className="relative my-3 flex items-center px-4" role="separator">
            <div className="flex-1 border-t border-slate-200" />
            <span className="mx-3 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-500">{label}</span>
            <div className="flex-1 border-t border-slate-200" />
        </div>
    );
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

function MessageRow({ message: m, grouped, canDelete, onDelete }: { message: ChatMessage; grouped: boolean; canDelete: boolean; onDelete: () => void }) {
    return (
        <div className={cx('group relative flex gap-3 px-4 hover:bg-slate-50', grouped ? 'py-0.5' : 'pt-2.5 pb-0.5')}>
            <div className="w-9 shrink-0">
                {grouped ? (
                    <span className="invisible block pt-0.5 text-right text-[10px] leading-5 text-slate-400 group-hover:visible">{timeOf(m.createdAt)}</span>
                ) : (
                    <Avatar user={m.author} />
                )}
            </div>
            <div className="min-w-0 flex-1">
                {!grouped && (
                    <p className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-slate-900">{m.author.name}</span>
                        <time dateTime={m.createdAt} className="text-xs text-slate-400">
                            {timeOf(m.createdAt)}
                        </time>
                    </p>
                )}
                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-slate-700">
                    <Linkified text={m.body} />
                </p>
            </div>
            {canDelete && (
                <button
                    onClick={onDelete}
                    className="absolute top-1 right-3 hidden rounded-md border border-slate-200 bg-white p-1 text-slate-400 shadow-sm group-hover:block hover:text-rose-600"
                    aria-label="Delete message"
                >
                    <Icon name="trash" />
                </button>
            )}
        </div>
    );
}

const URL_PATTERN = /(https?:\/\/[^\s<]+)/g;

function Linkified({ text }: { text: string }) {
    // split() with a capture group puts the matched URLs at the odd indexes.
    return text.split(URL_PATTERN).map((part, i) =>
        i % 2 ? (
            <a key={i} href={part} target="_blank" rel="noreferrer" className="break-all text-brand-600 underline hover:text-brand-700">
                {part}
            </a>
        ) : (
            part
        ),
    );
}

function Composer({ placeholder, onSend }: { placeholder: string; onSend: (body: string) => Promise<void> }) {
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();
    const input = useRef<HTMLTextAreaElement>(null);

    // Grow with the text, up to a limit.
    useLayoutEffect(() => {
        const el = input.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [text]);

    const submit = async () => {
        const body = text.trim();
        if (!body || busy) return;
        setBusy(true);
        setError(undefined);
        try {
            await onSend(body);
            setText('');
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
            input.current?.focus();
        }
    };

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
        }
    };

    return (
        <div className="border-t border-slate-200 p-3">
            {error && <ErrorText>{error}</ErrorText>}
            <div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white p-1.5 shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
                <textarea
                    ref={input}
                    rows={1}
                    autoFocus
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={placeholder}
                    maxLength={4000}
                    className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-slate-400"
                />
                <Button onClick={submit} disabled={busy || !text.trim()} aria-label="Send message" className="size-9 !p-0">
                    <Icon name="send" />
                </Button>
            </div>
            <p className="mt-1 hidden px-1 text-[11px] text-slate-400 sm:block">Enter to send · Shift + Enter for a new line</p>
        </div>
    );
}

function UserPicker({ selected, onChange, exclude }: { selected: string[]; onChange: (ids: string[]) => void; exclude: Set<string> }) {
    const { data: users } = useApi<ChatPerson[]>('/chat/users');
    const [q, setQ] = useState('');
    const list = (users ?? []).filter((u) => !exclude.has(u.id) && u.name.toLowerCase().includes(q.trim().toLowerCase()));
    const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

    return (
        <div>
            <input className="input" placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} />
            <ul className="mt-2 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                {!users && <Loading />}
                {users && list.length === 0 && <li className="px-3 py-4 text-center text-sm text-slate-400">No one to add</li>}
                {list.map((u) => (
                    <li key={u.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
                            <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} />
                            <Avatar user={u} size="sm" />
                            <span className="min-w-0 text-sm">
                                <span className="block truncate font-medium text-slate-800">{u.name}</span>
                                <span className="block truncate text-xs text-slate-500">
                                    {ROLE_LABEL[u.role]}
                                    {u.team ? ` · ${u.team.name}` : ''}
                                </span>
                            </span>
                        </label>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function NewChannel({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
    const me = useMe();
    const [form, setForm] = useState({ name: '', description: '', isPrivate: false });
    const [memberIds, setMemberIds] = useState<string[]>([]);
    const [error, setError] = useState<string>();
    const [saving, setSaving] = useState(false);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(undefined);
        try {
            const channel = await api<{ id: string }>('/chat/channels', {
                body: { name: form.name, description: form.description, kind: form.isPrivate ? 'PRIVATE' : 'PUBLIC', memberIds },
            });
            onCreated(channel.id);
        } catch (err) {
            setError(errorMessage(err));
            setSaving(false);
        }
    };

    return (
        <Modal title="Create a channel" onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                <Field label="Name" hint="Lowercase, no spaces — e.g. project-acme">
                    <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-slate-400">#</span>
                        <input className="input pl-7" required autoFocus maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                </Field>
                <Field label="Description (optional)">
                    <input className="input" maxLength={250} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </Field>
                <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-0.5" checked={form.isPrivate} onChange={(e) => setForm({ ...form, isPrivate: e.target.checked })} />
                    <span>
                        <span className="font-medium">Make private</span>
                        <span className="block text-xs text-slate-500">Only people you add can see and join a private channel.</span>
                    </span>
                </label>
                <div>
                    <span className="label">Add people {memberIds.length > 0 && `· ${memberIds.length} selected`}</span>
                    <UserPicker selected={memberIds} onChange={setMemberIds} exclude={new Set([me.id])} />
                </div>
                <ErrorText>{error}</ErrorText>
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                        {saving ? 'Creating…' : 'Create channel'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

function NewDirect({ onClose, onOpened }: { onClose: () => void; onOpened: (id: string) => void }) {
    const me = useMe();
    const { data: users } = useApi<ChatPerson[]>('/chat/users');
    const [q, setQ] = useState('');
    const [error, setError] = useState<string>();
    const list = (users ?? []).filter((u) => u.id !== me.id && u.name.toLowerCase().includes(q.trim().toLowerCase()));

    const start = async (userId: string) => {
        try {
            const channel = await api<{ id: string }>('/chat/direct', { body: { userId } });
            onOpened(channel.id);
        } catch (err) {
            setError(errorMessage(err));
        }
    };

    return (
        <Modal title="New message" onClose={onClose}>
            <div className="space-y-3">
                <div className="relative">
                    <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                    <input className="input pl-9" placeholder="Find a colleague" autoFocus value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <ErrorText>{error}</ErrorText>
                <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                    {!users && <Loading />}
                    {users && list.length === 0 && <li className="px-3 py-4 text-center text-sm text-slate-400">No matches</li>}
                    {list.map((u) => (
                        <li key={u.id}>
                            <button onClick={() => start(u.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-brand-50">
                                <Avatar user={u} size="sm" />
                                <span className="min-w-0 text-sm">
                                    <span className="block truncate font-medium text-slate-800">{u.name}</span>
                                    <span className="block truncate text-xs text-slate-500">
                                        {ROLE_LABEL[u.role]}
                                        {u.team ? ` · ${u.team.name}` : ''}
                                    </span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </Modal>
    );
}

function ChannelSettings({ channel, onClose, onChanged, onGone }: { channel: ChannelDetail; onClose: () => void; onChanged: () => void; onGone: () => void }) {
    const me = useMe();
    const [form, setForm] = useState({ name: channel.name, description: channel.description, isPrivate: channel.kind === 'PRIVATE' });
    const [adding, setAdding] = useState<string[]>([]);
    const [error, setError] = useState<string>();
    const [saved, setSaved] = useState(false);

    const run = async (action: () => Promise<unknown>, after: () => void = onChanged) => {
        setError(undefined);
        setSaved(false);
        try {
            await action();
            after();
        } catch (err) {
            setError(errorMessage(err));
        }
    };

    const save = (e: FormEvent) => {
        e.preventDefault();
        run(
            () => api(`/chat/channels/${channel.id}`, { method: 'PATCH', body: { name: form.name, description: form.description, kind: form.isPrivate ? 'PRIVATE' : 'PUBLIC' } }),
            () => {
                setSaved(true);
                onChanged();
            },
        );
    };

    const addPeople = () =>
        run(
            () => api(`/chat/channels/${channel.id}/members`, { body: { userIds: adding } }),
            () => {
                setAdding([]);
                onChanged();
            },
        );

    const removeMember = (person: ChatPerson) => {
        const self = person.id === me.id;
        if (!confirm(self ? `Leave #${channel.name}?` : `Remove ${person.name} from #${channel.name}?`)) return;
        run(() => api(`/chat/channels/${channel.id}/members/${person.id}`, { method: 'DELETE' }), self && channel.kind === 'PRIVATE' ? onGone : onChanged);
    };

    const deleteChannel = () => {
        if (!confirm(`Delete #${channel.name} and all of its messages? This cannot be undone.`)) return;
        run(() => api(`/chat/channels/${channel.id}`, { method: 'DELETE' }), onGone);
    };

    return (
        <Modal title={`#${channel.name}`} onClose={onClose} wide>
            <div className="space-y-6">
                <ErrorText>{error}</ErrorText>
                {channel.canManage && (
                    <form onSubmit={save} className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Name">
                                <input className="input" required maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                            </Field>
                            <Field label="Description">
                                <input className="input" maxLength={250} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                            </Field>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={form.isPrivate} onChange={(e) => setForm({ ...form, isPrivate: e.target.checked })} />
                            Private channel (only members can see it)
                        </label>
                        <div className="flex items-center gap-3">
                            <Button type="submit" size="sm">
                                Save changes
                            </Button>
                            {saved && <span className="text-sm text-emerald-700">Saved.</span>}
                        </div>
                    </form>
                )}

                <div>
                    <p className="label">Members · {channel.members.length}</p>
                    <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                        {channel.members.map((m) => (
                            <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                                <Avatar user={m} size="sm" />
                                <span className="min-w-0 flex-1 text-sm">
                                    <span className="block truncate font-medium text-slate-800">
                                        {m.name}
                                        {m.id === me.id && <span className="font-normal text-slate-400"> (you)</span>}
                                    </span>
                                    <span className="block text-xs text-slate-500">
                                        {ROLE_LABEL[m.role]}
                                        {m.id === channel.createdById && ' · Channel creator'}
                                    </span>
                                </span>
                                {(m.id === me.id || channel.canManage) && (
                                    <Button variant="ghost" size="sm" onClick={() => removeMember(m)}>
                                        {m.id === me.id ? 'Leave' : 'Remove'}
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>

                {channel.joined && (
                    <div>
                        <p className="label">Add people</p>
                        <UserPicker selected={adding} onChange={setAdding} exclude={new Set(channel.members.map((m) => m.id))} />
                        <Button size="sm" className="mt-2" disabled={adding.length === 0} onClick={addPeople}>
                            <Icon name="plus" /> Add {adding.length > 0 ? adding.length : ''} {adding.length === 1 ? 'person' : 'people'}
                        </Button>
                    </div>
                )}

                {channel.canManage && (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50/50 px-4 py-3">
                        <p className="text-sm text-rose-800">Deleting the channel removes all of its messages.</p>
                        <Button variant="danger" size="sm" onClick={deleteChannel}>
                            Delete channel
                        </Button>
                    </div>
                )}
            </div>
        </Modal>
    );
}
