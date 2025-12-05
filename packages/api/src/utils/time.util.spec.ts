import { TimeUtil } from './time.util';

describe('TimeUtil', () => {
    it('Valid Format', () => {
        const valid = TimeUtil.isValid15minuteFormat('12:00');
        expect(valid).toBe(true);
    });

    it('Invalid Format - Not multiple of 5 (case 1)', () => {
        const valid = TimeUtil.isValid15minuteFormat('12:02');
        expect(valid).toBe(false);
    });

    it('Invalid Format - Not multiple of 5 (case 2)', () => {
        const valid = TimeUtil.isValid15minuteFormat('23:07');
        expect(valid).toBe(false);
    });

    it('Invalid Format - Not multiple of 5 (case 3)', () => {
        const valid = TimeUtil.isValid15minuteFormat('05:16');
        expect(valid).toBe(false);
    });

    it('Invalid Format - No leading 0', () => {
        const valid = TimeUtil.isValid15minuteFormat('5:15');
        expect(valid).toBe(false);
    });

    it('Invalid Format - Hour too high', () => {
        const valid = TimeUtil.isValid15minuteFormat('25:15');
        expect(valid).toBe(false);
    });

    it('Invalid Format - Minutes too high', () => {
        const valid = TimeUtil.isValid15minuteFormat('05:65');
        expect(valid).toBe(false);
    });
});
