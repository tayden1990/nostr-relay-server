import { Request, Response, NextFunction } from 'express';

// Policy for file size limits
export const fileSizeLimitPolicy = (req: Request, res: Response, next: NextFunction) => {
    const defaultMax = 500 * 1024 * 1024; // 500 MB default (increased from 10MB)
    const envMax = process.env.MAX_FILE_SIZE ? Number(process.env.MAX_FILE_SIZE) : undefined;
    const maxSize = Number.isFinite(envMax) && (envMax as number) > 0 ? (envMax as number) : defaultMax;

    const lenHeader = req.headers['content-length'];
    const raw = Array.isArray(lenHeader) ? lenHeader[0] : lenHeader;
    const contentLength = raw != null ? Number(raw) : undefined;

    if (contentLength != null && !Number.isNaN(contentLength) && contentLength > maxSize) {
        return res.status(413).send(`File size exceeds the limit of ${maxSize} bytes.`);
    }
    return next();
};

// Policy for file retention (more permissive - 1 year instead of 30 days)
export const fileRetentionPolicy = (fileCreationDate: Date) => {
    const retentionPeriod = 365 * 24 * 60 * 60 * 1000; // 365 days (1 year) instead of 30 days
    const currentTime = new Date().getTime();
    if (currentTime - fileCreationDate.getTime() > retentionPeriod) {
        return false; // File is expired
    }
    return true; // File is still valid
};

// Policy for moderation
export const moderationPolicy = (fileContent: string) => {
    const prohibitedWords = ['badword1', 'badword2']; // Example prohibited words
    for (const word of prohibitedWords) {
        if (fileContent.includes(word)) {
            return false; // Content is inappropriate
        }
    }
    return true; // Content is acceptable
};