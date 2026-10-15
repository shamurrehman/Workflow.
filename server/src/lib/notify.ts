import nodemailer from 'nodemailer';
import { db } from '../db.js';
import { env } from '../env.js';

const mailer = env.smtp.host
    ? nodemailer.createTransport({
          host: env.smtp.host,
          port: env.smtp.port,
          auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
      })
    : null;

/** In-app notification for each user, plus an email when SMTP is configured (unless `email: false`). */
export async function notify(userIds: string[], title: string, body = '', link?: string, { email = true }: { email?: boolean } = {}) {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return;
    await db.notification.createMany({ data: unique.map((userId) => ({ userId, title, body, link })) });

    if (!mailer || !email) return;
    const users = await db.user.findMany({ where: { id: { in: unique }, active: true }, select: { email: true } });
    await Promise.allSettled(
        users.map((u) => mailer.sendMail({ from: env.smtp.from, to: u.email, subject: title, text: body })),
    );
}
