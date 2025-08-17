import fs from 'fs';
import path from 'path';

const LOCAL_STORAGE_DIR = path.join(__dirname, 'local_storage');

// Ensure the local storage directory exists
if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
    fs.mkdirSync(LOCAL_STORAGE_DIR);
}

/**
 * Saves a file to local storage.
 * @param {string} filename - The name of the file to save.
 * @param {Buffer} data - The data to save in the file.
 * @returns {Promise<string>} - The path to the saved file.
 */
export const saveFile = async (filename: string, data: Buffer): Promise<string> => {
    const filePath = path.join(LOCAL_STORAGE_DIR, filename);
    await fs.promises.writeFile(filePath, data);
    return filePath;
};

/**
 * Retrieves a file from local storage.
 * @param {string} filename - The name of the file to retrieve.
 * @returns {Promise<Buffer>} - The data of the retrieved file.
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

/**
 * Lists all files in local storage.
 * @returns {Promise<string[]>} - An array of filenames.
 */
export const listFiles = async (): Promise<string[]> => {
    return await fs.promises.readdir(LOCAL_STORAGE_DIR);
};