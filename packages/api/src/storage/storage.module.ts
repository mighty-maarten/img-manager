import { Module, Logger } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module';
import { LocalFileService } from './local-file.service';
import { CloudFileService } from './cloud-file.service';
import { IFileService } from './types';
import { AppConfigService } from '../config/app-config.service';

@Module({
    imports: [AppConfigModule],
    controllers: [],
    exports: [IFileService],
    providers: [
        CloudFileService,
        LocalFileService,
        {
            provide: IFileService,
            inject: [AppConfigService, LocalFileService, CloudFileService],
            useFactory: (
                configService: AppConfigService,
                localFileService: LocalFileService,
                cloudFileService: CloudFileService,
            ): IFileService => {
                if (configService.isCloud) {
                    return cloudFileService;
                }
                return localFileService;
            },
        },
        Logger,
    ],
})
export class StorageModule {}
