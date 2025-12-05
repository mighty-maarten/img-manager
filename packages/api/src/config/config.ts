import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';
import { AppConfig, DatabaseConfig, JwtConfig } from './app-config.service';

export type ConfigKey = 'app' | 'database' | 'jwt';

export type ConfigKeyTypes = {
    app: () => AppConfig;
    database: () => DatabaseConfig;
    jwt: () => JwtConfig;
};

const configToDataMap = {
    app: () => ({
        port: Number(process.env.APP_PORT),
        allowedOrigins: process.env.APP_ALLOWED_ORIGINS as string,
        allowDatabaseSetup: process.env.APP_ALLOW_DATABASE_SETUP === 'true',
        isCloud: process.env.APP_IS_CLOUD === 'true',
        cloudwatchLogGroupName: process.env.APP_CLOUDWATCH_LOG_GROUP_NAME as string,
        snsErrorTopicArn: process.env.APP_SNS_ERROR_TOPIC_ARN as string,
        localStoragePath: process.env.APP_LOCAL_STORAGE_PATH as string,
        assetsBucketName: process.env.APP_ASSETS_BUCKET_NAME as string,
    }),
    database: () => ({
        host: process.env.DATABASE_HOST as string,
        port: Number(process.env.DATABASE_PORT),
        username: process.env.DATABASE_USERNAME as string,
        password: process.env.DATABASE_PASSWORD as string,
        database: process.env.DATABASE_NAME as string,
        ssl: process.env.DATABASE_SSL === 'true',
    }),
    jwt: () => ({
        secret: process.env.JWT_SECRET as string,
        expiresIn: process.env.JWT_EXPIRES_IN as string,
    }),
} as const satisfies { [key in ConfigKey]: ConfigKeyTypes[key] };

export const registeredConfigs = (
    Object.keys(configToDataMap) as [keyof typeof configToDataMap]
).map((key) => {
    return registerAs(key, configToDataMap[key]);
});

// Validation schema used by the ConfigModule to validate the environment variables at runtime
export const validationSchema = Joi.object({
    NODE_ENV: Joi.string().valid('local', 'development', 'production').default('local'),
    APP_PORT: Joi.number().default(3000),
    APP_ALLOW_DATABASE_SETUP: Joi.boolean().default(false),
    APP_ALLOWED_ORIGINS: Joi.string().required(),
    APP_IS_CLOUD: Joi.string().required(),
    APP_CLOUDWATCH_LOG_GROUP_NAME: Joi.string().required(),
    APP_SNS_ERROR_TOPIC_ARN: Joi.string().required(),
    APP_LOCAL_STORAGE_PATH: Joi.string().required(),
    APP_ASSETS_BUCKET_NAME: Joi.string().required(),
    DATABASE_HOST: Joi.string().required(),
    DATABASE_PORT: Joi.number().required(),
    DATABASE_USERNAME: Joi.string().required(),
    DATABASE_PASSWORD: Joi.string().required().allow(''),
    DATABASE_NAME: Joi.string().required(),
    DATABASE_SSL: Joi.boolean().default(false),
    JWT_SECRET: Joi.string().required(),
    JWT_EXPIRES_IN: Joi.string().default('1h'),
});
