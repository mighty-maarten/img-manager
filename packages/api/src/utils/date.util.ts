export class DateUtil {
    public static readonly BRUSSELS_TIMEZONE = 'Europe/Brussels';

    public static getDayOfWeek(date: Date): number {
        const brusselsDate = new Date(
            date.toLocaleString(undefined, {
                timeZone: this.BRUSSELS_TIMEZONE,
            }),
        );

        return brusselsDate.getDay();
    }
}
