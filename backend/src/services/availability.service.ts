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

  return { available: eligible.length > 0 };
}
