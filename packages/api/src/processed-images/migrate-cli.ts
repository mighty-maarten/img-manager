import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { MigrationService } from './migration.service';
import { Logger } from '@nestjs/common';

const options = {
    dryRun: false,
    help: false,
};

const processName = `npm run migrate:processed-images --`;

process.argv.forEach((val) => {
    if (val === '--help' || val === '-h') {
        options.help = true;
    }
    if (val === '--dry-run' || val === '-d') {
        options.dryRun = true;
    }
});

if (options.help) {
    console.log(`
USAGE:
    ${processName} [OPTIONS]

DESCRIPTION:
    Migrates processed images from the old flat structure (/processed/<filename>)
    to the new label-based structure (/processed/<label>/<filename>).
    
    This script will:
    - Identify all root-level files in /processed/
    - Parse filenames to extract label names
    - Verify labels exist in the database
    - Copy files to /processed/<label>/ folders
    - Update ProcessedImage database records
    - Delete old files after successful migration
    
    The migration is idempotent and safe to run multiple times.

OPTIONS:
    -h, --help\t\t prints help information
    -d, --dry-run\t runs in preview mode without making changes

EXAMPLES:
    Preview migration (dry run):
    ${processName} -d

    Execute migration:
    ${processName}
`);
    process.exit(0);
}

(async () => {
    const logger = new Logger('MigrationCLI');
    
    logger.log('Starting processed images migration CLI...');
    logger.log(`Mode: ${options.dryRun ? 'DRY RUN (preview only)' : 'LIVE (will make changes)'}`);
    
    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['log', 'error', 'warn'],
    });

    const migrationService = app.get(MigrationService);

    try {
        const result = await migrationService.migrateProcessedImagesToLabelFolders(
            options.dryRun,
        );

        logger.log('='.repeat(60));
        logger.log('MIGRATION COMPLETE');
        logger.log('='.repeat(60));
        logger.log(`Migrated: ${result.migrated}`);
        logger.log(`Skipped:  ${result.skipped}`);
        logger.log(`Failed:   ${result.failed}`);
        
        if (result.errors.length > 0) {
            logger.log('='.repeat(60));
            logger.log('ERRORS:');
            result.errors.forEach((error, index) => {
                logger.error(`${index + 1}. ${error}`);
            });
        }
        
        logger.log('='.repeat(60));
        
        if (options.dryRun) {
            logger.log('');
            logger.log('This was a DRY RUN. No changes were made.');
            logger.log('Run without --dry-run flag to execute the migration.');
        }
        
        logger.log('Done.');
    } catch (error) {
        logger.error('Fatal error occurred during migration:', error);
        process.exit(1);
    } finally {
        await app.close();
    }
})();
