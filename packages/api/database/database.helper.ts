import { DataSource } from 'typeorm';
import * as fs from 'fs';

export class DatabaseHelper {
    public static async processSqlFile(fileName: string, dataSource: DataSource): Promise<void> {
        console.log(`Processing file: ${fileName}`);
        const query = fs.readFileSync(fileName).toString();
        await dataSource.manager.query(query);
    }

    public static async processSqlFileOnManager(
        fileName: string,
        mainDataSource: DataSource,
    ): Promise<void> {
        console.log(`Processing file: ${fileName}`);
        const fileContent = fs.readFileSync(fileName).toString().trim();
        if (
            !(fileContent.startsWith('begin;') || fileContent.startsWith('BEGIN;')) ||
            !(fileContent.endsWith('commit;') || fileContent.endsWith('COMMIT;'))
        ) {
            console.log(
                `Migration ${fileName} does not include a transaction. Please start your file with BEGIN and end with COMMIT`,
            );
            throw `Migration ${fileName} does not include a transaction. Please start your file with BEGIN and end with COMMIT`;
        }
        await mainDataSource.query(fileContent);
    }
}
