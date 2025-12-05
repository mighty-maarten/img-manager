import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
    constructor(private configService: ConfigService) {}

    public getDatabaseConfig(): DatabaseConfig {
        return {
            host: this.configService.get<string>(`database.host`)!,
            port: this.configService.get<number>(`database.port`)!,
            username: this.configService.get<string>(`database.username`)!,
            password: this.configService.get<string>(`database.password`)!,
            database: this.configService.get<string>(`database.database`)!,
            ssl: this.configService.get<boolean>(`database.ssl`)!,
        };
    }

    public get allowDatabaseSetup(): boolean {
        return this.configService.get<boolean>('app.allowDatabaseSetup')!;
    }

    public get appPort(): number {
        return this.configService.get<number>('app.port')!;
    }

    public get allowedOrigins(): string[] {
        return this.configService.get<string>('app.allowedOrigins')!.split(',');
    }

    public get isCloud(): boolean {
        return this.configService.get<boolean>('app.isCloud')!;
    }

    public get localStoragePath(): string {
        return this.configService.get<string>('app.localStoragePath')!;
    }

    public get cloudwatchLogGroupName(): string {
        return this.configService.get<string>('app.cloudwatchLogGroupName')!;
    }

    public get snsErrorTopicArn(): string {
        return this.configService.get<string>('app.snsErrorTopicArn')!;
    }

    public get jwtSecret(): string {
        return this.configService.get<string>('jwt.secret')!;
    }

    public get jwtExpiresIn(): string {
        return this.configService.get<string>('jwt.expiresIn')!;
    }

    public get assetsBucketName(): string {
        return this.configService.get<string>('app.assetsBucketName')!;
    }
}

export interface AppConfig {
    port: number;
    allowDatabaseSetup: boolean;
    allowedOrigins: string;
    cloudwatchLogGroupName: string;
    snsErrorTopicArn: string;
    localStoragePath: string;
    assetsBucketName: string;
}

export interface JwtConfig {
    secret: string;
    expiresIn: string;
}

export interface DatabaseConfig {
    username: string;
    password: string;
    port: number;
    host: string;
    database: string;
    ssl: boolean;
}
