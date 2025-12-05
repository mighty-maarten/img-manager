import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginContract, LoginResponseContract, UserInfoContract } from './types';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('auth')
@Controller()
export class AuthController {
    constructor(private authService: AuthService) {}

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login with email and password' })
    @ApiResponse({
        status: 200,
        description: 'Successfully logged in',
        type: LoginResponseContract,
    })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    public async login(@Body() loginContract: LoginContract): Promise<LoginResponseContract> {
        return await this.authService.login(loginContract.email, loginContract.password);
    }

    @Get('current-user')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user information' })
    @ApiResponse({
        status: 200,
        description: 'Successfully retrieved user information',
        type: UserInfoContract,
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    public async getCurrentUser(@Request() req: any): Promise<UserInfoContract> {
        return new UserInfoContract(req.user.sub, req.user.email);
    }
}
