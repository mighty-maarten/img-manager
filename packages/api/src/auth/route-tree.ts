import { RouteTree } from '@nestjs/core';
import { AuthModule } from './auth.module';

export const authRouteTree: RouteTree = {
    path: 'auth',
    module: AuthModule,
};
