import { db } from '../db.js';
import { notify } from './notify.js';

/** Bell titles for the oversight alerts; anything unlisted falls back to "Activity". */
const ALERT_TITLE: Record<string, string> = {
    'task.assigned': 'Task assigned',
    'task.reassigned': 'Task reassigned',
    'task.updated': 'Task updated',
    'task.deleted': 'Task deleted',
    'task.started': 'Task started',
    'task.paused': 'Timer paused',
    'task.completed': 'Task completed',
    'task.reopened': 'Task reopened',
    'task.attachment': 'File attached',
    'issue.reported': 'Issue reported',
    'issue.resolved': 'Issue resolved',
    'user.created': 'User created',
    'user.updated': 'User updated',
    'user.password_reset': 'Password reset',
    'user.password_changed': 'Password changed',
    'team.created': 'Team created',
    'team.updated': 'Team updated',
    'client.created': 'Client created',
    'project.created': 'Project created',
    'schedule.created': 'Schedule created',
    'schedule.deleted': 'Schedule removed',
};

interface ActivityOptions {
    /** The user the event is about, when it isn't the actor (e.g. whose password was reset). */
    subjectId?: string | null;
    /** People who already received a specific notification for this event; they are not alerted twice. */
    notified?: string[];
}

/**
 * Records an event in the work history and alerts the people who oversee it:
 * every admin, plus the managers of the teams involved (the actor's, the subject's and the task assignee's).
 * The actor is never alerted about their own action.
 */
export async function logActivity(actorId: string | null, action: string, message: string, taskId?: string | null, options: ActivityOptions = {}) {
    const activity = await db.activity.create({ data: { actorId, action, message, taskId: taskId ?? null } });
    try {
        const skip = new Set([actorId, ...(options.notified ?? [])]);
        const recipients = (await watchers(actorId, taskId, options.subjectId)).filter((id) => !skip.has(id));
        // In-app only: emailing admins about every timer start would bury real email.
        await notify(recipients, ALERT_TITLE[action] ?? 'Activity', message, taskId ? `/tasks/${taskId}` : '/activity', { email: false });
    } catch (err) {
        console.error('Could not send activity alerts', err);
    }
    return activity;
}

async function watchers(actorId: string | null, taskId?: string | null, subjectId?: string | null) {
    const task = taskId ? await db.task.findUnique({ where: { id: taskId }, select: { assigneeId: true, teamId: true } }) : null;
    const people = [actorId, subjectId, task?.assigneeId].filter((id): id is string => !!id);
    const users = people.length ? await db.user.findMany({ where: { id: { in: people } }, select: { teamId: true } }) : [];
    const teamIds = [...users.map((u) => u.teamId), task?.teamId].filter((id): id is string => !!id);

    const [admins, teams] = await Promise.all([
        db.user.findMany({ where: { role: 'ADMIN', active: true }, select: { id: true } }),
        teamIds.length
            ? db.team.findMany({ where: { id: { in: teamIds }, manager: { active: true } }, select: { managerId: true } })
            : Promise.resolve([]),
    ]);
    return [...admins.map((a) => a.id), ...teams.map((t) => t.managerId)].filter((id): id is string => !!id);
}
