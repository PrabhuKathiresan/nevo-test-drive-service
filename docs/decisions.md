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

**Decision:** Among eligible vehicles, select the one with the fewest all-time bookings. Break ties by vehicle ID ascending.

**Reason:** Random assignment doesn't guarantee convergence. Round-robin requires persisted state and breaks under concurrent requests. Least-booked is deterministic, stateless (derived from the DB), and self-correcting - if one vehicle accumulates more bookings, it will be deprioritised automatically.

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

## Timezones - UTC Throughout

**Decision:** All datetimes stored and transmitted as UTC. The frontend displays times in the user's local timezone via `toLocaleString()`.

**Reason:** The assignment explicitly allows UTC. Storing in UTC avoids ambiguity around DST transitions and simplifies overlap/buffer calculations. Local display is handled in the browser where timezone information is available.
