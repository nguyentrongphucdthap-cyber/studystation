import { useState, useCallback } from 'react';

interface FirestoreState<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
}

export function useFirestoreRequest<T>() {
    const [state, setState] = useState<FirestoreState<T>>({
        data: null,
        loading: false,
        error: null,
    });

    const execute = useCallback(async (request: () => Promise<T>) => {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        try {
            const result = await request();
            setState({ data: result, loading: false, error: null });
            return result;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Unknown error');
            setState({ data: null, loading: false, error });
            throw error;
        }
    }, []);

    return { ...state, execute };
}
