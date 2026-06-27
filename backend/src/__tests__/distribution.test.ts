import { checkAvailability } from '../services/availability.service';
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

const BASE = { location: 'test_city', vehicleType: 'test_model', startDateTime: makeDate(10), durationMins: 45 };

describe('even distribution', () => {
  it('selects the vehicle with the fewest bookings', async () => {
    // Give test_v1 two bookings and test_v2 one — test_v2 should be selected
    await makeBooking('test_v1', 10);
    await makeBooking('test_v1', 12);
    await makeBooking('test_v2', 10);

    const result = await checkAvailability({ ...BASE, startDateTime: makeDate(14) });
    expect(result.available).toBe(true);
    expect(result.vehicleId).toBe('test_v3'); // test_v3 has 0 bookings — fewest
  });

  it('breaks ties by vehicle id ascending', async () => {
    // All three vehicles have 1 booking each — tie broken by ID: test_v1 < test_v2 < test_v3
    await makeBooking('test_v1', 10);
    await makeBooking('test_v2', 10);
    await makeBooking('test_v3', 10);

    const result = await checkAvailability({ ...BASE, startDateTime: makeDate(14) });
    expect(result.available).toBe(true);
    expect(result.vehicleId).toBe('test_v1');
  });

  it('distributes bookings across vehicles over sequential requests', async () => {
    const slots = [makeDate(9), makeDate(10), makeDate(12)];
    const selected: string[] = [];

    for (const slot of slots) {
      const result = await checkAvailability({ ...BASE, startDateTime: slot });
      expect(result.available).toBe(true);
      // Simulate the booking being made so the next check sees updated counts
      await makeBooking(result.vehicleId!, slot.getUTCHours());
      selected.push(result.vehicleId!);
    }

    // Each vehicle should have been selected exactly once
    expect(new Set(selected).size).toBe(3);
  });
});
