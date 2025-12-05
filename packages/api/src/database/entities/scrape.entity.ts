import { Column, Entity, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Collection } from './collection.entity';
import { ScrapedImage } from './scraped-image.entity';
import { ImageSizePreset, ScrapingMode } from '../../scraping/types';

@Entity('scrapes')
export class Scrape extends BaseEntity {
    @Column({ type: 'text', name: 'size_preset' })
    sizePreset!: ImageSizePreset;

    @Column({ type: 'text', name: 'scraping_mode' })
    scrapingMode!: ScrapingMode;

    @Column({ type: 'text', array: true, default: '{}' })
    errors!: string[];

    @Column({ type: 'text', array: true, default: '{}' })
    tags!: string[];

    @Column({ type: 'text', array: true, default: '{}' })
    categories!: string[];

    @Column({ type: 'text', array: true, default: '{}' })
    models!: string[];

    @Column({ type: 'text' })
    title!: string;

    @Column({ type: 'boolean', default: false })
    stored!: boolean;

    @OneToOne(() => Collection, (collection) => collection.scrape)
    @JoinColumn({ name: 'collection_id' })
    collection!: Collection;

    @OneToMany(() => ScrapedImage, (scrapedImage) => scrapedImage.scrape)
    scrapedImages!: ScrapedImage[];
}
