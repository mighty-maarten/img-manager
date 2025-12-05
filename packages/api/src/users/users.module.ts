import { Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UserEntity } from '../database/entities/user.entity';
import { UsersController } from './users.controller';
import { AppConfigService } from '../config/app-config.service';
import { ConfigService } from '@nestjs/config';

@Module({
    imports: [TypeOrmModule.forFeature([UserEntity])],
    controllers: [UsersController],
    providers: [UsersService, Logger, AppConfigService, ConfigService],
    exports: [UsersService],
})
export class UsersModule {}
