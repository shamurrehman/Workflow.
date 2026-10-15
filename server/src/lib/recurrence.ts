export interface RecurrenceRule {
    startAt: Date;
    frequency: string; // ONCE | DAILY | WEEKLY | MONTHLY
    interval: number;
    weekdays: string; // "1,3,5", 0 = Sunday
    endAt: Date | null;
}

const DAY = 24 * 60 * 60 * 1000;

export function parseWeekdays(value: string) {
    return value
        .split(',')
        .filter((d) => d.trim() !== '')
        .map((d) => Number(d.trim()))
        .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
}

function addDays(date: Date, days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days); // calendar days, so the time of day survives DST changes
    return d;
}

function addMonths(date: Date, months: number, dayOfMonth: number) {
    const d = new Date(date);
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(dayOfMonth, lastDay));
    return d;
}

function withinEnd(rule: RecurrenceRule, d: Date | null) {
    if (!d) return null;
    return rule.endAt && d > rule.endAt ? null : d;
}

/** First occurrence at or after the rule's start. */
export function firstOccurrence(rule: RecurrenceRule): Date | null {
    const weekdays = parseWeekdays(rule.weekdays);
    if (rule.frequency === 'WEEKLY' && weekdays.length > 0) {
        for (let i = 0; i < 7; i++) {
            const d = addDays(rule.startAt, i);
            if (weekdays.includes(d.getDay())) return withinEnd(rule, d);
        }
    }
    return withinEnd(rule, new Date(rule.startAt));
}

/** The occurrence that follows `prev`, or null when the rule has ended. */
export function nextOccurrence(rule: RecurrenceRule, prev: Date): Date | null {
    const n = Math.max(1, rule.interval);
    switch (rule.frequency) {
        case 'DAILY':
            return withinEnd(rule, addDays(prev, n));
        case 'WEEKLY': {
            const weekdays = parseWeekdays(rule.weekdays);
            if (weekdays.length === 0) return withinEnd(rule, addDays(prev, n * 7));
            for (let i = 1; i <= 7; i++) {
                const d = addDays(prev, i);
                if (weekdays.includes(d.getDay())) {
                    // Wrapping into the next week with interval > 1 skips the in-between weeks.
                    const wrapped = d.getDay() <= prev.getDay();
                    return withinEnd(rule, wrapped ? addDays(d, (n - 1) * 7) : d);
                }
            }
            return null;
        }
        case 'MONTHLY':
            return withinEnd(rule, addMonths(prev, n, rule.startAt.getDate()));
        default:
            return null;
    }
}

/** Every occurrence inside [from, to], capped so a broad range cannot explode. */
export function occurrencesBetween(rule: RecurrenceRule, from: Date, to: Date, cap = 500): Date[] {
    const out: Date[] = [];
    let d = firstOccurrence(rule);
    let guard = 0;
    while (d && d <= to && out.length < cap && guard++ < 5000) {
        if (d >= from) out.push(d);
        d = nextOccurrence(rule, d);
    }
    return out;
}

export function describeRule(rule: RecurrenceRule) {
    const n = Math.max(1, rule.interval);
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    switch (rule.frequency) {
        case 'DAILY':
            return n === 1 ? 'Every day' : `Every ${n} days`;
        case 'WEEKLY': {
            const days = parseWeekdays(rule.weekdays).map((d) => names[d]);
            const base = n === 1 ? 'Every week' : `Every ${n} weeks`;
            return days.length ? `${base} on ${days.join(', ')}` : base;
        }
        case 'MONTHLY':
            return `${n === 1 ? 'Every month' : `Every ${n} months`} on day ${rule.startAt.getDate()}`;
        default:
            return 'One time';
    }
}
