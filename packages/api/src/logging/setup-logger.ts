import * as winston from 'winston';
import { createLogger, Logger } from 'winston';
import Transport from 'winston-transport';
import * as CloudWatchTransport from 'winston-cloudwatch';
import { AppConfigService } from '../config/app-config.service';

const logPath = `${__dirname}/../../logs/`;

type LoggerKind = 'api' | 'client';

export const setupLogger = (
    configService: AppConfigService,
    kind: LoggerKind = 'api',
): Logger | undefined => {
    const useCloudWatch = configService.isCloud;

    const format = winston.format.combine(
        winston.format.errors({ stack: true }),
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.prettyPrint(),
    );

    const consoleTransport = new winston.transports.Console({
        format: winston.format.combine(
            winston.format.errors({ stack: true }),
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, stack, context }) => {
                if (stack) {
                    return `${timestamp} ${level}: ${message} - ${stack}`;
                }

                let msg = `${timestamp} ${level}: ${message}`;

                if (context) msg += ` - Context: ${JSON.stringify(context, undefined, 4)}`;

                return msg;
            }),
        ),
    });

    const apiTransports: Transport[] = [consoleTransport];
    const clientTransports: Transport[] = [];

    if (useCloudWatch) {
        const logGroupName = configService.cloudwatchLogGroupName;

        apiTransports.push(
            new CloudWatchTransport({
                name: 'IMG Manager API Application Logs',
                level: 'info',
                logGroupName: logGroupName,
                logStreamName: `${logGroupName}-app`,
                jsonMessage: true,
            }),
            new CloudWatchTransport({
                name: 'IMG Manager API Error Logs',
                level: 'error',
                logGroupName: logGroupName,
                logStreamName: `${logGroupName}-error`,
                jsonMessage: true,
            }),
        );

        clientTransports.push(
            new CloudWatchTransport({
                name: 'IMG Manager Client Application Logs',
                level: 'info',
                logGroupName: logGroupName,
                logStreamName: `${logGroupName}-app`,
                jsonMessage: true,
            }),
            new CloudWatchTransport({
                name: 'IMG Manager Client Error Logs',
                level: 'error',
                logGroupName: logGroupName,
                logStreamName: `${logGroupName}-error`,
                jsonMessage: true,
            }),
        );
    } else {
        apiTransports.push(
            new winston.transports.File({
                filename: 'app.log',
                level: 'info',
                dirname: logPath,
                format: format,
            }),
            new winston.transports.File({
                filename: 'error.log',
                level: 'error',
                dirname: logPath,
                format: format,
            }),
        );
        clientTransports.push(
            new winston.transports.File({
                filename: 'client.log',
                level: 'info',
                dirname: logPath,
                format: format,
            }),
            new winston.transports.File({
                filename: 'client-error.log',
                level: 'error',
                dirname: logPath,
                format: format,
            }),
        );
    }

    if (kind === 'api') {
        return createLogger({
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: apiTransports,
        });
    }
    if (kind === 'client') {
        return createLogger({
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: clientTransports,
        });
    }
};
