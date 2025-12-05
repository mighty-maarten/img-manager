import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('versions')
export class VersionEntity {
    @PrimaryColumn({
        nullable: false,
    })
    version!: number;

    @Column({ type: 'timestamptz' })
    updatedOn!: Date;
}
