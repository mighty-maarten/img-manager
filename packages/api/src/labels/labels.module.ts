import { Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabelsService } from './labels.service';
import { Label } from '../database/entities/label.entity';
import { LabelsController } from './labels.controller';
import { AppConfigService } from '../config/app-config.service';
import { ConfigService } from '@nestjs/config';

@Module({
    imports: [TypeOrmModule.forFeature([Label])],
    controllers: [LabelsController],
    providers: [LabelsService, Logger, AppConfigService, ConfigService],
    exports: [LabelsService],
})
export class LabelsModule {}
