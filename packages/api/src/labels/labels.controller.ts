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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LabelsService } from './labels.service';
import { LabelContract, CreateLabelContract, UpdateLabelContract } from './types';
import { routeParams } from '../route-params';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Labels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class LabelsController {
    constructor(private readonly labelsService: LabelsService) {}

    @Post()
    async createLabel(@Body() contract: CreateLabelContract): Promise<LabelContract> {
        return this.labelsService.createLabel(contract);
    }

    @Get()
    async getLabels(): Promise<LabelContract[]> {
        return this.labelsService.getLabels();
    }

    @Get(':labelId')
    async getLabel(@Param(routeParams.labelId) labelId: string): Promise<LabelContract> {
        return this.labelsService.getLabel(labelId);
    }

    @Put(':labelId')
    async updateLabel(
        @Param(routeParams.labelId) labelId: string,
        @Body() contract: UpdateLabelContract,
    ): Promise<LabelContract> {
        return this.labelsService.updateLabel(labelId, contract);
    }

    @Delete(':labelId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteLabel(@Param(routeParams.labelId) labelId: string): Promise<void> {
        return this.labelsService.deleteLabel(labelId);
    }
}
