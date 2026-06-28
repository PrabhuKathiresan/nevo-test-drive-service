import { scheduleBooking, SlotUnavailableError } from '../services/booking.service';
import { cleanupTestData, makeBooking, makeDate, prisma, seedTestVehicles, TEST_VEHICLE_IDS } from './helpers';

beforeAll(async () => {
  await cleanupTestData();
  await seedTestVehicles();
}, 30000);

afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
}, 30000);

afterEach(async () => {
  await prisma.booking.deleteMany({ where: { vehicleId: { in: TEST_VEHICLE_IDS } } });
});

const BASE = {
  vehicleType: 'test_model',
  location: 'test_city',
  startDateTime: makeDate(10),
  durationMins: 45,
  customerName: 'Race Tester',
  customerEmail: 'race@test.com',
  customerPhone: '+353851234567',
};

describe('concurrency', () => {
  it('allows exactly one booking when two requests race for the same slot', async () => {
    // Pre-book test_v2 and test_v3 so both requests are forced onto test_v1
    await makeBooking('test_v2', 10);
    await makeBooking('test_v3', 10);

    const results = await Promise.allSettled([scheduleBooking(BASE), scheduleBooking(BASE)]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(SlotUnavailableError);

    const bookings = await prisma.booking.findMany({ where: { vehicleId: 'test_v1' } });
    expect(bookings).toHaveLength(1);
  }, 60000);

  it('allows exactly one booking when five requests race for the same slot', async () => {
    // Pre-book test_v2 and test_v3 so all requests are forced onto test_v1
    await makeBooking('test_v2', 10);
    await makeBooking('test_v3', 10);

    const requests = Array.from({ length: 5 }, () => scheduleBooking(BASE));
    const results = await Promise.allSettled(requests);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);

    const bookings = await prisma.booking.findMany({ where: { vehicleId: 'test_v1' } });
    expect(bookings).toHaveLength(1);
  }, 60000);

  it('allows concurrent bookings on the same vehicle when slots do not conflict', async () => {
    // 10:00 and 14:00 on the same vehicle — no overlap, no buffer issue.
    // The lock is scoped to vehicle + date so both should succeed concurrently.
    const morning = { ...BASE, startDateTime: makeDate(10) };
    const afternoon = { ...BASE, startDateTime: makeDate(14) };

    const results = await Promise.allSettled([
      scheduleBooking(morning),
      scheduleBooking(afternoon),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled).toHaveLength(2);

    const bookings = await prisma.booking.findMany({ where: { vehicleId: { in: TEST_VEHICLE_IDS } } });
    expect(bookings).toHaveLength(2);
  }, 60000);
});
