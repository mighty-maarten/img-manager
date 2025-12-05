import { BadRequestException } from '@nestjs/common';

export class VersionUtil {
    public static vesionSectionMinLength: number = 5;

    public static padVersion(version: string): string {
        const splitVersion = version.split('.');
        if (splitVersion.length !== 3) {
            throw new BadRequestException(
                `Version not recognized. Please give a major, medior and minor version number`,
            );
        }
        return splitVersion.map((x) => x.padStart(this.vesionSectionMinLength, '0')).join('.');
    }

    public static unpadVersion(version: string): string {
        const splitVersion = version.split('.');
        if (splitVersion.length !== 3) {
            throw new BadRequestException(
                `Version not recognized. Please give a major, medior and minor version number`,
            );
        }
        return splitVersion.map((x) => VersionUtil.trimStartCharacter(x, '0')).join('.');
    }
    public static trimStartCharacter(str: string, char: string): string {
        while (str.at(0) === char && str.length > 1) {
            str = str.substring(1);
        }
        return str;
    }
}
