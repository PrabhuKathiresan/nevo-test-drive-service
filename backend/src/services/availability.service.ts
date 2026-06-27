import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { findVehiclesByTypeAndLocation } from '../repositories/vehicle.repository';
import { isVehicleAvailable } from '../utils/slot-rules';

dayjs.extend(utc);

export interface AvailabilityRequest {
  location: string;
  vehicleType: string;
  startDateTime: Date;
  durationMins: number;
}

export interface AvailabilityResult {
  available: boolean;
  vehicleId: string | null;
}

export async function checkAvailability(req: AvailabilityRequest): Promise<AvailabilityResult> {
  const endDateTime = dayjs.utc(req.startDateTime).add(req.durationMins, 'minute').toDate();

  const vehicles = await findVehiclesByTypeAndLocation(
    req.vehicleType,
    req.location,
    req.startDateTime,
    endDateTime,
  );

  const eligible = vehicles.filter((v) => isVehicleAvailable(v, req.startDateTime, endDateTime));

  if (eligible.length === 0) {
    return { available: false, vehicleId: null };
  }

  const selected = selectLeastBooked(eligible);
  return { available: true, vehicleId: selected.id };
}

function selectLeastBooked<T extends { id: string; _count: { bookings: number } }>(vehicles: T[]): T {
  return vehicles.reduce((best, v) => {
    if (v._count.bookings < best._count.bookings) return v;
    if (v._count.bookings === best._count.bookings && v.id < best.id) return v;
    return best;
  });
}
