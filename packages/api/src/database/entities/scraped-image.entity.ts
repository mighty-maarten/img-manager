import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Scrape } from './scrape.entity';
import { Image } from './image.entity';

@Entity('scraped_images')
export class ScrapedImage extends BaseEntity {
    @Column({ type: 'text' })
    filename!: string;

    @Column({ type: 'text' })
    url!: string;

    @Column({ type: 'text', name: 'source_url' })
    sourceUrl!: string;

    @Column({ type: 'int', nullable: true })
    width?: number;

    @Column({ type: 'int', nullable: true })
    height?: number;

    @Column({ type: 'int', nullable: true, name: 'file_size' })
    fileSize?: number;

    @Column({ type: 'text', nullable: true })
    format?: string;

    @Column({ type: 'timestamptz', nullable: true, name: 'stored_on' })
    storedOn?: Date;

    @ManyToOne(() => Scrape, (scrape) => scrape.scrapedImages)
    @JoinColumn({ name: 'scrape_id' })
    scrape!: Scrape;

    @ManyToOne(() => Image)
    @JoinColumn({ name: 'image_id' })
    image?: Image;
}
