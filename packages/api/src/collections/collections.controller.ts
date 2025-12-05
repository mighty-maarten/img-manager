import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    UseGuards,
    HttpCode,
    HttpStatus,
    Query,
    BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CollectionsService } from './collections.service';
import {
    CollectionContract,
    CollectionDownloadUrlsContract,
    CreateCollectionsContract,
    CreateCollectionsResultContract,
    ScrapeCollectionContract,
    UpdateCollectionContract,
} from './types';
import { routeParams } from '../route-params';
import { ScrapeResultContract } from '../scraping/types';
import { PagedResult } from '../types';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Collections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class CollectionsController {
    constructor(private readonly collectionsService: CollectionsService) {}

    @Post('')
    async createCollections(
        @Body() contract: CreateCollectionsContract,
    ): Promise<CreateCollectionsResultContract> {
        return this.collectionsService.createCollections(contract);
    }

    @Get()
    async getCollections(
        @Query('take') take?: number,
        @Query('skip') skip?: number,
        @Query('sort') sort?: string,
        @Query('scraped') scraped?: boolean,
        @Query('stored') stored?: boolean,
        @Query('processed') processed?: boolean,
        @Query('labelIds') labelIds?: string,
    ): Promise<PagedResult<CollectionContract>> {
        let sortObject;
        try {
            sortObject = sort ? JSON.parse(sort) : undefined;
        } catch (e) {
            throw new BadRequestException('Sort query is not a valid JSON object');
        }

        // Parse labelIds from comma-separated string to array
        const labelIdsArray = labelIds
            ? labelIds
                  .split(',')
                  .map((id) => id.trim())
                  .filter((id) => id.length > 0)
            : undefined;

        return this.collectionsService.getCollections(
            take,
            skip,
            sortObject,
            scraped,
            stored,
            processed,
            labelIdsArray,
        );
    }

    @Get(':collectionId')
    async getCollection(
        @Param(routeParams.collectionId) collectionId: string,
    ): Promise<CollectionContract> {
        return this.collectionsService.getCollection(collectionId);
    }

    @Put(':collectionId')
    async updateCollection(
        @Param(routeParams.collectionId) collectionId: string,
        @Body() contract: UpdateCollectionContract,
    ): Promise<CollectionContract> {
        return this.collectionsService.updateCollection(collectionId, contract);
    }

    @Delete(':collectionId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteCollection(@Param(routeParams.collectionId) collectionId: string): Promise<void> {
        return this.collectionsService.deleteCollection(collectionId);
    }

    @Post(':collectionId/scrape')
    async scrapeCollection(
        @Param(routeParams.collectionId) collectionId: string,
        @Body() contract: ScrapeCollectionContract,
    ): Promise<ScrapeResultContract> {
        return this.collectionsService.scrapeCollection(collectionId, contract);
    }

    @Get(':collectionId/scrape/:scrapeId')
    async getScrapeResult(
        @Param(routeParams.collectionId) collectionId: string,
        @Param(routeParams.scrapeId) scrapeId: string,
    ): Promise<ScrapeResultContract> {
        return this.collectionsService.getScrapeResult(collectionId, scrapeId);
    }

    @Post(':collectionId/scrape/:scrapeId/store')
    async storeScrape(
        @Param(routeParams.collectionId) collectionId: string,
        @Param(routeParams.scrapeId) scrapeId: string,
    ): Promise<{ stored: number; failed: number; errors: string[] }> {
        return this.collectionsService.storeScrape(collectionId, scrapeId);
    }

    @Get(':collectionId/download')
    async getCollectionDownloadUrls(
        @Param(routeParams.collectionId) collectionId: string,
    ): Promise<CollectionDownloadUrlsContract> {
        return this.collectionsService.getCollectionDownloadUrls(collectionId);
    }
}
