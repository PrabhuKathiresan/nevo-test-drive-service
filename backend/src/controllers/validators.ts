import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { z } from 'zod';

dayjs.extend(utc);

export function firstValidationError(errors: z.ZodError['errors']): string {
  const { path, message } = errors[0];
  return path.length > 0 ? `${path.join('.')}: ${message}` : message;
}

const MAX_DAYS_AHEAD = 14;
const MAX_DURATION_MINS = 480;

export const durationMinsSchema = z
  .number()
  .int()
  .positive()
  .max(MAX_DURATION_MINS, { message: `durationMins must not exceed ${MAX_DURATION_MINS} minutes` });

export const startDateTimeSchema = z
  .string()
  .datetime({ message: 'startDateTime must be a valid ISO 8601 UTC datetime' })
  .refine(
    (val: string) => dayjs.utc(val).isAfter(dayjs.utc()),
    { message: 'startDateTime must be in the future' },
  )
  .refine(
    (val: string) => dayjs.utc(val).isBefore(dayjs.utc().add(MAX_DAYS_AHEAD, 'day')),
    { message: `startDateTime must be within ${MAX_DAYS_AHEAD} days from now` },
  );
