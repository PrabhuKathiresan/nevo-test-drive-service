import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import prisma from '../lib/prisma';
import { createBooking } from '../repositories/booking.repository';
import { isWithinOperatingHours, hasBookingConflict, isVehicleAvailable } from '../utils/slot-rules';
import { findVehiclesByTypeAndLocation } from '../repositories/vehicle.repository';

dayjs.extend(utc);

export interface BookingRequest {
  location: string;
  vehicleType: string;
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

export async function scheduleBooking(req: BookingRequest): Promise<{ bookingId: string }> {
  const endDateTime = dayjs.utc(req.startDateTime).add(req.durationMins, 'minute').toDate();

  // Select vehicle outside the transaction (non-blocking read).
  // Re-validated with fresh data inside the advisory lock below.
  const vehicles = await findVehiclesByTypeAndLocation(
    req.vehicleType,
    req.location,
    req.startDateTime,
    endDateTime,
  );
  const eligible = vehicles.filter((v) => isVehicleAvailable(v, req.startDateTime, endDateTime));
  if (eligible.length === 0) throw new SlotUnavailableError();

  const selected = selectLeastBooked(eligible);

  return prisma.$transaction(async (tx) => {
    // Acquire a non-blocking advisory lock scoped to vehicle + exact start time.
    // Using two-integer form so concurrent bookings on the same vehicle at
    // different non-conflicting slots are not unnecessarily serialised.
    // Overlapping-but-different-start-time conflicts are caught by the
    // hasBookingConflict re-validation inside the lock.
    // The lock is released automatically when the transaction commits or rolls back.
    const lockSlot = req.startDateTime.toISOString();
    const [lock] = await tx.$queryRaw<Array<{ acquired: boolean }>>`
      SELECT pg_try_advisory_xact_lock(hashtext(${selected.id}), hashtext(${lockSlot})) AS acquired
    `;
    if (!lock.acquired) throw new SlotUnavailableError();

    const vehicle = await tx.vehicle.findUnique({
      where: { id: selected.id },
      include: { bookings: true },
    });

    if (!vehicle) throw new SlotUnavailableError();

    if (!isWithinOperatingHours(vehicle, req.startDateTime, endDateTime)) throw new SlotUnavailableError();
    if (hasBookingConflict(vehicle, req.startDateTime, endDateTime)) throw new SlotUnavailableError();

    const booking = await createBooking({
      vehicleId: selected.id,
      startDateTime: req.startDateTime,
      endDateTime,
      customerName: req.customerName,
      customerEmail: req.customerEmail,
      customerPhone: req.customerPhone,
    });

    return { bookingId: booking.id };
  });
}

function selectLeastBooked<T extends { id: string; _count: { bookings: number } }>(vehicles: T[]): T {
  return vehicles.reduce((best, v) => {
    if (v._count.bookings < best._count.bookings) return v;
    if (v._count.bookings === best._count.bookings && v.id < best.id) return v;
    return best;
  });
}
