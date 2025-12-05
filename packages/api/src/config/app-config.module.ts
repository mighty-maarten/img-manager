import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { registeredConfigs, validationSchema } from './config';
import { AppConfigService } from './app-config.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [...registeredConfigs],
            // Load environment files in order of precedence (first found wins):
            // 1. Package-level .env.local (highest priority)
            // 2. Root-level .env.local (monorepo shared config)
            // 3. Package-level .env.{NODE_ENV}
            // 4. Package-level .env
            envFilePath: [`.env.local`, `../../.env.local`, `.env.${process.env.NODE_ENV}`, `.env`],
            validationSchema,
        }),
    ],
    exports: [AppConfigService, ConfigService],
    providers: [AppConfigService, ConfigService],
})
export class AppConfigModule {}
