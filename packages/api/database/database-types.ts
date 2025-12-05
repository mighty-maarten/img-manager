export interface SchemaVersion {
    version: number;
    updated_on: string;
}

export interface MigrationVersion {
    version: number;
    filePath: string;
}
