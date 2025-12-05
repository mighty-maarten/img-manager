import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseHelper } from '../database.helper';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseMigrateService {
    constructor() {}

    public async migrate(mainDataSource: DataSource): Promise<void> {
        if (!mainDataSource.isInitialized) {
            await mainDataSource.initialize();
        }
        const availableMigrationVersions = await this.getAvailableMigrationVersions();

        console.log('Following migrations exist:');

        const currentVersion: number = +(
            await mainDataSource.query(
                `select version from versions order by version desc limit 1;`,
            )
        )[0].version;

        this.printVersions(availableMigrationVersions, currentVersion);

        console.log('Current version:', currentVersion);

        const migrationsToRun = this.determineMigrationsToRun(
            availableMigrationVersions,
            currentVersion,
        );

        if (migrationsToRun.length === 0) {
            console.log(`Already on latest version, nothing to do.`);
            return;
        }

        console.log(`Following migrations will be executed:`);
        this.printVersions(migrationsToRun);

        await this.runMigrations(mainDataSource, migrationsToRun);
    }

    private async runMigrations(
        mainDataSource: DataSource,
        migrations: MigrationVersion[],
    ): Promise<void> {
        let currentVersion: number = +(
            await mainDataSource.query(
                `select version from versions order by version desc limit 1;`,
            )
        )[0].version;
        for (const migration of migrations) {
            currentVersion = currentVersion + 1;
            console.log(`Migrating to version ${migration.version}:`);

            try {
                await mainDataSource.query(
                    `insert into versions (version, updated_on) values (${currentVersion},to_timestamp(${Date.now()} / 1000.0))`,
                );

                await DatabaseHelper.processSqlFileOnManager(migration.filePath, mainDataSource);
                console.log(`Successfully migrated to version ${migration.version}.`);
            } catch (e: unknown) {
                console.error(
                    `Migration version ${migration.version} failed, rolling back this migration.`,
                );
                throw e;
            }
        }
    }

    private async getAvailableMigrationVersions(): Promise<MigrationVersion[]> {
        const migrationsPath = path.resolve(__dirname, `../files/migrations/`);
        const files = fs.readdirSync(migrationsPath);
        const migrationFilePattern = /^(\d+)(.*)(\.sql)$/;
        const versions: MigrationVersion[] = [];
        files.forEach((f) => {
            const match = migrationFilePattern.exec(f);
            if (match) {
                versions.push({
                    version: Number(match[1]),
                    filePath: path.resolve(migrationsPath, f),
                });
            }
        });
        versions.sort((a, b) => a.version - b.version);
        this.checkMigrationVersions(versions);
        return versions;
    }

    private checkMigrationVersions(versions: MigrationVersion[]) {
        if (new Set(versions.map((m) => m.version)).size !== versions.length) {
            throw new Error(
                'Migrations cannot contain duplicate entries, make sure that migration numbers are unique and in the correct order.',
            );
        }

        for (let i = 0; i < versions.length - 1; i++) {
            if (versions[i].version !== versions[i + 1].version - 1)
                throw new Error(
                    `A migration is missing between ${
                        versions[i].filePath
                    } and ${versions[i + 1].filePath}`,
                );
        }
    }

    private determineMigrationsToRun(
        availableVersions: MigrationVersion[],
        currentVersion: number,
    ): MigrationVersion[] {
        const migrationsToRun = availableVersions.filter((av) => av.version > currentVersion);
        migrationsToRun.sort((a, b) => a.version - b.version);
        return migrationsToRun;
    }

    private printVersions(data: MigrationVersion[], currentVersion?: number) {
        for (const row of data) {
            console.log(
                `${currentVersion === row.version ? '*' : '-'} Version ${
                    row.version
                } \t=>\t ${row.filePath}`,
            );
        }
        console.log();
    }
}

export interface MigrationVersion {
    version: number;
    filePath: string;
}
