import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export const TEST_VEHICLE_IDS = ['test_v1', 'test_v2', 'test_v3'];

export async function seedTestVehicles() {
  await prisma.vehicle.createMany({
    data: [
      {
        id: 'test_v1',
        type: 'test_model',
        location: 'test_city',
        availableFromTime: '08:00:00',
        availableToTime: '18:00:00',
        availableDays: ['mon', 'tue', 'wed', 'thur', 'fri', 'sat', 'sun'],
        minimumMinutesBetweenBookings: 15,
      },
      {
        id: 'test_v2',
        type: 'test_model',
        location: 'test_city',
        availableFromTime: '08:00:00',
        availableToTime: '18:00:00',
        availableDays: ['mon', 'tue', 'wed', 'thur', 'fri', 'sat', 'sun'],
        minimumMinutesBetweenBookings: 15,
      },
      {
        id: 'test_v3',
        type: 'test_model',
        location: 'test_city',
        availableFromTime: '08:00:00',
        availableToTime: '18:00:00',
        availableDays: ['mon', 'tue', 'wed', 'thur', 'fri', 'sat', 'sun'],
        minimumMinutesBetweenBookings: 15,
      },
    ],
    skipDuplicates: true,
  });
}

export async function cleanupTestData() {
  await prisma.booking.deleteMany({ where: { vehicleId: { in: TEST_VEHICLE_IDS } } });
  await prisma.vehicle.deleteMany({ where: { id: { in: TEST_VEHICLE_IDS } } });
}

export function makeBooking(vehicleId: string, startHour: number, durationMins = 45) {
  const start = new Date('2025-01-13T00:00:00Z');
  start.setUTCHours(startHour, 0, 0, 0);
  const end = new Date(start.getTime() + durationMins * 60 * 1000);
  return prisma.booking.create({
    data: {
      vehicleId,
      startDateTime: start,
      endDateTime: end,
      customerName: 'Test User',
      customerEmail: 'test@test.com',
      customerPhone: '+353851234567',
    },
  });
}

export function makeDate(hour: number): Date {
  const d = new Date('2025-01-13T00:00:00Z');
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}
