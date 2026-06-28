/**
 * k6 load test — Nevo Test Drive Service
 *
 * Usage:
 *   k6 run load-tests/load-test.js                  # all scenarios
 *   k6 run --env SCENARIO=availability load-tests/load-test.js
 *   k6 run --env SCENARIO=booking       load-tests/load-test.js
 *   k6 run --env SCENARIO=race          load-tests/load-test.js
 *
 * Requires: k6 installed (brew install k6) and backend running on localhost:3000
 * with a seeded database (npm run db:migrate && npm run db:seed)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SCENARIO  = __ENV.SCENARIO  || 'all';

// Custom metrics
const bookingSuccesses  = new Counter('booking_successes');
const bookingConflicts  = new Counter('booking_conflicts');
const bookingErrors     = new Counter('booking_errors');
const availabilityRate  = new Rate('availability_success_rate');
const bookingDuration   = new Trend('booking_duration_ms', true);

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

export const options = {
  scenarios: {

    // 1. Availability throughput — 50 VUs hammering GET /availability for 30s
    ...(SCENARIO === 'all' || SCENARIO === 'availability') && {
      availability_throughput: {
        executor: 'constant-vus',
        vus: 50,
        duration: '30s',
        exec: 'availabilityScenario',
        tags: { scenario: 'availability' },
      },
    },

    // 2. Realistic booking flow — check then book, 20 VUs for 30s
    ...(SCENARIO === 'all' || SCENARIO === 'booking') && {
      booking_flow: {
        executor: 'constant-vus',
        vus: 20,
        duration: '30s',
        exec: 'bookingScenario',
        startTime: SCENARIO === 'all' ? '35s' : '0s',  // run after availability when combined
        tags: { scenario: 'booking' },
      },
    },

    // 3. Concurrency race — 30 VUs all booking the exact same slot simultaneously
    ...(SCENARIO === 'all' || SCENARIO === 'race') && {
      concurrency_race: {
        executor: 'shared-iterations',
        vus: 30,
        iterations: 30,
        maxDuration: '30s',
        exec: 'raceScenario',
        startTime: SCENARIO === 'all' ? '70s' : '0s',
        tags: { scenario: 'race' },
      },
    },
  },

  thresholds: {
    // Availability endpoint should be fast and reliable
    'http_req_duration{scenario:availability}': ['p(95)<500', 'p(99)<1000'],
    'availability_success_rate': ['rate>0.99'],

    // Booking endpoint — p95 under 2s (advisory lock + transaction)
    'booking_duration_ms': ['p(95)<2000'],

    // 409 SLOT_UNAVAILABLE is an expected business response, not an error.
    // Only flag truly unexpected failures (5xx, network errors).
    'http_req_failed{scenario:availability}': ['rate<0.01'],
    'http_req_failed{scenario:booking}':      ['rate<0.01'],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Next weekday at a given hour in UTC (avoids weekend vehicles being unavailable)
function nextWeekdayAt(hour) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

const CUSTOMER = {
  customerName:  'Load Tester',
  customerEmail: 'load@test.com',
  customerPhone: '+353851234567',
};

const VEHICLE_TYPES = ['tesla_model3', 'tesla_modelx'];
const LOCATIONS     = ['dublin', 'cork'];
const HOURS         = [9, 10, 11, 13, 14, 15];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Scenario 1: Availability throughput
// ---------------------------------------------------------------------------

export function availabilityScenario() {
  const qs = `vehicleType=${randomItem(VEHICLE_TYPES)}&location=${randomItem(LOCATIONS)}&startDateTime=${encodeURIComponent(nextWeekdayAt(randomItem(HOURS)))}&durationMins=45`;
  const res = http.get(`${BASE_URL}/api/v1/availability?${qs}`);

  const ok = check(res, {
    'availability status 200':      (r) => r.status === 200,
    'availability has available field': (r) => {
      try { return typeof r.json('available') === 'boolean'; } catch { return false; }
    },
  });

  availabilityRate.add(ok);
  sleep(0.5);
}

// ---------------------------------------------------------------------------
// Scenario 2: Realistic booking flow — check availability then confirm
// ---------------------------------------------------------------------------

export function bookingScenario() {
  const vehicleType   = randomItem(VEHICLE_TYPES);
  const location      = randomItem(LOCATIONS);
  const startDateTime = nextWeekdayAt(randomItem(HOURS));
  const durationMins  = 45;

  // Step 1: check availability
  const qs = `vehicleType=${vehicleType}&location=${location}&startDateTime=${encodeURIComponent(startDateTime)}&durationMins=${durationMins}`;
  const availRes = http.get(`${BASE_URL}/api/v1/availability?${qs}`);

  if (!check(availRes, { 'avail status 200': (r) => r.status === 200 })) {
    bookingErrors.add(1);
    sleep(1);
    return;
  }

  const avail = availRes.json();
  if (!avail.available) {
    sleep(1);
    return;
  }

  // Step 2: confirm booking
  const start = Date.now();
  const bookRes = http.post(
    `${BASE_URL}/api/v1/bookings`,
    JSON.stringify({ vehicleType, location, startDateTime, durationMins, ...CUSTOMER }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  bookingDuration.add(Date.now() - start);

  if (bookRes.status === 201) {
    bookingSuccesses.add(1);
    check(bookRes, { 'booking has bookingId': (r) => Boolean(r.json('bookingId')) });
  } else if (bookRes.status === 409) {
    // Expected under load — slot taken between availability check and booking
    bookingConflicts.add(1);
  } else {
    bookingErrors.add(1);
    check(bookRes, { 'unexpected booking error': () => false });
  }

  sleep(1);
}

// ---------------------------------------------------------------------------
// Scenario 3: Concurrency race — all VUs hit the same slot at once
// ---------------------------------------------------------------------------

// Fixed slot so every VU races for the exact same vehicle+time
const RACE_SLOT = nextWeekdayAt(11);

export function raceScenario() {
  const res = http.post(
    `${BASE_URL}/api/v1/bookings`,
    JSON.stringify({
      vehicleType:   'tesla_model3',
      location:      'dublin',
      startDateTime: RACE_SLOT,
      durationMins:  45,
      ...CUSTOMER,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (res.status === 201) {
    bookingSuccesses.add(1);
    check(res, { 'race: booking created': () => true });
  } else if (res.status === 409) {
    bookingConflicts.add(1);
    check(res, { 'race: slot rejected as expected': () => true });
  } else {
    bookingErrors.add(1);
    check(res, { 'race: unexpected error': () => false });
  }
}
