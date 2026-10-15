import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { PRIORITY_LABEL, STATUS_LABEL } from '../lib/format';
import type { Priority, TaskStatus } from '../lib/types';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
const VARIANTS: Record<Variant, string> = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
    ghost: 'text-slate-600 hover:bg-slate-100',
};

export function Button({
    variant = 'primary',
    size = 'md',
    className,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
    return (
        <button
            type="button"
            {...props}
            className={cx(
                'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
                size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm',
                VARIANTS[variant],
                className,
            )}
        />
    );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <section className={cx('card', className)}>
            {(title || actions) && (
                <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                    <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
                    {actions}
                </header>
            )}
            {children}
        </section>
    );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
    return (
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
                <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
                {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
    );
}

export function Modal({
    title,
    onClose,
    children,
    wide,
}: {
    title: string;
    onClose: () => void;
    children: ReactNode;
    wide?: boolean;
}) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:py-12" onMouseDown={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={cx('card w-full', wide ? 'max-w-2xl' : 'max-w-lg')}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                    <h2 className="font-semibold text-slate-800">{title}</h2>
                    <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
                        <Icon name="x" />
                    </button>
                </header>
                <div className="p-5">{children}</div>
            </div>
        </div>
    );
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
    return (
        <label className={cx('block', className)}>
            <span className="label">{label}</span>
            {children}
            {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
        </label>
    );
}

export function ErrorText({ children }: { children?: ReactNode }) {
    if (!children) return null;
    return <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{children}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
    return <p className="px-4 py-8 text-center text-sm text-slate-400">{children}</p>;
}

export function Loading() {
    return <p className="px-4 py-8 text-center text-sm text-slate-400">Loading…</p>;
}

const STATUS_STYLE: Record<TaskStatus, string> = {
    NEW: 'bg-sky-50 text-sky-700 ring-sky-200',
    IN_PROGRESS: 'bg-amber-50 text-amber-700 ring-amber-200',
    BLOCKED: 'bg-rose-50 text-rose-700 ring-rose-200',
    COMPLETED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

export function StatusBadge({ status }: { status: TaskStatus }) {
    return <Badge className={STATUS_STYLE[status]}>{STATUS_LABEL[status]}</Badge>;
}

const PRIORITY_STYLE: Record<Priority, string> = {
    LOW: 'bg-slate-50 text-slate-500 ring-slate-200',
    MEDIUM: 'bg-slate-50 text-slate-600 ring-slate-200',
    HIGH: 'bg-orange-50 text-orange-700 ring-orange-200',
    URGENT: 'bg-red-600 text-white ring-red-600',
};

export function PriorityBadge({ priority }: { priority: Priority }) {
    return <Badge className={PRIORITY_STYLE[priority]}>{PRIORITY_LABEL[priority]}</Badge>;
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset', className ?? 'bg-slate-50 text-slate-600 ring-slate-200')}>
            {children}
        </span>
    );
}

export function Stat({ label, value, tone = 'slate' }: { label: string; value: ReactNode; tone?: 'slate' | 'sky' | 'amber' | 'rose' | 'emerald' | 'brand' }) {
    const tones = {
        slate: 'text-slate-900',
        sky: 'text-sky-700',
        amber: 'text-amber-700',
        rose: 'text-rose-700',
        emerald: 'text-emerald-700',
        brand: 'text-brand-600',
    };
    return (
        <div className="card px-4 py-3">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className={cx('mt-1 text-2xl font-semibold tabular-nums', tones[tone])}>{value}</p>
        </div>
    );
}

const ICONS: Record<string, ReactNode> = {
    home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
    tasks: <path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />,
    calendar: <path d="M4 6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 10h16M8 3v4M16 3v4" />,
    users: <path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8" />,
    team: <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />,
    briefcase: <path d="M3 8a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM8 7V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M3 13h18" />,
    history: <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3" />,
    report: <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h6" />,
    user: <path d="M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
    bell: <path d="M18 16V11a6 6 0 1 0-12 0v5l-2 2h16zM10 21h4" />,
    logout: <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3" />,
    plus: <path d="M12 5v14M5 12h14" />,
    x: <path d="M6 6l12 12M18 6 6 18" />,
    play: <path d="M7 4v16l13-8z" />,
    pause: <path d="M7 4h4v16H7zM13 4h4v16h-4z" />,
    check: <path d="M5 12.5l4.5 4.5L19 7" />,
    alert: <path d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />,
    paperclip: <path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7" />,
    download: <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />,
    repeat: <path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    chevronLeft: <path d="M15 18l-6-6 6-6" />,
    chevronRight: <path d="M9 18l6-6-6-6" />,
    edit: <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />,
    trash: <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4h6v3" />,
    clock: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" />,
    chat: <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4z" />,
    hash: <path d="M5 9h15M4 15h15M10 3 8 21M16 3l-2 18" />,
    lock: <path d="M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V7a4 4 0 0 1 8 0v4" />,
    send: <path d="M21 3 10 14M21 3l-7 18-4-7-7-4z" />,
    camera: <path d="M4 8a1 1 0 0 1 1-1h3l2-3h4l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
    search: <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />,
};

export function Icon({ name, className }: { name: keyof typeof ICONS | string; className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cx('size-4 shrink-0', className)}
            aria-hidden="true"
        >
            {ICONS[name]}
        </svg>
    );
}

const AVATAR_SIZE = {
    xs: 'size-5 text-[9px]',
    sm: 'size-7 text-[11px]',
    md: 'size-9 text-xs',
    lg: 'size-12 text-base',
    xl: 'size-24 text-3xl',
};
const AVATAR_COLORS = ['bg-brand-600', 'bg-accent-600', 'bg-emerald-600', 'bg-amber-600', 'bg-violet-600', 'bg-sky-600', 'bg-teal-600', 'bg-brand-800'];

const initials = (name: string) =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]!.toUpperCase())
        .join('');

/** Profile picture, or the person's initials on a colour derived from their name. */
export function Avatar({
    user,
    size = 'md',
    className,
}: {
    user: { name: string; avatarUrl?: string | null };
    size?: keyof typeof AVATAR_SIZE;
    className?: string;
}) {
    const base = cx('inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold select-none', AVATAR_SIZE[size], className);
    if (user.avatarUrl) return <img src={user.avatarUrl} alt="" className={cx(base, 'object-cover')} />;
    const hash = [...user.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
    return (
        <span className={cx(base, 'text-white', AVATAR_COLORS[hash % AVATAR_COLORS.length])} aria-hidden="true">
            {initials(user.name) || '?'}
        </span>
    );
}

/** Readable message from anything thrown by an API call. */
export function errorMessage(err: unknown) {
    return err instanceof Error ? err.message : 'Something went wrong';
}

export { cx };
