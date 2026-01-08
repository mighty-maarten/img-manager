import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { ProcessedImage } from '../database/entities/processed-image.entity';

export class CollectionReferenceContract {
    @ApiProperty({ description: 'Collection ID' })
    public id: string;

    @ApiProperty({ description: 'Collection URL' })
    public url: string;

    constructor(id: string, url: string) {
        this.id = id;
        this.url = url;
    }
}

export class FakeProcessImagesContract {
    @ApiProperty({ description: 'Label name for processing images' })
    @IsString()
    @IsNotEmpty()
    public labelName!: string;
}

export class FakeProcessImagesResultContract {
    @ApiProperty({ description: 'Number of images processed' })
    public processed: number;

    @ApiProperty({ type: [String], description: 'Array of error messages' })
    public errors: string[];

    constructor(processed: number, errors: string[]) {
        this.processed = processed;
        this.errors = errors;
    }
}

export class ProcessedImageContract {
    @ApiProperty({ description: 'Processed image ID' })
    public id: string;

    @ApiProperty({ description: 'Image filename' })
    public filename: string;

    @ApiProperty({ description: 'Storage bucket name' })
    public bucket: string;

    @ApiProperty({ description: 'Storage key/path' })
    public key: string;

    @ApiProperty({ description: 'Presigned URL for accessing the image' })
    public url: string;

    @ApiProperty({ description: 'Whether the image is hidden' })
    public hidden: boolean;

    @ApiProperty({ description: 'Whether the image is flagged' })
    public flagged: boolean;

    @ApiProperty({ description: 'Optional score (0-5)', required: false })
    public score?: number;

    @ApiProperty({ description: 'Creation timestamp' })
    public createdOn: Date;

    @ApiProperty({ description: 'Last update timestamp' })
    public lastUpdatedOn: Date;

    @ApiProperty({
        type: [CollectionReferenceContract],
        description: 'Collections this image belongs to (via processing runs)',
        required: false,
    })
    public collections?: CollectionReferenceContract[];

    constructor(
        processedImage: ProcessedImage,
        url: string,
        collections?: CollectionReferenceContract[],
    ) {
        this.id = processedImage.id;
        this.filename = processedImage.filename;
        this.bucket = processedImage.bucket;
        this.key = processedImage.key;
        this.url = url;
        this.hidden = processedImage.hidden;
        this.flagged = processedImage.flagged;
        this.score = processedImage.score;
        this.createdOn = processedImage.createdOn;
        this.lastUpdatedOn = processedImage.lastUpdatedOn;
        this.collections = collections;
    }
}

export class SyncProcessedImagesResultContract {
    @ApiProperty({ description: 'Number of processed images successfully synced' })
    public processed: number;

    @ApiProperty({ description: 'Number of processed images skipped' })
    public skipped: number;

    @ApiProperty({ description: 'Number of processed images that failed to sync' })
    public failed: number;

    @ApiProperty({
        type: [String],
        description: 'Array of error messages for failed syncs',
    })
    public errors: string[];

    constructor(processed: number, skipped: number, failed: number, errors: string[]) {
        this.processed = processed;
        this.skipped = skipped;
        this.failed = failed;
        this.errors = errors;
    }
}

export class UpdateProcessedImageHiddenContract {
    @ApiProperty({ description: 'Whether the image should be hidden' })
    @IsBoolean()
    public hidden!: boolean;
}

export class UpdateProcessedImageFlaggedContract {
    @ApiProperty({ description: 'Whether the image should be flagged' })
    @IsBoolean()
    public flagged!: boolean;
}

export class UpdateProcessedImageScoreContract {
    @ApiProperty({ description: 'Score for the image (0-5)', required: false })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(5)
    public score?: number;
}
