import { Module } from '@nestjs/common';
import { DatabaseService } from './services/database.service';
import { DatabaseSetupService } from './services/database-setup.service';
import { DatabaseMigrateService } from './services/database-migrate.service';
import { DatabaseSeedService } from './services/database-seed.service';
import { AppConfigModule } from '../src/config/app-config.module';

@Module({
    imports: [AppConfigModule],
    controllers: [],
    providers: [DatabaseService, DatabaseSetupService, DatabaseMigrateService, DatabaseSeedService],
})
export class DatabaseScriptModule {}
