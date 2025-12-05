import { Injectable } from '@nestjs/common';
import * as sharp from 'sharp';

@Injectable()
export class ImageService {
    async optimiseImageBuffer(buffer: Buffer): Promise<Buffer> {
        return sharp(buffer)
            .resize({ width: 1600 }) // Make sure images are never wider than 1600px
            .webp({ quality: 90 }) // Convert to WEBP format with 90% quality
            .toBuffer();
    }
}
