export class MapUtil {
    static someValues<K, V>(map: Map<K, V>, predicate: (value: V, key: K) => boolean): boolean {
        for (const [key, value] of map.entries()) {
            if (predicate(value, key)) {
                return true;
            }
        }
        return false;
    }

    static everyValue<K, V>(map: Map<K, V>, predicate: (value: V, key: K) => boolean): boolean {
        for (const [key, value] of map.entries()) {
            if (!predicate(value, key)) {
                return false;
            }
        }
        return true;
    }
}
