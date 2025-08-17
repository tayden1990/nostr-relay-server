"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listFiles = exports.deleteFile = exports.getFile = exports.saveFile = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const LOCAL_STORAGE_DIR = path_1.default.join(__dirname, 'local_storage');
// Ensure the local storage directory exists
if (!fs_1.default.existsSync(LOCAL_STORAGE_DIR)) {
    fs_1.default.mkdirSync(LOCAL_STORAGE_DIR);
}
/**
 * Saves a file to local storage.
 * @param {string} filename - The name of the file to save.
 * @param {Buffer} data - The data to save in the file.
 * @returns {Promise<string>} - The path to the saved file.
 */
const saveFile = async (filename, data) => {
    const filePath = path_1.default.join(LOCAL_STORAGE_DIR, filename);
    await fs_1.default.promises.writeFile(filePath, data);
    return filePath;
};
exports.saveFile = saveFile;
/**
 * Retrieves a file from local storage.
 * @param {string} filename - The name of the file to retrieve.
 * @returns {Promise<Buffer>} - The data of the retrieved file.
 */
const getFile = async (filename) => {
    const filePath = path_1.default.join(LOCAL_STORAGE_DIR, filename);
    return await fs_1.default.promises.readFile(filePath);
};
exports.getFile = getFile;
/**
 * Deletes a file from local storage.
 * @param {string} filename - The name of the file to delete.
 * @returns {Promise<void>}
 */
const deleteFile = async (filename) => {
    const filePath = path_1.default.join(LOCAL_STORAGE_DIR, filename);
    await fs_1.default.promises.unlink(filePath);
};
exports.deleteFile = deleteFile;
/**
 * Lists all files in local storage.
 * @returns {Promise<string[]>} - An array of filenames.
 */
const listFiles = async () => {
    return await fs_1.default.promises.readdir(LOCAL_STORAGE_DIR);
};
exports.listFiles = listFiles;
