import { AppConfig } from '@/app.config';
import axios, {
    type AxiosInstance,
    type AxiosRequestConfig,
    type AxiosResponseTransformer,
} from 'axios';

export class HttpClient {
    public static async get<TResp>(
        url: string,
        searchParameters?: URLSearchParams,
    ): Promise<TResp> {
        const client = await this.client();
        const response = await client.get<TResp>(url, {
            params: searchParameters,
        });
        return response?.data as TResp;
    }

    public static async post<TPayload, TResp>(
        url: string,
        payload: TPayload,
        searchParameters?: URLSearchParams,
    ): Promise<TResp> {
        const client = await this.client();
        const response = await client.post<TResp>(url, payload, {
            params: searchParameters,
        });
        return response.data as TResp;
    }

    public static async put<TPayload, TResp>(
        url: string,
        payload: TPayload,
        searchParameters?: URLSearchParams,
    ): Promise<TResp> {
        const client = await this.client();
        const response = await client.put<TResp>(url, payload, {
            params: searchParameters,
        });
        return response.data as TResp;
    }

    public static async patch<TPayload, TResp>(
        url: string,
        payload: TPayload,
        searchParameters?: URLSearchParams,
    ): Promise<TResp> {
        const client = await this.client();
        const response = await client.patch<TResp>(url, payload, {
            params: searchParameters,
        });
        return response.data as TResp;
    }

    public static async delete<TResp>(
        url: string,
        searchParameters?: URLSearchParams,
    ): Promise<TResp> {
        const client = await this.client();
        const response = await client.delete<TResp>(url, {
            params: searchParameters,
        });
        return response.data as TResp;
    }

    private static async buildHeaders(headers?: {
        [key: string]: string | number;
    }): Promise<Record<string, string | number | boolean>> {
        // Dynamically import to avoid circular dependencies
        const { useAuthStore } = await import('@/stores/auth');
        const authStore = useAuthStore();
        const token = authStore.accessToken || '';

        const baseHeaders: Record<string, string | number | boolean> = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
        };

        if (headers) {
            return { ...baseHeaders, ...headers };
        }
        return baseHeaders;
    }

    private static transformResponse(
        input: string,
    ): AxiosResponseTransformer | AxiosResponseTransformer[] {
        try {
            return JSON.parse(input);
        } catch (e: unknown) {
            console.error('Failed to parse response:', (e as Error).message);
            throw new Error('Failed to parse response');
        }
    }

    private static async client(header = {}): Promise<AxiosInstance> {
        const controller = new AbortController();
        const config: AxiosRequestConfig = {
            baseURL: AppConfig.apiUrl,
            signal: controller.signal,
            headers: await this.buildHeaders(header),
        };

        config.transformResponse = [
            (data, headers) => {
                const contentTypeIsJson = headers['content-type']?.includes('application/json');
                if (!contentTypeIsJson) {
                    console.log('Warning: content type is not json as expected');
                }

                return data && typeof data === 'string' && contentTypeIsJson
                    ? this.transformResponse(data)
                    : data;
            },
        ];

        return axios.create(config);
    }
}
