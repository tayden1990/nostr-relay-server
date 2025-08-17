import * as Joi from 'joi';

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

export default configSchema;