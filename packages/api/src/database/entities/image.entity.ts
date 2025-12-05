import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Collection } from './collection.entity';

@Entity('images')
export class Image extends BaseEntity {
    @Column({ type: 'text' })
    hash!: string;

    @Column({ type: 'text' })
    filename!: string;

    @Column({ type: 'text' })
    url!: string;

    @Column({ type: 'text' })
    bucket!: string;

    @Column({ type: 'text' })
    key!: string;

    @ManyToMany(() => Collection)
    @JoinTable({
        name: 'images_collections',
        joinColumn: { name: 'image_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'collection_id', referencedColumnName: 'id' },
    })
    collections!: Collection[];
}
