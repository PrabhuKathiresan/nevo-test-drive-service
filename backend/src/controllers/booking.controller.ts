import { Request, Response } from 'express';
import { z } from 'zod';
import { scheduleBooking, SlotUnavailableError, VehicleNotFoundError } from '../services/booking.service';
import { startDateTimeSchema, durationMinsSchema, firstValidationError } from './validators';

const schema = z.object({
  vehicleId: z.string().min(1),
  startDateTime: startDateTimeSchema,
  durationMins: durationMinsSchema,
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(1),
});

export async function bookingController(req: Request, res: Response) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: firstValidationError(parsed.error.errors) } });
  }

  const { vehicleId, startDateTime, durationMins, customerName, customerEmail, customerPhone } = parsed.data;

  try {
    const result = await scheduleBooking({
      vehicleId,
      startDateTime: new Date(startDateTime),
      durationMins,
      customerName,
      customerEmail,
      customerPhone,
    });
    return res.status(201).json(result);
  } catch (err) {
    if (err instanceof VehicleNotFoundError) {
      return res.status(404).json({ error: { code: 'VEHICLE_NOT_FOUND', message: err.message } });
    }
    if (err instanceof SlotUnavailableError) {
      return res.status(409).json({ error: { code: 'SLOT_UNAVAILABLE', message: err.message } });
    }
    throw err;
  }
}
