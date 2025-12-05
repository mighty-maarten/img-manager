import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ProcessingRun } from './processing-run.entity';
import { Image } from './image.entity';

@Entity('processed_images')
export class ProcessedImage extends BaseEntity {
    @Column({ type: 'text' })
    filename!: string;

    @Column({ type: 'text' })
    bucket!: string;

    @Column({ type: 'text' })
    key!: string;

    @Column({ type: 'boolean', default: false })
    hidden!: boolean;

    @Column({ type: 'boolean', default: false })
    flagged!: boolean;

    @Column({ type: 'int', nullable: true })
    score?: number;

    @ManyToOne(() => ProcessingRun)
    @JoinColumn({ name: 'processing_run_id' })
    processingRun!: ProcessingRun;

    @ManyToOne(() => Image)
    @JoinColumn({ name: 'source_image_id' })
    sourceImage!: Image;
}
