import { NestFactory } from '@nestjs/core';
import { DatabaseScriptModule } from './database.module';
import { DatabaseService } from './services/database.service';
import { DatabaseSetupService } from './services/database-setup.service';
import { DatabaseMigrateService } from './services/database-migrate.service';
import { DatabaseSeedService } from './services/database-seed.service';
import { AppConfigService } from '../src/config/app-config.service';

const options = {
    initialise: false,
    migrate: false,
    seed: false,
    maintenance: false,
};

const processName = `npm run db:dev --`;
process.argv.forEach((val) => {
    if (val === '--help' || val === '-h') {
        console.log(`
USAGE:
    ${processName} [OPTIONS]

OPTIONS:
    -h, --help\t\t\t\t prints help information
    -i, --initialize\t\t\t drops and creates the selected schemas
    -m, --migrate\t\t\t migrates the selected schemas
    -M, --maintenance\t\t\t toggles the database maintenance flag
    -s, --seed\t\t\t\t seeds the selected schemas
    --schemas <comma,seperated,schemas>\t selected schemas, defaults to app schema

EXAMPLES:
    Setup database:
    ${processName} -i -m -s

    Migrate all schemas:
    ${processName} -m

    Migrate specific schemas:
    ${processName} -m --schemas app,master
`);
        return process.exit(0);
    }
    if (val === '--initialize' || val === '-i') options.initialise = true;
    if (val === '--migrate' || val === '-m') options.migrate = true;
    if (val === '--seed' || val === '-s') options.seed = true;
    if (val === '--maintenance' || val === '-M') options.maintenance = true;
});

(async () => {
    const app = await NestFactory.createApplicationContext(DatabaseScriptModule);
    const configService = app.get(AppConfigService);
    const allowDatabaseSetupOrSeeding = configService.allowDatabaseSetup;

    const dbService = app.get(DatabaseService);
    const dataSource = await dbService.getDataSource();
    const postgresDataSource = await dbService.getPostgresDataSource();

    const setupService = app.get(DatabaseSetupService);
    const migrateService = app.get(DatabaseMigrateService);
    const seedService = app.get(DatabaseSeedService);
    try {
        await setupService.setupDatabaseIfNotExists(postgresDataSource, dataSource);
        if (options.initialise) {
            if (!allowDatabaseSetupOrSeeding) {
                console.log(
                    `NOT ALLOWED TO RUN SCRIPTS ON CURRENT ENVIRONMENT ${process.env.NODE_ENV}`,
                );
                return;
            }
            await setupService.setupDatabase(postgresDataSource, dataSource);
        }

        if (options.migrate) {
            await migrateService.migrate(dataSource);
        }

        if (options.seed) {
            if (!allowDatabaseSetupOrSeeding) {
                console.log(
                    `NOT ALLOWED TO RUN SCRIPTS ON CURRENT ENVIRONMENT ${process.env.NODE_ENV}`,
                );
                return;
            }
            await seedService.seedSchema(dataSource);
        }
        console.log('Done.');
    } catch (error) {
        console.error('Errors occurred:', error);
    } finally {
        if (postgresDataSource.isInitialized) {
            await postgresDataSource.destroy();
        }
        if (dataSource.isInitialized) {
            await dataSource.destroy();
        }
        await app.close();
    }
})();
