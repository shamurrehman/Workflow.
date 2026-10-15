import { Router } from 'express';
import { z } from 'zod';
import type { AuthUser } from '../auth.js';
import { db } from '../db.js';
import { badRequest, forbidden, notFound, parse } from '../http.js';

export const chatRouter = Router();

const DEFAULT_CHANNEL = 'general';
const PAGE_SIZE = 50;

const person = { id: true, name: true, role: true, avatarUrl: true } as const;

type ChannelRow = { id: string; kind: string; createdById: string | null };

/** Channel names look like Slack's: lowercase, no spaces. */
function channelName(raw: string) {
    const name = raw
        .trim()
        .toLowerCase()
        .replace(/^#/, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9_-]/g, '');
    if (!name) throw badRequest('Channel names can use letters, numbers, - and _');
    if (name.length > 40) throw badRequest('Channel names are limited to 40 characters');
    return name;
}

async function assertNameFree(name: string, exceptId?: string) {
    const clash = await db.channel.findFirst({ where: { name, kind: { not: 'DIRECT' }, id: exceptId ? { not: exceptId } : undefined } });
    if (clash) throw badRequest(`#${name} already exists`);
}

const isMember = async (channelId: string, userId: string) =>
    !!(await db.channelMember.findUnique({ where: { channelId_userId: { channelId, userId } } }));

/** Public channels are readable by everyone; private channels and direct messages only by members. */
async function getReadableChannel(user: AuthUser, id: string) {
    const channel = await db.channel.findUnique({ where: { id } });
    if (!channel) throw notFound('Channel not found');
    if (channel.kind !== 'PUBLIC' && !(await isMember(channel.id, user.id))) throw notFound('Channel not found');
    return channel;
}

const canManage = (user: AuthUser, channel: ChannelRow) =>
    channel.kind !== 'DIRECT' && (user.role === 'ADMIN' || channel.createdById === user.id);

/** Unread counts for the user's memberships, keyed by channel id. Own messages never count as unread. */
async function unreadByChannel(userId: string) {
    const memberships = await db.channelMember.findMany({ where: { userId }, select: { channelId: true, lastReadAt: true } });
    const counts = await Promise.all(
        memberships.map((m) =>
            db.message.count({ where: { channelId: m.channelId, createdAt: { gt: m.lastReadAt }, authorId: { not: userId } } }),
        ),
    );
    return new Map(memberships.map((m, i) => [m.channelId, counts[i]]));
}

/** Creates #general (with every active user) the first time the API starts on a database without channels. */
export async function ensureDefaultChannel() {
    if (await db.channel.count({ where: { kind: { not: 'DIRECT' } } })) return;
    const users = await db.user.findMany({ where: { active: true }, select: { id: true } });
    await db.channel.create({
        data: {
            name: DEFAULT_CHANNEL,
            description: 'Company-wide announcements and conversation',
            kind: 'PUBLIC',
            members: { create: users.map((u) => ({ userId: u.id })) },
        },
    });
}

/** New accounts join #general so they see its unread messages straight away. */
export async function joinDefaultChannel(userId: string) {
    const general = await db.channel.findFirst({ where: { name: DEFAULT_CHANNEL, kind: 'PUBLIC' } });
    if (!general) return;
    await db.channelMember.upsert({
        where: { channelId_userId: { channelId: general.id, userId } },
        create: { channelId: general.id, userId },
        update: {},
    });
}

chatRouter.get('/channels', async (req, res) => {
    const me = req.user.id;
    const [channels, unread] = await Promise.all([
        db.channel.findMany({
            where: { OR: [{ kind: 'PUBLIC' }, { members: { some: { userId: me } } }] },
            include: {
                _count: { select: { members: true } },
                // For direct messages: the other person. For everything else: only used to check membership.
                members: { select: { userId: true, user: { select: person } } },
            },
            orderBy: { lastMessageAt: 'desc' },
        }),
        unreadByChannel(me),
    ]);
    res.json(
        channels.map(({ members, _count, ...c }) => ({
            ...c,
            memberCount: _count.members,
            joined: unread.has(c.id),
            unread: unread.get(c.id) ?? 0,
            other: c.kind === 'DIRECT' ? (members.find((m) => m.userId !== me)?.user ?? members[0]?.user ?? null) : undefined,
        })),
    );
});

chatRouter.get('/unread', async (req, res) => {
    const unread = await unreadByChannel(req.user.id);
    res.json({ unread: [...unread.values()].reduce((a, b) => a + b, 0) });
});

/** Everyone you can message or add to a channel. */
chatRouter.get('/users', async (_req, res) => {
    const users = await db.user.findMany({
        where: { active: true },
        select: { ...person, team: { select: { name: true } } },
        orderBy: { name: 'asc' },
    });
    res.json(users);
});

const channelInput = z.object({
    name: z.string().min(1),
    description: z.string().max(250).optional(),
    kind: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
    memberIds: z.array(z.string()).optional(),
});

chatRouter.post('/channels', async (req, res) => {
    const data = parse(channelInput, req.body);
    const name = channelName(data.name);
    await assertNameFree(name);
    const others = data.memberIds?.length
        ? await db.user.findMany({ where: { id: { in: data.memberIds }, active: true }, select: { id: true } })
        : [];
    const memberIds = new Set([req.user.id, ...others.map((u) => u.id)]);
    const channel = await db.channel.create({
        data: {
            name,
            description: data.description?.trim() ?? '',
            kind: data.kind,
            createdById: req.user.id,
            members: { create: [...memberIds].map((userId) => ({ userId })) },
        },
    });
    res.status(201).json(channel);
});

/** Opens (or creates) the one-to-one conversation with another user. */
chatRouter.post('/direct', async (req, res) => {
    const { userId } = parse(z.object({ userId: z.string() }), req.body);
    const other = await db.user.findFirst({ where: { id: userId, active: true } });
    if (!other) throw notFound('User not found');
    const ids = [...new Set([req.user.id, other.id])].sort();
    const dmKey = ids.join(':');
    const channel =
        (await db.channel.findUnique({ where: { dmKey } })) ??
        (await db.channel.create({
            data: { name: '', kind: 'DIRECT', dmKey, createdById: req.user.id, members: { create: ids.map((id) => ({ userId: id })) } },
        }));
    res.json(channel);
});

chatRouter.get('/channels/:id', async (req, res) => {
    const channel = await getReadableChannel(req.user, req.params.id);
    const members = await db.channelMember.findMany({
        where: { channelId: channel.id },
        select: { user: { select: person } },
        orderBy: { user: { name: 'asc' } },
    });
    res.json({
        ...channel,
        members: members.map((m) => m.user),
        joined: members.some((m) => m.user.id === req.user.id),
        canManage: canManage(req.user, channel),
    });
});

chatRouter.patch('/channels/:id', async (req, res) => {
    const channel = await getReadableChannel(req.user, req.params.id);
    if (!canManage(req.user, channel)) throw forbidden('Only the channel creator or an admin can edit this channel');
    const data = parse(channelInput.pick({ name: true, description: true, kind: true }).partial(), req.body);
    const name = data.name === undefined ? undefined : channelName(data.name);
    if (name) await assertNameFree(name, channel.id);
    const updated = await db.channel.update({
        where: { id: channel.id },
        data: { name, description: data.description?.trim(), kind: data.kind },
    });
    res.json(updated);
});

chatRouter.delete('/channels/:id', async (req, res) => {
    const channel = await getReadableChannel(req.user, req.params.id);
    if (!canManage(req.user, channel)) throw forbidden('Only the channel creator or an admin can delete this channel');
    await db.channel.delete({ where: { id: channel.id } });
    res.json({ ok: true });
});

chatRouter.post('/channels/:id/join', async (req, res) => {
    const channel = await getReadableChannel(req.user, req.params.id);
    if (channel.kind !== 'PUBLIC') throw forbidden('Ask a member to add you to this channel');
    await db.channelMember.upsert({
        where: { channelId_userId: { channelId: channel.id, userId: req.user.id } },
        create: { channelId: channel.id, userId: req.user.id },
        update: {},
    });
    res.json({ ok: true });
});

chatRouter.post('/channels/:id/members', async (req, res) => {
    const channel = await getReadableChannel(req.user, req.params.id);
    if (channel.kind === 'DIRECT') throw badRequest('Direct messages are between two people');
    if (!(await isMember(channel.id, req.user.id))) throw forbidden('Join the channel before adding people');
    const { userIds } = parse(z.object({ userIds: z.array(z.string()).min(1) }), req.body);
    const users = await db.user.findMany({ where: { id: { in: userIds }, active: true }, select: { id: true } });
    await db.$transaction(
        users.map((u) =>
            db.channelMember.upsert({
                where: { channelId_userId: { channelId: channel.id, userId: u.id } },
                create: { channelId: channel.id, userId: u.id },
                update: {},
            }),
        ),
    );
    res.json({ ok: true });
});

/** Leave a channel yourself, or (creator/admin) remove someone else. */
chatRouter.delete('/channels/:id/members/:userId', async (req, res) => {
    const channel = await getReadableChannel(req.user, req.params.id);
    if (channel.kind === 'DIRECT') throw badRequest('You cannot leave a direct message');
    if (req.params.userId !== req.user.id && !canManage(req.user, channel)) {
        throw forbidden('Only the channel creator or an admin can remove members');
    }
    await db.channelMember.deleteMany({ where: { channelId: channel.id, userId: req.params.userId } });
    res.json({ ok: true });
});

/**
 * Newest page by default; `before` (message id) pages back through history,
 * `after` (ISO time) returns everything since the last poll, inclusive — clients drop ids they already have.
 */
chatRouter.get('/channels/:id/messages', async (req, res) => {
    const channel = await getReadableChannel(req.user, req.params.id);
    const { before, after } = parse(z.object({ before: z.string().optional(), after: z.string().datetime().optional() }), req.query);
    const include = { author: { select: person } } as const;

    if (after) {
        const items = await db.message.findMany({
            where: { channelId: channel.id, createdAt: { gte: new Date(after) } },
            include,
            orderBy: { createdAt: 'asc' },
            take: 200,
        });
        return void res.json({ items, hasMore: false });
    }

    const cursor = before ? await db.message.findFirst({ where: { id: before, channelId: channel.id } }) : null;
    const page = await db.message.findMany({
        where: { channelId: channel.id, ...(cursor ? { createdAt: { lt: cursor.createdAt } } : {}) },
        include,
        orderBy: { createdAt: 'desc' },
        take: PAGE_SIZE + 1,
    });
    res.json({ items: page.slice(0, PAGE_SIZE).reverse(), hasMore: page.length > PAGE_SIZE });
});

chatRouter.post('/channels/:id/messages', async (req, res) => {
    const channel = await getReadableChannel(req.user, req.params.id);
    const { body } = parse(z.object({ body: z.string().trim().min(1).max(4000) }), req.body);
    const now = new Date();
    // Posting in a public channel joins it.
    const [message] = await db.$transaction([
        db.message.create({ data: { body, channelId: channel.id, authorId: req.user.id, createdAt: now }, include: { author: { select: person } } }),
        db.channel.update({ where: { id: channel.id }, data: { lastMessageAt: now } }),
        db.channelMember.upsert({
            where: { channelId_userId: { channelId: channel.id, userId: req.user.id } },
            create: { channelId: channel.id, userId: req.user.id, lastReadAt: now },
            update: { lastReadAt: now },
        }),
    ]);
    res.status(201).json(message);
});

chatRouter.post('/channels/:id/read', async (req, res) => {
    await db.channelMember.updateMany({
        where: { channelId: req.params.id, userId: req.user.id },
        data: { lastReadAt: new Date() },
    });
    res.json({ ok: true });
});

chatRouter.delete('/messages/:id', async (req, res) => {
    const message = await db.message.findUnique({ where: { id: req.params.id } });
    if (!message) throw notFound('Message not found');
    if (message.authorId !== req.user.id && req.user.role !== 'ADMIN') throw forbidden('You can only delete your own messages');
    await db.message.delete({ where: { id: message.id } });
    res.json({ ok: true });
});
