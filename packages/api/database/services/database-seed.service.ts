import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as path from 'path';
import { DatabaseHelper } from '../database.helper';

@Injectable()
export class DatabaseSeedService {
    public async seedSchema(dataSource: DataSource): Promise<void> {
        if (!dataSource.isInitialized) {
            await dataSource.initialize();
        }
        console.log(`Seeding data:`);
        await this.seedAppSchemas(dataSource);
        console.log(`Seeded successfully\n`);
    }

    private async seedAppSchemas(dataSource: DataSource) {
        const baseDir = '../files/data/';
        const files: string[] = ['seed.sql'];

        for (const f of files) {
            await DatabaseHelper.processSqlFile(
                path.join(__dirname, `${baseDir}/${f}`),
                dataSource,
            );
        }
    }
}
