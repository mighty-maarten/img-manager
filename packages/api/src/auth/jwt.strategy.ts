import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from '../config/app-config.service';
import { JwtPayload } from './types';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private configService: AppConfigService,
        private authService: AuthService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.jwtSecret,
        });
    }

    async validate(payload: JwtPayload): Promise<JwtPayload> {
        if (!payload.sub || !payload.email) {
            throw new UnauthorizedException();
        }

        try {
            const userValid = await this.authService.validateUser(payload.sub);
            if (userValid) {
                return payload;
            } else {
                throw new UnauthorizedException('User is not valid');
            }
        } catch (error) {
            throw new UnauthorizedException('User is not valid');
        }
    }
}
