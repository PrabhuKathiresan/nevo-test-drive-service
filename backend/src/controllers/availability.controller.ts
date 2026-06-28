import { Request, Response } from 'express';
import { z } from 'zod';
import { checkAvailability } from '../services/availability.service';
import { startDateTimeSchema, durationMinsSchema, firstValidationError } from './validators';

const schema = z.object({
  location: z.string().min(1),
  vehicleType: z.string().min(1),
  startDateTime: startDateTimeSchema,
  durationMins: z.coerce.number().pipe(durationMinsSchema),
});

export async function availabilityController(req: Request, res: Response) {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: firstValidationError(parsed.error.errors) } });
  }

  const { location, vehicleType, startDateTime, durationMins } = parsed.data;
  const result = await checkAvailability({
    location,
    vehicleType,
    startDateTime: new Date(startDateTime),
    durationMins,
  });

  return res.json(result);
}
