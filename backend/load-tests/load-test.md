# Load Test Results

**Tool:** k6 v2.0.0  
**Date:** 2026-06-28  
**Environment:** Local (Node.js backend + PostgreSQL via Docker)  
**Script:** `backend/load-tests/load-test.js`

---

## Scenarios

| Scenario | VUs | Duration | What it tests |
|---|---|---|---|
| `availability_throughput` | 50 | 30s | GET /api/v1/availability throughput and latency |
| `booking_flow` | 20 | 30s | Full check → confirm flow under concurrent load |
| `concurrency_race` | 30 | shared | 30 VUs race for the exact same slot simultaneously |

Run all: `k6 run backend/load-tests/load-test.js`  
Run one: `k6 run --env SCENARIO=race backend/load-tests/load-test.js`

> **Note:** Run against a freshly seeded database for reproducible booking success counts. If the DB already has bookings from a previous run, the booking flow scenario will return `available: false` for all slots and make 0 booking requests — which is correct system behaviour, not a bug. Reset with `npm run db:migrate && npm run db:seed`.

---

## Results

### Thresholds - all passed ✓

| Threshold | Target | Result |
|---|---|---|
| Availability success rate | > 99% | **100%** |
| Booking p95 latency | < 2000ms | **24.95ms** |
| Availability p95 latency | < 500ms | **passed** |
| Error rate (availability) | < 1% | **0%** |
| Error rate (booking) | < 1% | **0%** |

---

### Scenario 1 - Availability Throughput

| Metric | Value |
|---|---|
| Total requests | 2,950 |
| Throughput | ~98 RPS |
| Success rate | 100% |
| Avg latency | 9.08ms |
| p95 latency | 18.39ms |
| Errors | 0 |

The availability endpoint is read-only with no caching layer - every request hits the primary DB. At 50 concurrent VUs the service sustains ~98 RPS with sub-20ms p95 latency, well within acceptable bounds.

---

### Scenario 2 - Booking Flow (check → confirm)

| Metric | Value |
|---|---|
| Bookings succeeded | 25 |
| Slot conflicts (409) | 47 |
| Booking avg latency | 11.71ms |
| Booking p95 latency | 24.95ms |
| Unexpected errors | 0 |

409 conflicts are expected and correct - the availability check is advisory (not a reservation), so a slot can be taken between the check and the confirmation. These are handled gracefully by the frontend (user is shown "slot unavailable" and prompted to retry). No 5xx errors were recorded.

---

### Scenario 3 - Concurrency Race

| Metric | Value |
|---|---|
| Concurrent VUs | 30 |
| Bookings succeeded | 1 |
| Slot rejected (409) | 29 |
| Double bookings | **0** |

30 virtual users sent booking requests for the **exact same vehicle type, location, and time slot** simultaneously. The PostgreSQL advisory lock (`pg_try_advisory_xact_lock`) ensured exactly one transaction won - all others received an immediate 409 with no queuing or connection pool starvation.

This is the core correctness guarantee of the service: **no double-booking is possible under any concurrency level.**

---

## Key Observations

**Advisory lock is non-blocking by design.** Losing requests are rejected immediately rather than queued. This keeps connection usage flat under burst load - a traditional `SELECT FOR UPDATE` would queue all 29 losing requests, holding DB connections open until the winner commits.

**Availability is stateless and scales horizontally.** The availability endpoint does a single DB read and returns. Multiple backend instances can serve it simultaneously with no coordination needed.

**The two-step flow (check then book) is intentionally advisory.** The 409 rate in the booking flow scenario reflects correct system behaviour - slots are not reserved on availability check. Business rules (operating hours, buffer window, conflicts) are re-validated inside the advisory lock transaction regardless of what the availability response said.
