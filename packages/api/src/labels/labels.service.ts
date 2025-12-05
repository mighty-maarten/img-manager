import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Label } from 'src/database/entities/label.entity';
import { LabelContract, CreateLabelContract, UpdateLabelContract } from './types';

@Injectable()
export class LabelsService {
    constructor(
        @InjectRepository(Label)
        private labelRepository: Repository<Label>,
    ) {}

    public async getLabels(): Promise<LabelContract[]> {
        const labels = await this.labelRepository.find({
            order: { name: 'ASC' },
        });
        return labels.map((label) => new LabelContract(label));
    }

    public async getLabel(labelId: string): Promise<LabelContract> {
        const label = await this.labelRepository.findOne({
            where: { id: labelId },
        });
        if (label) {
            return new LabelContract(label);
        } else {
            throw LabelsService.getLabelNotFoundException(labelId);
        }
    }

    public async createLabel(createLabelContract: CreateLabelContract): Promise<LabelContract> {
        const existingLabel = await this.labelRepository.findOne({
            where: { name: createLabelContract.name },
        });

        if (existingLabel) {
            throw new ConflictException(
                `Label with name '${createLabelContract.name}' already exists`,
            );
        }

        const label = await this.labelRepository.save(
            this.labelRepository.create({
                name: createLabelContract.name,
            }),
        );

        return new LabelContract(label);
    }

    public async updateLabel(
        labelId: string,
        updateLabelContract: UpdateLabelContract,
    ): Promise<LabelContract> {
        const label = await this.labelRepository.findOne({
            where: { id: labelId },
        });

        if (!label) {
            throw LabelsService.getLabelNotFoundException(labelId);
        }

        const existingLabel = await this.labelRepository.findOne({
            where: { name: updateLabelContract.name },
        });

        if (existingLabel && existingLabel.id !== labelId) {
            throw new ConflictException(
                `Label with name '${updateLabelContract.name}' already exists`,
            );
        }

        label.name = updateLabelContract.name;
        await this.labelRepository.save(label);

        return new LabelContract(label);
    }

    public async deleteLabel(labelId: string): Promise<void> {
        const label = await this.labelRepository.findOne({
            where: { id: labelId },
        });

        if (!label) {
            throw LabelsService.getLabelNotFoundException(labelId);
        }

        await this.labelRepository.remove(label);
    }

    private static getLabelNotFoundException(labelId: string): NotFoundException {
        return new NotFoundException(`Label with id '${labelId}' was not found`);
    }
}
