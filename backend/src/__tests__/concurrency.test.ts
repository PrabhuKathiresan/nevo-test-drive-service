import { scheduleBooking, SlotUnavailableError } from '../services/booking.service';
import { cleanupTestData, makeDate, prisma, seedTestVehicles, TEST_VEHICLE_IDS } from './helpers';

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
  vehicleId: 'test_v1',
  startDateTime: makeDate(10),
  durationMins: 45,
  customerName: 'Race Tester',
  customerEmail: 'race@test.com',
  customerPhone: '+353851234567',
};

describe('concurrency', () => {
  it('allows exactly one booking when two requests race for the same slot', async () => {
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
    const requests = Array.from({ length: 5 }, () => scheduleBooking(BASE));
    const results = await Promise.allSettled(requests);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);

    const bookings = await prisma.booking.findMany({ where: { vehicleId: 'test_v1' } });
    expect(bookings).toHaveLength(1);
  }, 60000);
});
