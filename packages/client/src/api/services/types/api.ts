export type ApiError = {
    statusCode: number;
    correlationId: string;
    timestamp: string;
    message: string;
    path: string;
};
