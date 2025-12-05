export class TimeUtil {
    public static isValid15minuteFormat(timeString: string): boolean {
        // Requires exactly HH:mm format (e.g., "09:30", not "9:30")
        const strictTimeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!strictTimeRegex.test(timeString)) {
            return false;
        }

        // Check if minutes are a multiple of 5
        const [, , minutes] = timeString.match(/^([0-1][0-9]|2[0-3]):([0-5][0-9])$/) || [];
        return parseInt(minutes, 10) % 5 === 0;
    }

    public static timeToMinutes(timeStr: string): number {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    public static minutesToTime(minutes: number): string {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
}
