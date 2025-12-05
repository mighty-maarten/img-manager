import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';
import { AppConfigModule } from '../config/app-config.module';
import { AppConfigService } from '../config/app-config.service';

@Module({
    imports: [
        UsersModule,
        PassportModule,
        AppConfigModule,
        JwtModule.registerAsync({
            imports: [AppConfigModule],
            inject: [AppConfigService],
            useFactory: (configService: AppConfigService): JwtModuleOptions => ({
                secret: configService.jwtSecret,
                signOptions: {
                    expiresIn: configService.jwtExpiresIn as any,
                },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy],
    exports: [AuthService],
})
export class AuthModule {}
