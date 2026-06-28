import { checkAvailability } from '../services/availability.service';
import { cleanupTestData, makeBooking, makeDate, prisma, seedTestVehicles } from './helpers';

beforeAll(async () => {
  await cleanupTestData();
  await seedTestVehicles();
});

afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

afterEach(async () => {
  const { prisma, TEST_VEHICLE_IDS } = await import('./helpers');
  await prisma.booking.deleteMany({ where: { vehicleId: { in: TEST_VEHICLE_IDS } } });
});

const BASE = { location: 'test_city', vehicleType: 'test_model', startDateTime: makeDate(10), durationMins: 45 };

describe('availability — vehicle matching', () => {
  it('returns unavailable for unknown vehicle type', async () => {
    const result = await checkAvailability({ ...BASE, vehicleType: 'unknown_type' });
    expect(result.available).toBe(false);
  });

  it('returns unavailable for unknown location', async () => {
    const result = await checkAvailability({ ...BASE, location: 'unknown_city' });
    expect(result.available).toBe(false);
  });
});

describe('availability — time rules', () => {
  it('returns unavailable when slot starts before operating hours', async () => {
    const result = await checkAvailability({ ...BASE, startDateTime: makeDate(7) });
    expect(result.available).toBe(false);
  });

  it('returns unavailable when slot ends after operating hours', async () => {
    // 17:30 + 45 mins = 18:15 — exceeds 18:00 cutoff
    const start = new Date('2025-01-13T17:30:00Z');
    const result = await checkAvailability({ ...BASE, startDateTime: start, durationMins: 45 });
    expect(result.available).toBe(false);
  });

  it('returns available for a slot within operating hours', async () => {
    const result = await checkAvailability(BASE);
    expect(result.available).toBe(true);
  });
});

describe('availability — overlap and buffer', () => {
  it('returns unavailable when slot overlaps an existing booking', async () => {
    await makeBooking('test_v1', 10);
    await makeBooking('test_v2', 10);
    await makeBooking('test_v3', 10);

    const result = await checkAvailability({ ...BASE, startDateTime: makeDate(10) });
    expect(result.available).toBe(false);
  });

  it('returns unavailable when slot falls within buffer window', async () => {
    // All vehicles booked 10:00–10:45; buffer is 15 min, so 10:46–10:59 must be rejected
    await makeBooking('test_v1', 10);
    await makeBooking('test_v2', 10);
    await makeBooking('test_v3', 10);

    const tooSoon = new Date('2025-01-13T10:50:00Z');
    const result = await checkAvailability({ ...BASE, startDateTime: tooSoon });
    expect(result.available).toBe(false);
  });

  it('returns available exactly after buffer has elapsed', async () => {
    // All vehicles booked 10:00–10:45; 11:00 is exactly 15 min after end → allowed
    await makeBooking('test_v1', 10);
    await makeBooking('test_v2', 10);
    await makeBooking('test_v3', 10);

    const afterBuffer = new Date('2025-01-13T11:00:00Z');
    const result = await checkAvailability({ ...BASE, startDateTime: afterBuffer });
    expect(result.available).toBe(true);
  });
});
