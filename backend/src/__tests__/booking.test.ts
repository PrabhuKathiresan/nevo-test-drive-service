import { scheduleBooking, SlotUnavailableError, VehicleNotFoundError } from '../services/booking.service';
import { cleanupTestData, makeBooking, makeDate, prisma, seedTestVehicles, TEST_VEHICLE_IDS } from './helpers';

beforeAll(async () => {
  await cleanupTestData();
  await seedTestVehicles();
});

afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

afterEach(async () => {
  await prisma.booking.deleteMany({ where: { vehicleId: { in: TEST_VEHICLE_IDS } } });
});

const BASE = {
  vehicleId: 'test_v1',
  startDateTime: makeDate(10),
  durationMins: 45,
  customerName: 'Jane Doe',
  customerEmail: 'jane@doe.com',
  customerPhone: '+353851234567',
};

describe('booking — success', () => {
  it('creates a booking and returns a bookingId', async () => {
    const result = await scheduleBooking(BASE);
    expect(result.bookingId).toBeDefined();
    expect(typeof result.bookingId).toBe('string');
  });

  it('persists the booking in the database', async () => {
    const { bookingId } = await scheduleBooking(BASE);
    const saved = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(saved).not.toBeNull();
    expect(saved?.vehicleId).toBe('test_v1');
    expect(saved?.customerEmail).toBe('jane@doe.com');
  });
});

describe('booking — conflict rejection', () => {
  it('throws SlotUnavailableError when slot overlaps existing booking', async () => {
    await makeBooking('test_v1', 10);
    await expect(scheduleBooking(BASE)).rejects.toThrow(SlotUnavailableError);
  });

  it('throws SlotUnavailableError when slot is within buffer of existing booking', async () => {
    // Existing: 10:00–10:45. Buffer: 15 min. 10:50 start is within buffer.
    await makeBooking('test_v1', 10);
    const tooSoon = { ...BASE, startDateTime: new Date('2025-01-13T10:50:00Z') };
    await expect(scheduleBooking(tooSoon)).rejects.toThrow(SlotUnavailableError);
  });

  it('allows booking exactly after buffer has elapsed', async () => {
    // Existing: 10:00–10:45. 11:00 is exactly 15 min after end.
    await makeBooking('test_v1', 10);
    const afterBuffer = { ...BASE, startDateTime: new Date('2025-01-13T11:00:00Z') };
    const result = await scheduleBooking(afterBuffer);
    expect(result.bookingId).toBeDefined();
  });
});

describe('booking — vehicle not found', () => {
  it('throws VehicleNotFoundError for unknown vehicleId', async () => {
    await expect(scheduleBooking({ ...BASE, vehicleId: 'does_not_exist' })).rejects.toThrow(VehicleNotFoundError);
  });
});
