declare module 'multer' {
  import { RequestHandler } from 'express';
  interface StorageEngine {}
  interface DiskStorageOptions {
    destination?: any;
    filename?: any;
  }
  interface Options {
    storage?: StorageEngine;
    limits?: { fileSize?: number };
  }
  interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    destination?: string;
    filename?: string;
    path?: string;
    buffer?: Buffer;
  }
  interface MulterInstance {
    single(field: string): RequestHandler;
  }
  function multer(opts?: Options): MulterInstance;
  namespace multer {
    function diskStorage(opts?: DiskStorageOptions): StorageEngine;
    class MulterError extends Error { code: string }
  }
  export = multer;
}
