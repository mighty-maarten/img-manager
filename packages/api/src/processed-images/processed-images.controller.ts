import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
    BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProcessedImagesService } from './processed-images.service';
import {
    FakeProcessImagesContract,
    FakeProcessImagesResultContract,
    ProcessedImageContract,
    SyncProcessedImagesResultContract,
    UpdateProcessedImageHiddenContract,
    UpdateProcessedImageFlaggedContract,
    UpdateProcessedImageScoreContract,
} from './types';
import { PagedResult } from '../types';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { NonCloudGuard } from '../guards/non-cloud.guard';

@ApiTags('Processed Images')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ProcessedImagesController {
    constructor(private readonly processedImagesService: ProcessedImagesService) {}

    @Post('fake-process')
    @UseGuards(NonCloudGuard)
    async fakeProcessImages(
        @Body() contract: FakeProcessImagesContract,
    ): Promise<FakeProcessImagesResultContract> {
        return this.processedImagesService.fakeProcessImages(contract.labelName);
    }

    @Get('runs/:runId')
    async getProcessedImagesForRun(
        @Param('runId') runId: string,
        @Query('take') take?: number,
        @Query('skip') skip?: number,
        @Query('sort') sort?: string,
        @Query('hidden') hidden?: boolean,
        @Query('flagged') flagged?: boolean,
        @Query('minimalScore') minimalScore?: number,
        @Query('labelIds') labelIds?: string | string[],
    ): Promise<PagedResult<ProcessedImageContract>> {
        let sortObject;
        try {
            sortObject = sort ? JSON.parse(sort) : undefined;
        } catch (e) {
            throw new BadRequestException('Sort query is not a valid JSON object');
        }

        // Normalize labelIds to array
        const normalizedLabelIds = labelIds
            ? Array.isArray(labelIds)
                ? labelIds
                : labelIds.split(',')
            : undefined;

        return this.processedImagesService.getProcessedImages(
            runId,
            take,
            skip,
            sortObject,
            hidden,
            flagged,
            minimalScore,
            normalizedLabelIds,
        );
    }

    @Get('')
    async getProcessedImages(
        @Query('take') take?: number,
        @Query('skip') skip?: number,
        @Query('sort') sort?: string,
        @Query('hidden') hidden?: boolean,
        @Query('flagged') flagged?: boolean,
        @Query('minimalScore') minimalScore?: number,
        @Query('labelIds') labelIds?: string | string[],
    ): Promise<PagedResult<ProcessedImageContract>> {
        let sortObject;
        try {
            sortObject = sort ? JSON.parse(sort) : undefined;
        } catch (e) {
            throw new BadRequestException('Sort query is not a valid JSON object');
        }

        // Normalize labelIds to array
        const normalizedLabelIds = labelIds
            ? Array.isArray(labelIds)
                ? labelIds
                : labelIds.split(',')
            : undefined;

        return this.processedImagesService.getProcessedImages(
            undefined,
            take,
            skip,
            sortObject,
            hidden,
            flagged,
            minimalScore,
            normalizedLabelIds,
        );
    }

    @Get(':id')
    async getProcessedImageById(@Param('id') id: string): Promise<ProcessedImageContract> {
        return this.processedImagesService.getProcessedImageById(id);
    }

    @Patch(':id/hidden')
    async updateProcessedImageHidden(
        @Param('id') id: string,
        @Body() contract: UpdateProcessedImageHiddenContract,
    ): Promise<ProcessedImageContract> {
        return this.processedImagesService.updateProcessedImageHidden(id, contract);
    }

    @Patch(':id/flagged')
    async updateProcessedImageFlagged(
        @Param('id') id: string,
        @Body() contract: UpdateProcessedImageFlaggedContract,
    ): Promise<ProcessedImageContract> {
        return this.processedImagesService.updateProcessedImageFlagged(id, contract);
    }

    @Patch(':id/score')
    async updateProcessedImageScore(
        @Param('id') id: string,
        @Body() contract: UpdateProcessedImageScoreContract,
    ): Promise<ProcessedImageContract> {
        return this.processedImagesService.updateProcessedImageScore(id, contract);
    }

    @Post('sync')
    async syncProcessedImages(): Promise<SyncProcessedImagesResultContract> {
        return this.processedImagesService.syncProcessedImagesFromStorage();
    }
}
