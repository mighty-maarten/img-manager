export class DateUtil {
    public static formatDateTime(date: Date | string): string {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        return dateObj.toLocaleString();
    }
}