import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { HttpStatusCode } from 'axios';
import { randomUUID } from 'crypto';
import { AppConfigService } from '../config/app-config.service';
import { SnsUtil } from 'src/utils/sns.util';

@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalErrorFilter.name);

    constructor(private configService: AppConfigService) {}

    async catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();

        const httpStatus =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;
        const correlationId = randomUUID();

        if (
            httpStatus !== HttpStatusCode.ServiceUnavailable &&
            httpStatus !== HttpStatusCode.Unauthorized &&
            httpStatus !== HttpStatusCode.NotFound
        ) {
            const message =
                exception instanceof HttpException
                    ? exception.message
                    : HttpStatus.INTERNAL_SERVER_ERROR;
            const logMessage = (<Error>exception).stack ?? exception;
            this.logger.error(`Error: ${message} - Correlation ID: ${correlationId}`, logMessage);
            if (this.configService.isCloud) {
                await SnsUtil.logErrorMessageToSNS(
                    this.configService.snsErrorTopicArn,
                    `Error: ${message} - Correlation ID: ${correlationId} - ${logMessage}`,
                );
            }
        }

        response.status(httpStatus).json({
            error: exception instanceof HttpException ? exception.name : undefined,
            statusCode: httpStatus,
            correlationId: correlationId,
            timestamp: new Date().toISOString(),
            message: exception instanceof Error ? exception.message : undefined,
            path: request.url,
        });
    }
}
