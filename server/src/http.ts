import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { ZodError, type z, type ZodTypeAny } from 'zod';

export class HttpError extends Error {
    constructor(
        public status: number,
        message: string,
    ) {
        super(message);
    }
}

export const badRequest = (msg: string) => new HttpError(400, msg);
export const forbidden = (msg = 'You do not have access to this resource') => new HttpError(403, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
    return schema.parse(data);
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
    if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
        return;
    }
    if (err instanceof MulterError) {
        res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'The file is too large' : err.message });
        return;
    }
    if (err instanceof ZodError) {
        const first = err.issues[0];
        res.status(400).json({ error: `${first.path.join('.') || 'input'}: ${first.message}` });
        return;
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
}
