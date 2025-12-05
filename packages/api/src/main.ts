import { AppModule } from './app.module';
import { NestFactory } from '@nestjs/core';
import { setupSwagger } from './swagger';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import { AppConfigService } from './config/app-config.service';
import { GlobalErrorFilter } from './error-filters/global.error-filter';
import { WinstonModule } from 'nest-winston';
import { setupLogger } from './logging/setup-logger';

export async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule);
    const appConfigService = app.get<AppConfigService>(AppConfigService);

    // Set global API prefix for all routes except /status
    app.setGlobalPrefix('api', {
        exclude: ['/status'],
    });

    app.enableCors({
        origin: appConfigService.allowedOrigins,
        methods: 'GET,PUT,POST,PATCH,DELETE,UPDATE,OPTIONS',
        credentials: true,
    });
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
        }),
    );
    app.use(bodyParser.json({ limit: '50mb' }));
    app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
    app.useGlobalFilters(new GlobalErrorFilter(appConfigService));

    app.useLogger(
        WinstonModule.createLogger({
            instance: setupLogger(app.get(AppConfigService)),
        }),
    );

    setupSwagger(app);
    await app.init();
    const port = appConfigService.appPort ? appConfigService.appPort : 3000;
    await app.listen(port);
}
void bootstrap();
