import { Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionsService } from './collections.service';
import { Collection } from '../database/entities/collection.entity';
import { Label } from '../database/entities/label.entity';
import { ScrapedImage } from '../database/entities/scraped-image.entity';
import { Scrape } from '../database/entities/scrape.entity';
import { Image } from '../database/entities/image.entity';
import { ProcessedImage } from '../database/entities/processed-image.entity';
import { CollectionsController } from './collections.controller';
import { AppConfigService } from '../config/app-config.service';
import { ConfigService } from '@nestjs/config';
import { ScrapingModule } from '../scraping/scraping.module';
import { StorageModule } from '../storage/storage.module';
import { ProcessingRun } from '../database/entities/processing-run.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Collection,
            Label,
            ScrapedImage,
            Scrape,
            Image,
            ProcessedImage,
            ProcessingRun,
        ]),
        ScrapingModule,
        StorageModule,
    ],
    controllers: [CollectionsController],
    providers: [CollectionsService, Logger, AppConfigService, ConfigService],
    exports: [CollectionsService],
})
export class CollectionsModule {}
