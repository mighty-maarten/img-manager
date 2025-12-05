import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UserContract } from './types';
import { routeParams } from '../route-params';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get()
    async getUsers(): Promise<UserContract[]> {
        return this.usersService.getUsers();
    }

    @Get(':userId')
    async getUser(@Param(routeParams.userId) userId: string): Promise<UserContract> {
        return this.usersService.getUser(userId);
    }
}
