import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

function ensureS3() {
    if ((process.env.ENABLE_S3 || 'false').toLowerCase() !== 'true') {
        throw new Error('S3 disabled: set ENABLE_S3=true to enable');
    }
    const region = process.env.AWS_REGION;
    const s3 = new S3Client({ region });
    const BUCKET_NAME = process.env.S3_BUCKET_NAME;
    if (!BUCKET_NAME) throw new Error('S3_BUCKET_NAME is required');
    return { s3, BUCKET_NAME };
}

export const uploadFile = async (filePath: string): Promise<string> => {
    const { s3, BUCKET_NAME } = ensureS3();
    const data = fs.readFileSync(filePath);
    const key = `${Date.now()}-${path.basename(filePath)}`;
    await s3.send(new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, Body: data }));
    const region = process.env.AWS_REGION;
    const regionPart = region ? `.s3.${region}.amazonaws.com` : '.s3.amazonaws.com';
    return `https://${BUCKET_NAME}${regionPart}/${encodeURIComponent(key)}`;
};

export const getFile = async (fileKey: string): Promise<Buffer> => {
    const { s3, BUCKET_NAME } = ensureS3();
    const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: fileKey }));
    const chunks: Buffer[] = [];
    const stream = resp.Body as unknown as NodeJS.ReadableStream;
    await new Promise<void>((resolve, reject) => {
        stream.on('data', (c: Buffer) => chunks.push(c));
        stream.on('end', () => resolve());
        stream.on('error', reject);
    });
    return Buffer.concat(chunks);
};

export const deleteFile = async (fileKey: string): Promise<void> => {
    const { s3, BUCKET_NAME } = ensureS3();
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: fileKey }));
};