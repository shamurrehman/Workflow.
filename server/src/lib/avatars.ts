import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { env } from '../env.js';
import { badRequest } from '../http.js';

/** Profile pictures live in <UPLOAD_DIR>/avatars and are served publicly under random, unguessable names. */
export const avatarDir = path.join(env.uploadDir, 'avatars');
export const AVATAR_URL_PREFIX = '/api/avatars/';

fs.mkdirSync(avatarDir, { recursive: true });

const IMAGE_TYPES: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
};

export const avatarUpload = multer({
    storage: multer.diskStorage({
        destination: avatarDir,
        filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${IMAGE_TYPES[file.mimetype]}`),
    }),
    limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
        if (IMAGE_TYPES[file.mimetype]) cb(null, true);
        else cb(badRequest('Profile pictures must be PNG, JPEG, WebP or GIF images'));
    },
});

/** Deletes the file behind an avatar URL; ignores URLs that are not ours. */
export function removeAvatarFile(url: string | null | undefined) {
    if (!url?.startsWith(AVATAR_URL_PREFIX)) return;
    fs.rm(path.join(avatarDir, path.basename(url)), { force: true }, () => {});
}
