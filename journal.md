# Journal

## Approach

I started by reading the full requirements before writing any code. The two things that stood out immediately were the even distribution requirement and the race condition requirement, both have non-obvious failure modes that influence the entire design, so I wanted to get those right before building anything else.

## Key Decisions

**PostgreSQL over NoSQL**

The booking domain is transactional by nature. A slot must belong to exactly one customer or none - there is no valid partial state. PostgreSQL gives ACID transactions and advisory locks out of the box. A document store would push correctness guarantees into application code, which is harder to reason about and test.

**Advisory lock over SELECT FOR UPDATE**

My first instinct was `SELECT FOR UPDATE` but I rejected it quickly. Row-level locks block waiting transactions while each holds a connection. Under concurrent load this exhausts the connection pool and causes unrelated requests to time out. `pg_try_advisory_xact_lock` is non-blocking - the first caller wins, all others get an immediate rejection. The lock is scoped to the transaction and releases automatically on commit or rollback.

One subtlety: `pg_try_advisory_xact_lock` takes an integer, not a string. I used `hashtext(vehicleId)` initially, but this has two problems: hash collisions (two different vehicle IDs mapping to the same key) and over-serialisation (two requests for the same vehicle at completely different times would unnecessarily block each other). I switched to the two-argument form - `pg_try_advisory_xact_lock(hashtext(vehicleId), hashtext(startDateTime))` - which scopes the lock to vehicle + exact slot. Non-conflicting slots on the same vehicle now proceed concurrently; only requests racing for the identical slot compete.

**Least-booked vehicle for even distribution**

Random assignment doesn't guarantee convergence. Round-robin requires persisted state and breaks under concurrent requests. Least-booked (using today's booking count) is deterministic, self-correcting, and derived entirely from the database - no separate state to maintain. Ties are broken by vehicle ID ascending to make selection deterministic.

I initially used all-time booking count, but switched to today's count so that a new vehicle added to the fleet isn't unfairly preferred forever just because it has zero historical bookings.

**Business rules re-validated inside the booking transaction**

The availability response is advisory - a slot can be taken between the availability check and the booking request. So the booking service re-checks operating hours, day availability, and conflict inside the transaction with fresh data, after acquiring the advisory lock. This means the business rules are enforced at the database layer regardless of how the endpoint is called.

**Modular monolith**

The scope is two endpoints and one domain. Microservices would add network hops, service discovery, and deployment complexity with no benefit at this scale. The layered structure (controller → service → repository) keeps concerns separated without the overhead.

## What I Would Do Differently

**Backend vehicle assignment from day one**

I initially implemented the availability endpoint returning a `vehicleId` which the frontend passed back in the booking request — following the assignment spec literally. The problem is this exposes internal vehicle inventory to the client and allows the distribution algorithm to be bypassed entirely. I refactored to remove `vehicleId` from both the availability response and the booking request: the booking endpoint now accepts `vehicleType` and `location`, and picks the vehicle internally inside the same transaction that creates the booking. I would design it this way from the start in a real project.


**Idempotency keys on the booking endpoint**

If a client sends a booking request and the network drops before receiving the response, they don't know if the booking was created. A retry creates a second booking. Adding an `X-Idempotency-Key` header with a key-response store (Redis or a DB table with TTL) would make retries safe.

**Vehicle timezone support**

Vehicle `availableFromTime` and `availableToTime` are stored without a timezone. The system treats them as UTC. A Dublin dealership setting `"08:00:00"` intends 8am IST, but the system interprets it as 8am UTC - customers lose an hour at the boundaries of the day. The fix is to store an IANA timezone per vehicle (e.g. `Europe/Dublin`) and compare using that.

**Streaming availability for the UI**

Currently the UI blocks while checking availability. For a polished experience, a loading skeleton on the confirmation step would feel more responsive than a disabled button.

## What I Am Most Satisfied With

The concurrency handling. The advisory lock approach is clean, correct under load, and the integration tests prove it - 5 concurrent requests for the same slot, exactly 1 succeeds, every time, against a real PostgreSQL instance with no mocking. That is the hardest part of the problem and I am confident it is right.

The separation between the availability check (which is advisory) and the booking transaction (which re-validates everything under lock) also means the system is correct even if a client skips the availability step entirely and calls the booking endpoint directly.
