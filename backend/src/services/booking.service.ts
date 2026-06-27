import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import prisma from '../lib/prisma';
import { createBooking } from '../repositories/booking.repository';
import { isWithinOperatingHours, hasBookingConflict } from '../utils/slot-rules';

dayjs.extend(utc);

export interface BookingRequest {
  vehicleId: string;
  startDateTime: Date;
  durationMins: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export class SlotUnavailableError extends Error {
  constructor() {
    super('The requested slot is no longer available');
    this.name = 'SlotUnavailableError';
  }
}

export class VehicleNotFoundError extends Error {
  constructor() {
    super('Vehicle not found');
    this.name = 'VehicleNotFoundError';
  }
}

export async function scheduleBooking(req: BookingRequest): Promise<{ bookingId: string }> {
  const endDateTime = dayjs.utc(req.startDateTime).add(req.durationMins, 'minute').toDate();

  return prisma.$transaction(async (tx) => {
    // Acquire a non-blocking advisory lock scoped to this vehicle.
    // If another transaction already holds it, acquired = false and we
    // immediately reject rather than queuing — avoids connection pool starvation.
    // The lock is released automatically when the transaction commits or rolls back.
    const [lock] = await tx.$queryRaw<Array<{ acquired: boolean }>>`
      SELECT pg_try_advisory_xact_lock(hashtext(${req.vehicleId})) AS acquired
    `;
    if (!lock.acquired) throw new SlotUnavailableError();

    const vehicle = await tx.vehicle.findUnique({
      where: { id: req.vehicleId },
      include: { bookings: true },
    });

    if (!vehicle) throw new VehicleNotFoundError();

    if (!isWithinOperatingHours(vehicle, req.startDateTime, endDateTime)) throw new SlotUnavailableError();
    if (hasBookingConflict(vehicle, req.startDateTime, endDateTime)) throw new SlotUnavailableError();

    const booking = await createBooking({
      vehicleId: req.vehicleId,
      startDateTime: req.startDateTime,
      endDateTime,
      customerName: req.customerName,
      customerEmail: req.customerEmail,
      customerPhone: req.customerPhone,
    });

    return { bookingId: booking.id };
  });
}
