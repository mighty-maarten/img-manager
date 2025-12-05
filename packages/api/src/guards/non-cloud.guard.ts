import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class NonCloudGuard implements CanActivate {
    constructor(private readonly configService: AppConfigService) {}

    canActivate(_context: ExecutionContext): boolean {
        const isCloud = this.configService.isCloud;

        if (isCloud) {
            throw new ForbiddenException(
                'This endpoint is only available in non-cloud environments',
            );
        }

        return true;
    }
}
