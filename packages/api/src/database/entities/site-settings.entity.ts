import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('site_settings')
export class SiteSettingsEntity extends BaseEntity {
    @Column()
    isMaintenance!: boolean;
}
