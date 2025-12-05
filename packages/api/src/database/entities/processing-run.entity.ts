import { Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Collection } from './collection.entity';
import { Label } from './label.entity';

@Entity('processing_runs')
export class ProcessingRun extends BaseEntity {
    @ManyToOne(() => Collection)
    @JoinColumn({ name: 'collection_id' })
    collection!: Collection;

    @ManyToOne(() => Label)
    @JoinColumn({ name: 'label_id' })
    label!: Label;
}
