export type LoginRequest = {
    email: string;
    password: string;
};

export type LoginResponse = {
    accessToken: string;
    userId: string;
    email: string;
};

export type User = {
    id: string;
    email: string;
};

export type UserInfoResponse = {
    userId: string;
    email: string;
};