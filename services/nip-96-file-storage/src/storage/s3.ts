const REGION = process.env.AWS_REGION;
const BUCKET_NAME = process.env.S3_BUCKET_NAME || '';

function getS3() {
    // Avoid static import so builds work without the AWS SDK installed.
    const req: any = (eval as unknown as (code: string) => any)('require');
    const mod = req('@aws-sdk/client-s3');
    const client = new mod.S3Client({ region: REGION });
    return { client, PutObjectCommand: mod.PutObjectCommand };
}

export const uploadBufferToS3 = async (body: Buffer | NodeJS.ReadableStream, contentType: string, key: string): Promise<string> => {
    if (!BUCKET_NAME) throw new Error('S3_BUCKET_NAME not set');
    const { client, PutObjectCommand } = getS3();
    const cmd = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: contentType,
        ACL: 'public-read',
    });
    await client.send(cmd);
    const regionPart = REGION ? `.s3.${REGION}.amazonaws.com` : '.s3.amazonaws.com';
    return `https://${BUCKET_NAME}${regionPart}/${encodeURIComponent(key)}`;
};