import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabaseHelper } from '../database.helper';
import { join } from 'path';
import { DatabaseService } from './database.service';
import { AppConfigService } from '../../src/config/app-config.service';

@Injectable()
export class DatabaseSetupService {
    constructor(private readonly configService: AppConfigService) {}

    public async setupDatabaseIfNotExists(
        postgresDataSource: DataSource,
        mainDataSource: DataSource,
    ) {
        const dbName = this.configService.getDatabaseConfig().database;
        if (!postgresDataSource.isInitialized) {
            await postgresDataSource.initialize();
        }
        console.log('Connected to default db');

        const result = await postgresDataSource.query(
            `select exists(SELECT datname FROM pg_catalog.pg_database WHERE datname = '${dbName}');`,
        );
        console.log('DB EXISTS?: ', result);
        await postgresDataSource.destroy();
        if (!result.length || !result[0].exists) {
            console.log('Creating schema...');
            await this.setupDatabase(
                await new DatabaseService(this.configService).getPostgresDataSource(),
                mainDataSource,
            );
        }
    }
    async setupDatabase(postgresDataSource: DataSource, mainDataSource: DataSource): Promise<void> {
        const databaseName = this.configService.getDatabaseConfig().database;
        console.log('Initializing database');
        if (!postgresDataSource.isInitialized) {
            await postgresDataSource.initialize();
        }

        console.log('Dropping database if exists...');
        const result = await postgresDataSource.query(
            `select exists(SELECT datname FROM pg_catalog.pg_database WHERE datname = '${databaseName}');`,
        );
        console.log('DB EXISTS?: ', result);
        if (result && result[0].exists) {
            console.log('DROPPING');
            await postgresDataSource.query(
                `SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '${databaseName}' AND pid <> pg_backend_pid();`,
            );
            await postgresDataSource.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
        } else {
            console.log('DID NOT EXIST');
        }
        await postgresDataSource.query(`CREATE DATABASE "${databaseName}"`);

        if (!mainDataSource.isInitialized) {
            await mainDataSource.initialize();
        }
        await DatabaseHelper.processSqlFile(
            join(__dirname, '../files/definitions/public.sql'),
            mainDataSource,
        );

        console.log(`Created database successfully\n`);
    }
}
