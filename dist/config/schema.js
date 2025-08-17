"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const Joi = __importStar(require("joi"));
const configSchema = Joi.object({
    PORT: Joi.number().default(3000),
    DATABASE_URL: Joi.string().uri().required(),
    REDIS_URL: Joi.string().uri().required(),
    FILE_STORAGE: Joi.string().valid('local', 's3').default('local'),
    MAX_MESSAGE_SIZE: Joi.number().default(1024 * 1024), // 1 MB
    MAX_FILE_SIZE: Joi.number().default(10 * 1024 * 1024), // 10 MB
    EVENT_RETENTION_DAYS: Joi.number().default(30),
    RATE_LIMIT: Joi.object({
        WINDOW_MS: Joi.number().default(60000), // 1 minute
        MAX_REQUESTS: Joi.number().default(100),
    }),
    MODERATION: Joi.object({
        ENABLED: Joi.boolean().default(false),
        BLOCKED_WORDS: Joi.array().items(Joi.string()).default([]),
    }),
});
exports.default = configSchema;
