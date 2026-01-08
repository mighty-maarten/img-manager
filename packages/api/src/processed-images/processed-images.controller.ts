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
import {
    ApiBearerAuth,
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
} from '@nestjs/swagger';
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

    /**
     * @deprecated Use syncProcessedImagesByLabel instead. This endpoint will be removed in a future version.
     */
    @Post('sync')
    @ApiOperation({
        summary: 'Sync all processed images (DEPRECATED)',
        description:
            '⚠️ DEPRECATED: This endpoint is deprecated and will be removed in a future version. ' +
            'Use POST /api/processed-images/sync/:labelId instead to sync images for a specific label. ' +
            'Scans the entire /processed folder in S3 and syncs all processed images to the database.',
        deprecated: true,
    })
    @ApiResponse({
        status: 200,
        description: 'Sync completed successfully',
        type: SyncProcessedImagesResultContract,
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized',
    })
    async syncProcessedImages(): Promise<SyncProcessedImagesResultContract> {
        return this.processedImagesService.syncProcessedImagesFromStorage();
    }

    @Post('sync/:labelId')
    @ApiOperation({
        summary: 'Sync processed images for a specific label',
        description:
            'Scans the /processed/<label_name> folder in S3 and syncs processed images for the specified label to the database. ' +
            'This operation only processes images in the label-specific folder, making it faster and more efficient than the global sync.',
    })
    @ApiParam({
        name: 'labelId',
        description: 'The UUID of the label to sync processed images for',
        type: String,
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiResponse({
        status: 200,
        description: 'Sync completed successfully',
        type: SyncProcessedImagesResultContract,
    })
    @ApiResponse({
        status: 404,
        description: 'Label not found',
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized',
    })
    async syncProcessedImagesByLabel(
        @Param('labelId') labelId: string,
    ): Promise<SyncProcessedImagesResultContract> {
        return this.processedImagesService.syncProcessedImagesByLabel(labelId);
    }
}
