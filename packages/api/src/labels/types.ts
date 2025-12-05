import { ApiProperty } from '@nestjs/swagger';
import { Label } from '../database/entities/label.entity';
import { IsNotEmpty, IsString } from 'class-validator';

export class LabelContract {
    @ApiProperty()
    public id: string;

    @ApiProperty()
    public name: string;

    @ApiProperty()
    public createdOn: Date;

    @ApiProperty()
    public lastUpdatedOn: Date;

    constructor(label: Label) {
        this.id = label.id;
        this.name = label.name;
        this.createdOn = label.createdOn;
        this.lastUpdatedOn = label.lastUpdatedOn;
    }
}

export class CreateLabelContract {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    public name!: string;
}

export class UpdateLabelContract {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    public name!: string;
}
