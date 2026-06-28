import { scheduleBooking } from '../services/booking.service';
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
  location: 'test_city',
  vehicleType: 'test_model',
  startDateTime: makeDate(14),
  durationMins: 45,
  customerName: 'Test User',
  customerEmail: 'test@test.com',
  customerPhone: '+353851234567',
};

describe('even distribution', () => {
  it('selects the vehicle with the fewest bookings', async () => {
    // test_v1 has 2 bookings, test_v2 has 1, test_v3 has 0 — expect test_v3 to be selected
    await makeBooking('test_v1', 9);
    await makeBooking('test_v1', 11);
    await makeBooking('test_v2', 9);

    const { bookingId } = await scheduleBooking(BASE);
    const saved = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(saved?.vehicleId).toBe('test_v3');
  });

  it('breaks ties by vehicle id ascending', async () => {
    // All three vehicles have 1 booking each — tie broken by ID: test_v1 < test_v2 < test_v3
    await makeBooking('test_v1', 9);
    await makeBooking('test_v2', 9);
    await makeBooking('test_v3', 9);

    const { bookingId } = await scheduleBooking(BASE);
    const saved = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(saved?.vehicleId).toBe('test_v1');
  });

  it('distributes bookings across vehicles over sequential requests', async () => {
    const slots = [makeDate(9), makeDate(11), makeDate(14)];
    const selected: string[] = [];

    for (const slot of slots) {
      const { bookingId } = await scheduleBooking({ ...BASE, startDateTime: slot });
      const saved = await prisma.booking.findUnique({ where: { id: bookingId } });
      selected.push(saved!.vehicleId);
    }

    // Each vehicle should have been selected exactly once
    expect(new Set(selected).size).toBe(3);
  });
});
