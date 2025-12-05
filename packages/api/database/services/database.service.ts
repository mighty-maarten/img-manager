import { Injectable } from '@nestjs/common';
import { DataSource, DataSourceOptions } from 'typeorm';
import { VersionEntity } from '../entities/version.entity';
import { AppConfigService, DatabaseConfig } from '../../src/config/app-config.service';

@Injectable()
export class DatabaseService {
    constructor(private readonly configService: AppConfigService) {}

    public async getPostgresDataSource(): Promise<DataSource> {
        const databaseConfig = this.configService.getDatabaseConfig();
        return this.getDataSourceForDatabase(databaseConfig, 'postgres');
    }

    public async getDataSource(): Promise<DataSource> {
        const databaseConfig = this.configService.getDatabaseConfig();
        return this.getDataSourceForDatabase(databaseConfig, databaseConfig.database);
    }

    private getDataSourceForDatabase(
        databaseConfig: DatabaseConfig,
        databaseName: string,
    ): DataSource {
        const dataSourceConfig: DataSourceOptions = {
            type: 'postgres',
            host: databaseConfig.host,
            username: databaseConfig.username,
            password: databaseConfig.password,
            database: databaseName,
            port: databaseConfig.port,
            entities: [VersionEntity],
            connectTimeoutMS: 5000,
            ssl: databaseConfig.ssl
                ? {
                      rejectUnauthorized: false,
                  }
                : false,
        };

        return new DataSource(dataSourceConfig);
    }
}
