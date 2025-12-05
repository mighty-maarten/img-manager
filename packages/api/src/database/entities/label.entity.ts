import { Column, Entity, ManyToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Collection } from './collection.entity';

@Entity('labels')
export class Label extends BaseEntity {
    @Column({ type: 'text' })
    name!: string;

    @ManyToMany(() => Collection, (collection) => collection.labels)
    collections!: Collection[];
}
