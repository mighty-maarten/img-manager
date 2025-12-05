#!/usr/bin/env ts-node

/**
 * S3 Bulk Rename Script
 *
 * Renames S3 objects by replacing a pattern in the key name.
 * This script performs copy + delete operations since S3 doesn't support true rename.
 *
 * Usage:
 *   npm run rename:s3 -- --dry-run                    # Preview changes without executing
 *   npm run rename:s3                                 # Execute the rename operation
 *   npm run rename:s3 -- --bucket my-bucket          # Specify custom bucket
 *   npm run rename:s3 -- --pattern "old" --replace "new"  # Custom pattern replacement
 *
 * Environment Variables:
 *   AWS_REGION or region     - AWS region (default: us-east-1)
 *   BUCKET_NAME              - S3 bucket name (can also use --bucket flag)
 */

import {
    S3Client,
    ListObjectsV2Command,
    CopyObjectCommand,
    DeleteObjectsCommand,
    ListObjectsV2CommandOutput,
} from '@aws-sdk/client-s3';

// Configuration
interface Config {
    bucketName: string;
    pattern: string;
    replacement: string;
    region: string;
    dryRun: boolean;
    concurrency: number;
}

// Parse command-line arguments
function parseArgs(): Config {
    const args = process.argv.slice(2);

    const config: Config = {
        bucketName: process.env.BUCKET_NAME || process.env.APP_ASSETS_BUCKET_NAME || '',
        pattern: 'processed#',
        replacement: 'processed@',
        region: process.env.AWS_REGION || process.env.region || 'eu-west-1',
        dryRun: false,
        concurrency: 30,
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--dry-run':
            case '-d':
                config.dryRun = true;
                break;
            case '--bucket':
            case '-b':
                config.bucketName = args[++i];
                break;
            case '--pattern':
            case '-p':
                config.pattern = args[++i];
                break;
            case '--replace':
            case '-r':
                config.replacement = args[++i];
                break;
            case '--region':
                config.region = args[++i];
                break;
            case '--concurrency':
            case '-c':
                config.concurrency = parseInt(args[++i], 10);
                break;
            case '--help':
            case '-h':
                printHelp();
                process.exit(0);
                break;
            default:
                if (arg.startsWith('-')) {
                    console.error(`Unknown option: ${arg}`);
                    printHelp();
                    process.exit(1);
                }
        }
    }

    // Validate configuration
    if (!config.bucketName) {
        console.error(
            'Error: Bucket name is required. Use --bucket flag or set BUCKET_NAME environment variable.',
        );
        process.exit(1);
    }

    return config;
}

function printHelp(): void {
    console.log(`
S3 Bulk Rename Script

Usage:
  npm run rename:s3 -- [options]

Options:
  --dry-run, -d              Preview changes without executing (default: false)
  --bucket, -b <name>        S3 bucket name (default: from BUCKET_NAME env var)
  --pattern, -p <pattern>    Pattern to search for (default: "processed#")
  --replace, -r <string>     Replacement string (default: "processed@")
  --region <region>          AWS region (default: from AWS_REGION or "us-east-1")
  --concurrency, -c <num>    Number of parallel operations (default: 30)
  --help, -h                 Show this help message

Examples:
  npm run rename:s3 -- --dry-run
  npm run rename:s3 -- --bucket my-bucket
  npm run rename:s3 -- --pattern "old#" --replace "new@"
  npm run rename:s3 -- --concurrency 50

Environment Variables:
  AWS_REGION or region       AWS region
  BUCKET_NAME                S3 bucket name
  AWS_ACCESS_KEY_ID          AWS access key (if not using IAM role)
  AWS_SECRET_ACCESS_KEY      AWS secret key (if not using IAM role)
`);
}

// Utility function to batch an array into chunks
function chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

// Utility function to limit concurrency
async function pLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<any>): Promise<void> {
    const results: Promise<any>[] = [];
    let active = 0;
    let index = 0;

    return new Promise((resolve, reject) => {
        const run = async () => {
            if (index >= items.length && active === 0) {
                resolve();
                return;
            }

            while (active < limit && index < items.length) {
                const currentIndex = index++;
                const item = items[currentIndex];
                active++;

                const promise = fn(item)
                    .then(() => {
                        active--;
                        run();
                    })
                    .catch((error) => {
                        active--;
                        reject(error);
                    });

                results.push(promise);
            }
        };

        run();
    });
}

// Main rename function
async function renameS3Objects(config: Config): Promise<void> {
    const s3Client = new S3Client({ region: config.region });

    console.log('\n=== S3 Bulk Rename Configuration ===');
    console.log(`Bucket:       ${config.bucketName}`);
    console.log(`Region:       ${config.region}`);
    console.log(`Pattern:      ${config.pattern}`);
    console.log(`Replacement:  ${config.replacement}`);
    console.log(`Concurrency:  ${config.concurrency}`);
    console.log(
        `Mode:         ${config.dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be applied)'}`,
    );
    console.log('====================================\n');

    if (config.dryRun) {
        console.log('⚠️  DRY RUN MODE: No actual changes will be made\n');
    }

    let totalObjects = 0;
    let matchedObjects = 0;
    let renamedObjects = 0;
    let errorCount = 0;
    let continuationToken: string | undefined;

    try {
        do {
            // List objects with pagination
            const listCommand = new ListObjectsV2Command({
                Bucket: config.bucketName,
                ContinuationToken: continuationToken,
                MaxKeys: 1000,
            });

            console.log(`📋 Fetching objects from S3...`);
            const listResponse: ListObjectsV2CommandOutput = await s3Client.send(listCommand);

            const objects = listResponse.Contents || [];
            totalObjects += objects.length;

            // Filter objects matching the pattern
            const objectsToRename = objects.filter((obj) => obj.Key?.includes(config.pattern));
            matchedObjects += objectsToRename.length;

            if (objectsToRename.length === 0) {
                console.log(`No objects matching pattern "${config.pattern}" in this batch.`);
            } else {
                console.log(
                    `\n✅ Found ${objectsToRename.length} objects to rename in this batch:`,
                );

                // Show preview of objects to rename (first 5)
                objectsToRename.slice(0, 5).forEach((obj) => {
                    const oldKey = obj.Key!;
                    const newKey = oldKey.replace(
                        new RegExp(config.pattern, 'g'),
                        config.replacement,
                    );
                    console.log(`   ${oldKey} → ${newKey}`);
                });

                if (objectsToRename.length > 5) {
                    console.log(`   ... and ${objectsToRename.length - 5} more`);
                }
                console.log();

                if (!config.dryRun) {
                    // Copy objects with new keys (parallel processing)
                    console.log(`📦 Copying ${objectsToRename.length} objects with new keys...`);

                    const copyOperations = objectsToRename.map((obj) => async () => {
                        const oldKey = obj.Key!;
                        const newKey = oldKey.replace(
                            new RegExp(config.pattern, 'g'),
                            config.replacement,
                        );

                        try {
                            const copyCommand = new CopyObjectCommand({
                                Bucket: config.bucketName,
                                CopySource: encodeURIComponent(`${config.bucketName}/${oldKey}`),
                                Key: newKey,
                            });

                            await s3Client.send(copyCommand);
                            renamedObjects++;

                            // Log progress every 10 objects
                            if (renamedObjects % 10 === 0) {
                                console.log(
                                    `   Copied ${renamedObjects}/${matchedObjects} objects...`,
                                );
                            }
                        } catch (error) {
                            errorCount++;
                            console.error(
                                `   ❌ Error copying ${oldKey}:`,
                                error instanceof Error ? error.message : error,
                            );
                        }
                    });

                    await pLimit(copyOperations, config.concurrency, (fn) => fn());
                    console.log(`✅ Copied ${renamedObjects} objects successfully\n`);

                    // Delete original objects in batches of 1000
                    console.log(`🗑️  Deleting ${objectsToRename.length} original objects...`);
                    const deleteChunks = chunk(objectsToRename, 1000);

                    for (let i = 0; i < deleteChunks.length; i++) {
                        const chunkObjects = deleteChunks[i];

                        try {
                            const deleteCommand = new DeleteObjectsCommand({
                                Bucket: config.bucketName,
                                Delete: {
                                    Objects: chunkObjects.map((obj) => ({ Key: obj.Key! })),
                                    Quiet: true,
                                },
                            });

                            await s3Client.send(deleteCommand);
                            console.log(
                                `   Deleted batch ${i + 1}/${deleteChunks.length} (${chunkObjects.length} objects)`,
                            );
                        } catch (error) {
                            errorCount++;
                            console.error(
                                `   ❌ Error deleting batch ${i + 1}:`,
                                error instanceof Error ? error.message : error,
                            );
                        }
                    }

                    console.log(`✅ Deleted original objects\n`);
                }
            }

            continuationToken = listResponse.NextContinuationToken;

            if (continuationToken) {
                console.log('📄 More objects to process, fetching next page...\n');
            }
        } while (continuationToken);

        // Summary
        console.log('\n=== Summary ===');
        console.log(`Total objects scanned:    ${totalObjects}`);
        console.log(`Objects matching pattern: ${matchedObjects}`);

        if (!config.dryRun) {
            console.log(`Objects renamed:          ${renamedObjects}`);
            console.log(`Errors:                   ${errorCount}`);

            if (errorCount > 0) {
                console.log('\n⚠️  Some errors occurred. Please check the logs above.');
            } else if (renamedObjects > 0) {
                console.log('\n✅ All objects renamed successfully!');
            }
        } else {
            console.log('\n💡 Run without --dry-run flag to apply these changes.');
        }
        console.log('===============\n');
    } catch (error) {
        console.error('\n❌ Fatal error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

// Main execution
async function main(): Promise<void> {
    try {
        const config = parseArgs();
        await renameS3Objects(config);
    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}
