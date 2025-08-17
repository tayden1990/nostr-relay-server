import fs from 'fs';
import path from 'path';

export const LOCAL_STORAGE_DIR = process.env.LOCAL_DIR
    ? path.resolve(process.env.LOCAL_DIR)
    : path.resolve(process.cwd(), 'uploads');

// Ensure the local storage directory exists
if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
    fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
}

/**
 * Saves a file to local storage.
 * @param {string} filename - The name of the file to save.
 * @param {Buffer} data - The file data to save.
 * @returns {Promise<string>} - The path to the saved file.
 */
export const saveFile = async (filename: string, data: Buffer): Promise<string> => {
    const filePath = path.join(LOCAL_STORAGE_DIR, filename);
    await fs.promises.writeFile(filePath, data);
    return filePath;
};

export const saveBuffer = saveFile;

/**
 * Retrieves a file from local storage.
 * @param {string} filename - The name of the file to retrieve.
 * @returns {Promise<Buffer>} - The file data.
 */
export const getFile = async (filename: string): Promise<Buffer> => {
    const filePath = path.join(LOCAL_STORAGE_DIR, filename);
    return await fs.promises.readFile(filePath);
};

/**
 * Deletes a file from local storage.
 * @param {string} filename - The name of the file to delete.
 * @returns {Promise<void>}
 */
export const deleteFile = async (filename: string): Promise<void> => {
    const filePath = path.join(LOCAL_STORAGE_DIR, filename);
    await fs.promises.unlink(filePath);
};