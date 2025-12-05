import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginContract {
    @ApiProperty()
    @IsEmail()
    @IsNotEmpty()
    public email!: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    public password!: string;
}

export class UserInfoContract {
    @ApiProperty()
    public userId: string;

    @ApiProperty()
    public email: string;

    constructor(userId: string, email: string) {
        this.userId = userId;
        this.email = email;
    }
}

export class LoginResponseContract extends UserInfoContract {
    @ApiProperty()
    public accessToken: string;

    constructor(accessToken: string, userId: string, email: string) {
        super(userId, email);
        this.accessToken = accessToken;
    }
}

export interface JwtPayload {
    sub: string;
    email: string;
}
