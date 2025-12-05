export type Label = {
    id: string;
    name: string;
    createdOn: Date;
    lastUpdatedOn: Date;
};

export type CreateLabelRequest = {
    name: string;
};

export type UpdateLabelRequest = {
    name: string;
};
