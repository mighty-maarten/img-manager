import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { registeredConfigs, validationSchema } from './config';
import { AppConfigService } from './app-config.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [...registeredConfigs],
            // Load environment files in order of precedence (first found wins):
            // 1. .env.local (highest priority, for local development)
            // 2. .env.{NODE_ENV} (environment-specific)
            // 3. .env (fallback)
            envFilePath: [`.env.local`, `.env.${process.env.NODE_ENV}`, `.env`],
            validationSchema,
        }),
    ],
    exports: [AppConfigService, ConfigService],
    providers: [AppConfigService, ConfigService],
})
export class AppConfigModule {}
