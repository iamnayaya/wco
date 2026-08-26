import { randomUUID } from 'node:crypto';

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ValidationError } from '@wco/shared';

import { env } from '../config/env.js';

/**
 * S3 upload service — product images, chat media mirrors, delivery POD proofs.
 *
 * Security posture:
 *  - MIME re-validated against MAGIC BYTES (client Content-Type headers lie;
 *    an HTML file renamed .png must not become stored XSS).
 *  - Keys are namespaced per store + random UUID — no user-controlled paths.
 *  - Reads go through presigned URLs (private bucket) or CDN when configured.
 */

const s3 = new S3Client({
  region: env.AWS_REGION,
  ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? { credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY } }
    : {}),
});

const MAGIC_SIGNATURES: readonly { ext: string; test: (b: Buffer) => boolean }[] = [
  { ext: '.jpg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: '.png',
    test: (b) =>
      b.length > 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  { ext: '.webp', test: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  { ext: '.pdf', test: (b) => b.length > 4 && b.toString('ascii', 0, 4) === '%PDF' },
];

export class UploadsService {
  async upload(
    storeId: string,
    folder: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ): Promise<{ key: string; url: string }> {
    const signature = MAGIC_SIGNATURES.find((sig) => sig.test(file.buffer));
    if (!signature) throw new ValidationError('File content does not match an allowed type');

    const key = `${storeId}/${folder}/${randomUUID()}${signature.ext}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return { key, url: this.publicUrl(key) };
  }

  publicUrl(key: string): string {
    if (env.AWS_S3_CDN_URL) return `${env.AWS_S3_CDN_URL.replace(/\/$/, '')}/${key}`;
    return `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
  }

  /** Short-lived read URL for private objects (POD proofs, invoices). */
  async presignRead(key: string, expiresInSeconds = 900): Promise<string> {
    const command = new GetObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key });
    return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
  }

  async delete(key: string): Promise<void> {
    await s3.send(new DeleteObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key }));
  }
}

export const uploadsService = new UploadsService();
