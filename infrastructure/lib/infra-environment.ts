export enum InfraEnvironment {
    DEV = 'dev',
    PROD = 'prod',
}

export const isValidInfraEnvironment = (infraEnvironment?: string): boolean => {
    return (
        infraEnvironment !== undefined &&
        [InfraEnvironment.DEV, InfraEnvironment.PROD].includes(infraEnvironment as InfraEnvironment)
    );
};

export const getValidInfraEnvironment = (infraEnvironment?: string): InfraEnvironment => {
    if (isValidInfraEnvironment(infraEnvironment)) {
        return infraEnvironment as InfraEnvironment;
    } else {
        throw Error(
            `Specified infra environment '${infraEnvironment}' is not a valid infra environment`,
        );
    }
};
