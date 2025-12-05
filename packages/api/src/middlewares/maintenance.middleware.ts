import { HttpException, HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteSettingsEntity } from '../database/entities/site-settings.entity';

@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
    constructor(
        @InjectRepository(SiteSettingsEntity)
        private siteSettingsRepository: Repository<SiteSettingsEntity>,
    ) {}

    async use(req: Request, res: Response, next: NextFunction) {
        const entities = await this.siteSettingsRepository.find();
        const inMaintenance = entities.length === 1 && entities[0].isMaintenance;
        if (inMaintenance && !req.headers['skip-maintenance']) {
            throw new HttpException('In Maintenance', HttpStatus.SERVICE_UNAVAILABLE);
        }
        if (next) {
            next();
        }
    }
}
