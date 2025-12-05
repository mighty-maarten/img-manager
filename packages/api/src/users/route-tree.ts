import { RouteTree } from '@nestjs/core';
import { UsersModule } from './users.module';

export const usersRouteTree: RouteTree = {
    path: 'users',
    module: UsersModule,
};
