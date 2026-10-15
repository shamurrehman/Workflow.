import path from 'node:path';

try {
    process.loadEnvFile();
} catch {
    // No .env file — rely on the real environment.
}

function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing environment variable ${name}`);
    return value;
}

export const env = {
    port: Number(process.env.PORT ?? 4000),
    jwtSecret: required('JWT_SECRET'),
    uploadDir: path.resolve(process.env.UPLOAD_DIR ?? 'uploads'),
    smtp: {
        host: process.env.SMTP_HOST ?? '',
        port: Number(process.env.SMTP_PORT ?? 587),
        user: process.env.SMTP_USER ?? '',
        pass: process.env.SMTP_PASS ?? '',
        from: process.env.SMTP_FROM ?? 'TaskFlow <no-reply@taskflow.local>',
    },
};
