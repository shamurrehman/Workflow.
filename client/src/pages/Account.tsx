import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Avatar, Button, Card, ErrorText, errorMessage, Field, Icon, PageHeader } from '../components/ui';
import { api, uploadAvatar } from '../lib/api';
import { useAuth, useMe } from '../lib/auth';
import { ROLE_LABEL } from '../lib/format';

export function AccountPage() {
    const me = useMe();
    const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
    const [error, setError] = useState<string>();
    const [saved, setSaved] = useState(false);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setError(undefined);
        setSaved(false);
        if (form.newPassword !== form.confirm) return setError('The new passwords do not match');
        try {
            await api('/auth/change-password', { body: { currentPassword: form.currentPassword, newPassword: form.newPassword } });
            setForm({ currentPassword: '', newPassword: '', confirm: '' });
            setSaved(true);
        } catch (err) {
            setError(errorMessage(err));
        }
    };

    return (
        <>
            <PageHeader title="My account" />
            <div className="grid max-w-3xl gap-6 md:grid-cols-2">
                <Card title="Profile">
                    <ProfilePicture />
                    <dl className="space-y-3 border-t border-slate-100 p-4 text-sm">
                        <div>
                            <dt className="label">Name</dt>
                            <dd>{me.name}</dd>
                        </div>
                        <div>
                            <dt className="label">Email</dt>
                            <dd>{me.email}</dd>
                        </div>
                        <div>
                            <dt className="label">Role</dt>
                            <dd>{ROLE_LABEL[me.role]}</dd>
                        </div>
                        <div>
                            <dt className="label">Team</dt>
                            <dd>{me.team?.name ?? '—'}</dd>
                        </div>
                    </dl>
                </Card>
                <Card title="Change password">
                    <form onSubmit={submit} className="space-y-3 p-4">
                        <Field label="Current password">
                            <input className="input" type="password" required autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
                        </Field>
                        <Field label="New password" hint="At least 8 characters">
                            <input className="input" type="password" required minLength={8} autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
                        </Field>
                        <Field label="Confirm new password">
                            <input className="input" type="password" required autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
                        </Field>
                        <ErrorText>{error}</ErrorText>
                        {saved && <p className="text-sm text-emerald-700">Password updated.</p>}
                        <Button type="submit">Update password</Button>
                    </form>
                </Card>
            </div>
        </>
    );
}

function ProfilePicture() {
    const me = useMe();
    const { updateMe } = useAuth();
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();

    const run = async (action: () => Promise<{ avatarUrl: string | null }>) => {
        setBusy(true);
        setError(undefined);
        try {
            updateMe(await action());
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const onPick = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) run(() => uploadAvatar(file));
    };

    return (
        <div className="flex items-center gap-4 p-4">
            <Avatar user={me} size="xl" />
            <div className="space-y-2">
                <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onPick} />
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={busy} onClick={() => input.current?.click()}>
                        <Icon name="camera" /> {me.avatarUrl ? 'Change photo' : 'Upload photo'}
                    </Button>
                    {me.avatarUrl && (
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => api('/auth/avatar', { method: 'DELETE' }))}>
                            Remove
                        </Button>
                    )}
                </div>
                <p className="text-xs text-slate-400">PNG, JPEG, WebP or GIF, up to 2 MB.</p>
                <ErrorText>{error}</ErrorText>
            </div>
        </div>
    );
}
