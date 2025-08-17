"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFile = exports.getFile = exports.uploadFile = void 0;
function ensureS3() {
    if ((process.env.ENABLE_S3 || 'false').toLowerCase() !== 'true') {
        throw new Error('S3 disabled: set ENABLE_S3=true to enable');
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AWS = require('aws-sdk');
    const s3 = new AWS.S3();
    const BUCKET_NAME = process.env.S3_BUCKET_NAME;
    if (!BUCKET_NAME)
        throw new Error('S3_BUCKET_NAME is required');
    return { s3, BUCKET_NAME };
}
const uploadFile = async (filePath) => {
    const { s3, BUCKET_NAME } = ensureS3();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path');
    const data = fs.readFileSync(filePath);
    const key = `${Date.now()}-${path.basename(filePath)}`;
    const { Location } = await s3.upload({ Bucket: BUCKET_NAME, Key: key, Body: data }).promise();
    return Location;
};
exports.uploadFile = uploadFile;
const getFile = async (fileKey) => {
    const { s3, BUCKET_NAME } = ensureS3();
    const { Body } = await s3.getObject({ Bucket: BUCKET_NAME, Key: fileKey }).promise();
    return Body;
};
exports.getFile = getFile;
const deleteFile = async (fileKey) => {
    const { s3, BUCKET_NAME } = ensureS3();
    await s3.deleteObject({ Bucket: BUCKET_NAME, Key: fileKey }).promise();
};
exports.deleteFile = deleteFile;
