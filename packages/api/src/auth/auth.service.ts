import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { JwtPayload, LoginResponseContract } from './types';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
    ) {}

    public async login(email: string, password: string): Promise<LoginResponseContract> {
        const user = await this.usersService.findByEmail(email);

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
        };

        const accessToken = await this.jwtService.signAsync(payload);

        return new LoginResponseContract(accessToken, user.id, user.email);
    }

    public async validateUser(userId: string): Promise<boolean> {
        const user = await this.usersService.getUser(userId);
        return !!user;
    }
}
