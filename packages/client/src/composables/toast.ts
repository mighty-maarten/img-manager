import type { ApiError } from '@/api/services/types/api';
import type { BaseStore } from '@/stores/util';
import { AxiosError } from 'axios';
import { useToast } from 'primevue';

export function useToastMessages() {
    const toast = useToast();

    const ttl = 3000;

    function sendToast(
        severity: 'success' | 'info' | 'warn' | 'error' | 'secondary' | 'contrast',
        title: string,
        description: string,
        life: number | undefined,
    ) {
        toast.add({
            severity,
            summary: title,
            detail: description,
            life,
        });
    }

    function infoToast(title: string, description: string) {
        sendToast('info', title, description, ttl);
    }

    function successToast(title: string, description: string) {
        sendToast('success', title, description, ttl);
    }

    function errorToast(title: string, description: string) {
        sendToast('error', title, description, undefined);
    }

    function warnToast(title: string, description: string) {
        sendToast('warn', title, description, ttl);
    }

    function storeActionToast<A extends string>(
        store: BaseStore<A>,
        action: A,
        success:
            | {
                  title: string;
                  description: string;
              }
            | undefined,
        error:
            | {
                  title: string;
                  description: string;
              }
            | undefined,
    ) {
        const errObj = store.getError(action);
        if (errObj) {
            let correlationId: string | undefined = undefined;
            if (errObj instanceof AxiosError) {
                const data = errObj.response?.data as ApiError | undefined;
                correlationId = data?.correlationId;
            }
            if (error)
                errorToast(
                    error.title,
                    correlationId
                        ? `${error.description}\n(Correlation ID: ${correlationId})`
                        : error.description,
                );
        } else {
            if (success) successToast(success.title, success.description);
        }
    }

    return {
        infoToast,
        successToast,
        errorToast,
        warnToast,
        storeActionToast,
    };
}
