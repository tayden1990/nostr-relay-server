import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';

const REGION = process.env.AWS_REGION;
const s3 = new S3Client({ region: REGION });

const BUCKET_NAME = process.env.S3_BUCKET_NAME || '';

export const uploadBufferToS3 = async (buffer: Buffer, contentType: string, key: string): Promise<string> => {
    if (!BUCKET_NAME) throw new Error('S3_BUCKET_NAME not set');
    const cmd = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read',
    });
    await s3.send(cmd);
    const regionPart = REGION ? `.s3.${REGION}.amazonaws.com` : '.s3.amazonaws.com';
    return `https://${BUCKET_NAME}${regionPart}/${encodeURIComponent(key)}`;
};

// New: stream upload from a file path (preferred for big files)
export const uploadFileToS3 = async (filePath: string, contentType: string, key: string): Promise<string> => {
    if (!BUCKET_NAME) throw new Error('S3_BUCKET_NAME not set');
    const stream = fs.createReadStream(filePath);
    const cmd = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: stream,
        ContentType: contentType,
        ACL: 'public-read',
    });
    await s3.send(cmd);
    const regionPart = REGION ? `.s3.${REGION}.amazonaws.com` : '.s3.amazonaws.com';
    return `https://${BUCKET_NAME}${regionPart}/${encodeURIComponent(key)}`;
};