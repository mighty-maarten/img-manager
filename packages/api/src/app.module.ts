import { Logger, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { AppController, HEALTH_CHECK_ENDPOINT } from './app.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseSetupService } from '../database/services/database-setup.service';
import { DatabaseService } from '../database/services/database.service';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { RouterModule } from '@nestjs/core';
import { getModulesFromRoutes, routes } from './routes';
import { MaintenanceMiddleware } from './middlewares/maintenance.middleware';
import { SiteSettingsEntity } from './database/entities/site-settings.entity';
import { AppConfigService } from './config/app-config.service';
import { AppConfigModule } from './config/app-config.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            imports: [AppConfigModule],
            inject: [AppConfigService],
            useFactory: async (configService: AppConfigService) => {
                const databaseSetupService = new DatabaseSetupService(configService);
                const dbService = new DatabaseService(configService);
                console.log('Checking db...');
                await databaseSetupService.setupDatabaseIfNotExists(
                    await dbService.getPostgresDataSource(),
                    await dbService.getDataSource(),
                );
                console.log('Start DB connection...');
                const config = configService.getDatabaseConfig();
                return {
                    type: 'postgres',
                    host: config.host,
                    username: config.username,
                    password: config.password,
                    database: config.database,
                    port: config.port,
                    entities: [__dirname + '/../src/database/**/*.entity{.ts,.js}'],
                    namingStrategy: new SnakeNamingStrategy(),
                    logging: false,
                    ssl: config.ssl
                        ? {
                              rejectUnauthorized: false,
                          }
                        : false,
                };
            },
        }),
        TypeOrmModule.forFeature([SiteSettingsEntity]),
        ServeStaticModule.forRoot({
            rootPath: join(__dirname, '../../..', 'client/dist'),
            exclude: ['/api/{*path}', '/status'],
            serveStaticOptions: {
                index: ['index.html'],
                fallthrough: true,
            },
            renderPath: '/{*path}',
        }),
        // Routes
        RouterModule.register(routes),
        ...getModulesFromRoutes(routes),
    ],
    controllers: [AppController],
    providers: [Logger],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(MaintenanceMiddleware)
            .exclude({ path: HEALTH_CHECK_ENDPOINT, method: RequestMethod.GET })
            .forRoutes({ path: '/(.*)', method: RequestMethod.ALL });
    }
}
