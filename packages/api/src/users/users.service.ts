import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserEntity } from 'src/database/entities/user.entity';
import { UserContract } from './types';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(UserEntity)
        private userRepository: Repository<UserEntity>,
    ) {}

    public async getUsers(): Promise<UserContract[]> {
        const users = await this.userRepository.find();
        return users.map((user) => new UserContract(user));
    }

    public async getUser(userId: string): Promise<UserContract> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
        });
        if (user) {
            return new UserContract(user);
        } else {
            throw UsersService.getUserNotFoundException(userId);
        }
    }

    public async findByEmail(email: string): Promise<UserEntity | null> {
        return await this.userRepository.findOne({
            where: { email },
        });
    }

    private static getUserNotFoundException(userId: string): NotFoundException {
        return new NotFoundException(`User with id '${userId}' was not found`);
    }
}
