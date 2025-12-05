export class ArrayUtil {
    public static removeByMut<T>(array: T[], predicate: (item: T) => boolean): T[] {
        const index = array.findIndex(predicate);
        if (index !== -1) {
            array.splice(index, 1);
        }
        return array;
    }

    public static replaceByMut<T>(array: T[], targetFn: (item: T) => boolean, newItem: T): T[] {
        const index = array.findIndex(targetFn);
        if (index !== -1) {
            array[index] = newItem;
        }
        return array;
    }
}
