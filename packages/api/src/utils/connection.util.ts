export class CollectionUtil {
    public static groupBy<T, K extends keyof T>(array: T[], key: K): Map<T[K], T[]> {
        const map = new Map<T[K], T[]>();

        for (const item of array) {
            const keyValue = item[key];
            if (!map.has(keyValue)) {
                map.set(keyValue, []);
            }
            map.get(keyValue)!.push(item);
        }

        return map;
    }

    public static groupBySub<T, K extends keyof T, S extends keyof T[K]>(
        array: T[],
        key: K,
        subKey: S,
    ): Map<T[K][S], T[]> {
        const map = new Map<T[K][S], T[]>();

        for (const item of array) {
            const keyValue = item[key][subKey];
            if (!map.has(keyValue)) {
                map.set(keyValue, []);
            }
            map.get(keyValue)!.push(item);
        }

        return map;
    }
}
