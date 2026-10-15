import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import type { AuthUser } from '../auth.js';
import { db } from '../db.js';
import { parse } from '../http.js';
import { visibleUserIds } from '../lib/scope.js';

export const activityRouter = Router();

/** Activity a person may see: everything for admins, otherwise actions by or on tasks of people in their scope. */
export async function activityScope(user: AuthUser): Promise<Prisma.ActivityWhereInput> {
    const ids = await visibleUserIds(user);
    if (!ids) return {};
    return { OR: [{ actorId: { in: ids } }, { task: { assigneeId: { in: ids } } }] };
}

activityRouter.get('/', async (req, res) => {
    const f = parse(
        z.object({ userId: z.string().optional(), from: z.string().optional(), to: z.string().optional() }),
        req.query,
    );
    const items = await db.activity.findMany({
        where: {
            AND: [
                await activityScope(req.user),
                f.userId ? { OR: [{ actorId: f.userId }, { task: { assigneeId: f.userId } }] } : {},
                f.from ? { createdAt: { gte: new Date(f.from) } } : {},
                f.to ? { createdAt: { lte: new Date(`${f.to}T23:59:59`) } } : {},
            ],
        },
        include: { actor: { select: { id: true, name: true } }, task: { select: { id: true, title: true } } },
        orderBy: { createdAt: 'desc' },
        take: 300,
    });
    res.json(items);
});
