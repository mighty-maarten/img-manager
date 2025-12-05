import { Column, Entity, JoinTable, ManyToMany, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Label } from './label.entity';
import { Scrape } from './scrape.entity';
import { ProcessingRun } from './processing-run.entity';

@Entity('collections')
export class Collection extends BaseEntity {
    @Column({ type: 'text' })
    url!: string;

    @ManyToMany(() => Label, (label) => label.collections)
    @JoinTable({
        name: 'collections_labels',
        joinColumn: { name: 'collection_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'label_id', referencedColumnName: 'id' },
    })
    labels!: Label[];

    @OneToOne(() => Scrape, (scrape) => scrape.collection)
    scrape?: Scrape;

    @OneToMany(() => ProcessingRun, (processingRun) => processingRun.collection)
    processingRuns?: ProcessingRun[];
}
