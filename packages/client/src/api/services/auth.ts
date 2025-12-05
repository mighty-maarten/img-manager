import { HttpClient } from '@/api/http-client';
import type { LoginRequest, LoginResponse, UserInfoResponse } from './types/auth';

export class AuthService {
    private static readonly BASE_PATH = '/auth';

    public static async login(credentials: LoginRequest): Promise<LoginResponse> {
        return HttpClient.post<LoginRequest, LoginResponse>(
            `${this.BASE_PATH}/login`,
            credentials,
        );
    }

    public static async getCurrentUser(): Promise<UserInfoResponse> {
        return HttpClient.get<UserInfoResponse>(`${this.BASE_PATH}/current-user`);
    }
}