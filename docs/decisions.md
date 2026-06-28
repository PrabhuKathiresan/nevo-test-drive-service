# Key Design Decisions

---

## Database - PostgreSQL

**Decision:** Use PostgreSQL over a document store (MongoDB, DynamoDB).

**Reason:** The booking domain is transactional by nature. A slot must belong to exactly one customer or none - there is no valid "partial" state. PostgreSQL gives us ACID transactions, advisory locks, and a relational model that enforces referential integrity between vehicles and bookings. A document store would push correctness guarantees into application code, which is harder to reason about and test.

---

## Concurrency - PostgreSQL Advisory Lock

**Decision:** Use `pg_try_advisory_xact_lock` instead of `SELECT ... FOR UPDATE`.

**Reason:** Row-level locks (`FOR UPDATE`) block waiting transactions while each holds a database connection. Under concurrent load this exhausts the connection pool and causes unrelated requests to time out. Advisory locks are non-blocking - the first caller wins the lock, all others get an immediate `false` and are rejected as `409 SLOT_UNAVAILABLE`. This keeps connection usage flat regardless of concurrency level.

---

## Architecture - Modular Monolith

**Decision:** Single deployable unit with layered internals (controller → service → repository).

**Reason:** The domain is small - two endpoints, one business entity. Splitting into microservices would add network hops, service discovery, and deployment complexity with no scaling benefit at this scope. The layered structure keeps concerns separated and easy to test without the operational overhead.

---

## Distribution Algorithm - Least-Booked Vehicle

**Decision:** Among eligible vehicles, select the one with the fewest bookings *today*. Break ties by vehicle ID ascending.

**Reason:** Random assignment doesn't guarantee convergence. Round-robin requires persisted state and breaks under concurrent requests. Least-booked (scoped to today) is deterministic, stateless (derived from the DB), and self-correcting day-over-day.

**Why today's count over all-time:** All-time count permanently penalises vehicles with a long history. A new vehicle added to the fleet would be preferred for weeks until its count catches up — the opposite imbalance. Scoping to today bounds the correction window to 24 hours.

**Known weakness — mid-day vehicle addition:** If a vehicle C is added mid-day while A has 50 bookings and B has 40, C's count is 0 and it receives every remaining booking for the day — A and B sit idle. This self-corrects the next day when all counts reset.

**Production fix:** Initialise a new vehicle's effective count to the current fleet average for today using a `bookingCountOffset` field. The distribution algorithm uses `_count.bookings + offset` instead of raw count. C would start at 45 (average of A and B) and compete fairly immediately. For this assignment the edge case is acceptable — vehicles are typically added to a dealership's fleet before the day starts, not mid-day.

---

## Frontend Configuration - URL Query Parameters

**Decision:** Vehicle type and location are read from URL query params (`?vehicleType=tesla_model3&location=dublin`) with defaults as fallback.

**Reason:** The assignment requires vehicle type to be "configurable when embedding on the page" - not selected by the user. Query params allow the same component to be embedded for different vehicle types simply by changing the URL, with no code changes needed. In a production CMS, these would be server-rendered props.

---

## Consistency - CP over AP

**Decision:** Prioritise consistency over availability at every layer - no caching on reads, synchronous booking confirmation, business rules re-validated inside the DB transaction.

**Reason:** A double-booking is a hard failure - two customers showing up for the same vehicle at the same time is unrecoverable without human intervention. A temporary API outage is recoverable - the customer retries. This asymmetry makes CP the correct choice. Concretely:

- Availability checks always hit the primary DB - no Redis or CDN layer that could return a stale "available" response for a slot that was just booked
- The booking transaction re-checks all slot rules with fresh data inside the advisory lock, so the outcome is correct even if the availability response was stale by the time the booking request arrived
- The API returns 500 if the DB is unreachable rather than guessing or returning cached state

The only deliberate AP trade-off is the two-step flow itself (check then book) - the availability response is advisory, not a reservation. This is documented and handled at the booking layer.

---

## Vehicle Assignment - vehicleId in Booking Request

**Decision:** The availability endpoint returns a `vehicleId` which the frontend passes back in the booking request, as specified in the assignment.

**Trade-off:** This exposes internal vehicle inventory to the frontend and allows a client to bypass the availability endpoint entirely, booking any known `vehicleId` directly — circumventing the even distribution algorithm.

**The production-correct approach** would be to remove `vehicleId` from both the availability response and the booking request. The booking endpoint would instead accept `vehicleType`, `location`, `startDateTime`, and `durationMins` alongside customer details, and pick the vehicle internally using the distribution algorithm inside the same transaction that creates the booking. This makes vehicle assignment entirely server-controlled — inventory is never exposed and distribution cannot be bypassed.

The current implementation mitigates the correctness risk: the booking service re-validates all business rules inside the advisory lock transaction with fresh data, so no double-booking is possible regardless of how the `vehicleId` was obtained. Distribution bypass remains a theoretical concern at this scope.

---

## Timezones - UTC Throughout

**Decision:** All datetimes stored and transmitted as UTC. The frontend displays times in the user's local timezone via `toLocaleString()`.

**Reason:** The assignment explicitly allows UTC. Storing in UTC avoids ambiguity around DST transitions and simplifies overlap/buffer calculations. Local display is handled in the browser where timezone information is available.
