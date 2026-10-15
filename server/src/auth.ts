import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { env } from './env.js';
import { forbidden, HttpError } from './http.js';

export const ROLES = ['ADMIN', 'MANAGER', 'TEAM_LEAD', 'EMPLOYEE'] as const;
export type Role = (typeof ROLES)[number];

export interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: Role;
    teamId: string | null;
    avatarUrl: string | null;
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            user: AuthUser;
        }
    }
}

export function signToken(userId: string) {
    return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: '7d' });
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new HttpError(401, 'Not signed in');

    let sub: string;
    try {
        sub = (jwt.verify(token, env.jwtSecret) as { sub: string }).sub;
    } catch {
        throw new HttpError(401, 'Session expired, please sign in again');
    }

    const user = await db.user.findUnique({ where: { id: sub } });
    if (!user || !user.active) throw new HttpError(401, 'Account is disabled');
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role as Role, teamId: user.teamId, avatarUrl: user.avatarUrl };
    next();
}

export function requireRole(...roles: Role[]) {
    return (req: Request, _res: Response, next: NextFunction) => {
        if (!roles.includes(req.user.role)) throw forbidden();
        next();
    };
}
