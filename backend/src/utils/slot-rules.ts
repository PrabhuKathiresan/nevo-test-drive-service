import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

export interface VehicleSlotRules {
  availableDays: string[];
  availableFromTime: string;
  availableToTime: string;
  minimumMinutesBetweenBookings: number;
  bookings: { startDateTime: Date; endDateTime: Date }[];
}

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thur', 'fri', 'sat'];

export function isWithinOperatingHours(
  vehicle: Pick<VehicleSlotRules, 'availableDays' | 'availableFromTime' | 'availableToTime'>,
  start: Date,
  end: Date,
): boolean {
  const startUtc = dayjs.utc(start);
  const endUtc = dayjs.utc(end);

  if (!vehicle.availableDays.includes(DAY_NAMES[startUtc.day()])) return false;

  // Booking must not span into the next UTC day (also guards against huge durationMins)
  if (!startUtc.isSame(endUtc, 'day')) return false;

  const [fromH, fromM] = vehicle.availableFromTime.split(':').map(Number);
  const [toH, toM] = vehicle.availableToTime.split(':').map(Number);
  const openTime = startUtc.clone().hour(fromH).minute(fromM).second(0).millisecond(0);
  const closeTime = startUtc.clone().hour(toH).minute(toM).second(0).millisecond(0);

  return !startUtc.isBefore(openTime) && !endUtc.isAfter(closeTime);
}

export function hasBookingConflict(
  vehicle: Pick<VehicleSlotRules, 'minimumMinutesBetweenBookings' | 'bookings'>,
  start: Date,
  end: Date,
): boolean {
  const buffer = vehicle.minimumMinutesBetweenBookings;
  const s = dayjs.utc(start);
  const e = dayjs.utc(end);
  return vehicle.bookings.some((b) => {
    const bStart = dayjs.utc(b.startDateTime);
    const bEnd = dayjs.utc(b.endDateTime);
    return s.isBefore(bEnd.add(buffer, 'minute')) && e.isAfter(bStart.subtract(buffer, 'minute'));
  });
}

export function isVehicleAvailable(vehicle: VehicleSlotRules, start: Date, end: Date): boolean {
  return isWithinOperatingHours(vehicle, start, end) && !hasBookingConflict(vehicle, start, end);
}
