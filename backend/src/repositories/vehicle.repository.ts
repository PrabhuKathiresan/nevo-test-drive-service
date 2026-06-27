import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import prisma from '../lib/prisma';

dayjs.extend(utc);

// Safe upper bound for per-vehicle buffer — ensures the DB conflict window
// is never narrower than the application-level buffer check in slot-rules.ts
const MAX_BUFFER_MINS = 60;

export async function findVehiclesByTypeAndLocation(
  type: string,
  location: string,
  startDateTime: Date,
  endDateTime: Date,
) {
  const conflictStart = dayjs.utc(startDateTime).subtract(MAX_BUFFER_MINS, 'minute').toDate();
  const conflictEnd = dayjs.utc(endDateTime).add(MAX_BUFFER_MINS, 'minute').toDate();
  const dayStart = dayjs.utc(startDateTime).startOf('day').toDate();
  const dayEnd = dayjs.utc(startDateTime).endOf('day').toDate();

  return prisma.vehicle.findMany({
    where: { type, location },
    include: {
      // Conflict check — only bookings that can overlap the requested slot + buffer
      bookings: {
        where: {
          startDateTime: { lt: conflictEnd },
          endDateTime: { gt: conflictStart },
        },
      },
      // Distribution — count of today's bookings per vehicle
      _count: {
        select: {
          bookings: {
            where: {
              startDateTime: { gte: dayStart },
              endDateTime: { lte: dayEnd },
            },
          },
        },
      },
    },
  });
}

export async function findVehicleById(id: string) {
  return prisma.vehicle.findUnique({
    where: { id },
    include: { bookings: true },
  });
}
