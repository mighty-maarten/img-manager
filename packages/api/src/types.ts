import { ApiProperty } from '@nestjs/swagger';

export interface SortMeta {
    field: string;
    order: 1 | -1;
}

export class PagedResult<TEntity> {
    @ApiProperty()
    public results: TEntity[];

    @ApiProperty()
    public count: number;

    constructor(results: TEntity[], count: number) {
        this.results = results;
        this.count = count;
    }
}
