import { useToastMessages } from '@/composables/toast';
import { ArrayUtil } from '@/utils/array';
import { ref, watch, type Ref } from 'vue';

export type StoreErrorState<T extends string> = { [key in T]: Map<string, Error> };
export type StoreLoadingState<T extends string> = { [key in T]: string[] };

export type BaseStore<T extends string> = {
    loading: StoreLoadingState<T>;
    errors: StoreErrorState<T>;
    isLoading: (action: T, id?: string) => boolean;
    getError: (action: T, id?: string) => Error | undefined;
    hasError: (action: T, id?: string) => boolean;
};

const createStoreLoadingState = <T extends string>(options: T[]) => {
    const state: Record<string, string[]> = {};
    options.forEach((opt) => {
        state[opt] = [];
    });
    return ref(state) as Ref<StoreLoadingState<T>>;
};

const createStoreErrorState = <T extends string>(options: T[]) => {
    const state: Record<string, Map<string, Error>> = {};
    options.forEach((opt) => {
        state[opt] = new Map<string, Error>();
    });
    return ref(state) as Ref<StoreErrorState<T>>;
};

/**
 * This function creates a default loading and error as well as a utility function
 * to wrap functions with
 * */
export const useStoreCreationUtils = <A extends string>(opts: {
    /**
     * Actions that need an error or loading state should be added here
     * */
    actions: A[];
}) => {
    const errors = createStoreErrorState(opts.actions);
    const loading = createStoreLoadingState(opts.actions);

    /**
     * Check if an action is loading, optionally add an ID to check if an action with the specified
     * id is loading
     * */
    function isLoading(action: A, id?: string): boolean {
        if (id) {
            return loading.value[action].includes(id);
        } else {
            return loading.value[action].length > 0;
        }
    }

    /**
     * Get the error of an action. Providing an ID will grab the specific error from the
     * */
    function getError(action: A, id?: string): Error | undefined {
        console.log(action, errors.value, errors.value[action]);
        if (id) {
            return errors.value[action].get(id);
        } else {
            return errors.value[action].values().next().value;
        }
    }

    /**
     * Get the error state of an action. Providing an ID will grab the specific error from the
     * */
    function hasError(action: A, id?: string): boolean {
        if (id) {
            return !!errors.value[action].get(id);
        } else {
            return errors.value[action].size > 0;
        }
    }

    /**
     * Executes a function as an action, keeping track of it's error state and loading state.
     * */
    async function handleAction<R>(
        action: A,
        id: string | undefined,
        fn: () => Promise<R> | R,
    ): Promise<R | undefined> {
        const key = id ? id : action;
        try {
            errors.value[action].delete(key);
            loading.value[action].push(key);
            return await fn();
        } catch (e) {
            errors.value[action].set(key, e as Error);
        } finally {
            if (id) {
                ArrayUtil.removeByMut(loading.value[action], (i) => i === id);
            } else {
                loading.value[action].pop();
            }
        }
    }

    return {
        base: {
            errors,
            isLoading,
            loading,
            getError,
            hasError,
        },
        handleAction,
    };
};

function listenToErrorState<A extends string>(
    store: BaseStore<A>,
    actions: A[],
    hasErrorCallBack: (action: A) => void,
): void {
    actions.forEach((action) => {
        watch(
            () => store.errors[action].size,
            (newError, oldError) => {
                if (newError === 0 || newError <= oldError) return;
                hasErrorCallBack(action);
            },
        );
    });
}

/**
 * This generic function simply makes a toast message for actions you listen to which
 * receive an error.
 * */
export function handleErrorToasts<A extends string>(store: BaseStore<A>, actions: A[]): void {
    const { storeActionToast } = useToastMessages();
    listenToErrorState(store, actions, (action) => {
        storeActionToast(store, action, undefined, {
            title: 'Er ging iets mis',
            description: 'Laat het weten aan je administrator.',
        });
    });
}
