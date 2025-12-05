import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from '../database/entities/user.entity';

export class UserContract {
    @ApiProperty()
    public id: string;
    @ApiProperty()
    public email: string;

    constructor(user: UserEntity) {
        this.id = user.id;
        this.email = user.email;
    }
}
