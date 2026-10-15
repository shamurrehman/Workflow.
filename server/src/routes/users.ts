import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { requireRole, ROLES } from '../auth.js';
import { db } from '../db.js';
import { badRequest, parse } from '../http.js';
import { logActivity } from '../lib/activity.js';
import { notify } from '../lib/notify.js';
import { assignableUsers, visibleUserIds } from '../lib/scope.js';
import { joinDefaultChannel } from './chat.js';

export const usersRouter = Router();

const publicUser = {
    id: true,
    name: true,
    email: true,
    role: true,
    active: true,
    teamId: true,
    avatarUrl: true,
    createdAt: true,
    team: { select: { id: true, name: true } },
} as const;

usersRouter.get('/', async (req, res) => {
    const ids = await visibleUserIds(req.user);
    const users = await db.user.findMany({
        where: ids ? { id: { in: ids } } : {},
        select: publicUser,
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    res.json(users);
});

usersRouter.get('/assignable', async (req, res) => {
    res.json(await assignableUsers(req.user));
});

const userInput = z.object({
    name: z.string().trim().min(1),
    email: z.string().trim().email(),
    role: z.enum(ROLES),
    teamId: z.string().nullable().optional(),
    active: z.boolean().optional(),
});

usersRouter.post('/', requireRole('ADMIN'), async (req, res) => {
    const data = parse(userInput.extend({ password: z.string().min(8) }), req.body);
    const email = data.email.toLowerCase();
    if (await db.user.findUnique({ where: { email } })) throw badRequest('A user with this email already exists');
    const user = await db.user.create({
        data: {
            name: data.name,
            email,
            role: data.role,
            teamId: data.teamId || null,
            passwordHash: await bcrypt.hash(data.password, 10),
        },
        select: publicUser,
    });
    await joinDefaultChannel(user.id);
    await logActivity(req.user.id, 'user.created', `${req.user.name} created ${data.role.toLowerCase()} ${user.name}`, null, { subjectId: user.id });
    res.status(201).json(user);
});

usersRouter.patch('/:id', requireRole('ADMIN'), async (req, res) => {
    const data = parse(userInput.partial(), req.body);
    if (String(req.params.id) === req.user.id && (data.role && data.role !== 'ADMIN')) {
        throw badRequest('You cannot remove your own admin role');
    }
    if (String(req.params.id) === req.user.id && data.active === false) throw badRequest('You cannot disable your own account');
    if (data.email) {
        data.email = data.email.toLowerCase();
        const clash = await db.user.findFirst({ where: { email: data.email, id: { not: String(req.params.id) } } });
        if (clash) throw badRequest('A user with this email already exists');
    }
    const user = await db.user.update({
        where: { id: String(req.params.id) },
        data: { ...data, teamId: data.teamId === undefined ? undefined : data.teamId || null },
        select: publicUser,
    });
    const changes = [
        data.role && `role ${data.role.toLowerCase().replace('_', ' ')}`,
        data.active === false && 'disabled the account',
        data.active === true && 'enabled the account',
        data.teamId !== undefined && `team ${user.team?.name ?? 'none'}`,
    ].filter(Boolean);
    await logActivity(
        req.user.id,
        'user.updated',
        `${req.user.name} updated ${user.name}${changes.length ? ` (${changes.join(', ')})` : ''}`,
        null,
        { subjectId: user.id },
    );
    res.json(user);
});

usersRouter.post('/:id/reset-password', requireRole('ADMIN'), async (req, res) => {
    const { password } = parse(z.object({ password: z.string().min(8) }), req.body);
    const user = await db.user.update({
        where: { id: String(req.params.id) },
        data: { passwordHash: await bcrypt.hash(password, 10) },
    });
    await logActivity(req.user.id, 'user.password_reset', `${req.user.name} reset the password of ${user.name}`, null, {
        subjectId: user.id,
        notified: [user.id],
    });
    await notify([user.id], 'Your password was reset', 'An administrator reset your password.');
    res.json({ ok: true });
});
