import { Controller, Get } from '@nestjs/common';

export const HEALTH_CHECK_ENDPOINT = 'status';

@Controller()
export class AppController {
    constructor() {}

    @Get(HEALTH_CHECK_ENDPOINT)
    async getHealth(): Promise<void> {}
}
