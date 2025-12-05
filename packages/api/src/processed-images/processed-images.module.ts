import { Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessedImagesController } from './processed-images.controller';
import { ProcessedImagesService } from './processed-images.service';
import { StorageModule } from '../storage/storage.module';
import { AppConfigModule } from '../config/app-config.module';
import { ProcessedImage } from '../database/entities/processed-image.entity';
import { Image } from '../database/entities/image.entity';
import { ScrapedImage } from '../database/entities/scraped-image.entity';
import { Label } from '../database/entities/label.entity';
import { ProcessingRun } from '../database/entities/processing-run.entity';
import { NonCloudGuard } from '../guards/non-cloud.guard';

@Module({
    imports: [
        TypeOrmModule.forFeature([ProcessedImage, Image, ScrapedImage, Label, ProcessingRun]),
        StorageModule,
        AppConfigModule,
    ],
    controllers: [ProcessedImagesController],
    providers: [ProcessedImagesService, NonCloudGuard, Logger],
})
export class ProcessedImagesModule {}
