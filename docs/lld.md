# Low-Level Design - Nevo Test Drive Service

Detailed request flow for each endpoint. See [High-Level Design](./hld.md) for architecture and data model.

---

## POST /api/v1/availability

```mermaid
flowchart TD
    A([POST /api/v1/availability]) --> B{Zod validation\ntype · location · startDateTime\ndurationMins · future · ≤14 days}
    B -->|Invalid| C[400 VALIDATION_ERROR\nfield: message]
    B -->|Valid| D[Compute endDateTime\nstart + durationMins]
    D --> E["Fetch vehicles matching type + location\n- bookings filtered to conflict window ±60min\n- _count.bookings scoped to today only"]
    E --> F["Filter eligible vehicles\nvehicles.filter - isVehicleAvailable"]

    subgraph SlotRules["isVehicleAvailable - slot-rules.ts"]
        G{Day of week\nin availableDays?} -->|No| H[Exclude]
        G -->|Yes| I{Booking spans\nsame UTC day?}
        I -->|No| H
        I -->|Yes| J{start ≥ availableFromTime\nend ≤ availableToTime?}
        J -->|No| H
        J -->|Yes| K{Overlaps existing booking\nor buffer window?}
        K -->|Yes| H
        K -->|No| L[Include]
    end

    F --> SlotRules
    SlotRules --> N{Any eligible\nvehicles?}
    N -->|No| O[Return\navailable: false · vehicleId: null]
    N -->|Yes| P["selectLeastBooked - vehicles.reduce"]

    subgraph LeastBooked["selectLeastBooked()"]
        P1{v._count.bookings\n< best._count.bookings?} -->|Yes| P2[v becomes best]
        P1 -->|No| P3{Same count\nand v.id < best.id?}
        P3 -->|Yes| P2
        P3 -->|No| P4[Keep best]
        P2 --> P5{More\nvehicles?}
        P4 --> P5
        P5 -->|Yes| P1
    end

    P --> P1
    P5 -->|No| Q[Return\navailable: true · vehicleId: best.id]
```

---

## POST /api/v1/bookings

```mermaid
flowchart TD
    A([POST /api/v1/bookings]) --> B{Zod validation\nvehicleId · startDateTime · durationMins\ncustomerName · email · phone}
    B -->|Invalid| C[400 VALIDATION_ERROR\nfield: message]
    B -->|Valid| D[Compute endDateTime\nstart + durationMins]
    D --> E[Begin DB transaction]
    E --> F[pg_try_advisory_xact_lock\nhashtext vehicleId]
    F -->|acquired: false\nanother tx in progress| G[Rollback\n409 SLOT_UNAVAILABLE]
    F -->|acquired: true| H[Fetch vehicle + bookings\nFOR SHARE of lock]
    H -->|Not found| I[Rollback\n404 VEHICLE_NOT_FOUND]
    H -->|Found| J{isWithinOperatingHours?\nday + hours + same UTC day}
    J -->|No| K[Rollback\n409 SLOT_UNAVAILABLE]
    J -->|Yes| L{hasBookingConflict?\noverlap or buffer violation}
    L -->|Yes| M[Rollback\n409 SLOT_UNAVAILABLE]
    L -->|No| N[INSERT booking record\nvehicleId · start · end · customer]
    N --> O[Commit\nadvisory lock released automatically]
    O --> P[201 bookingId]
```

---

## Shared: Slot Rules

Both flows share `src/utils/slot-rules.ts`. The availability endpoint uses it to filter candidates; the booking endpoint re-runs the same checks inside the transaction as a safety net, regardless of whether the availability endpoint was called first.

```mermaid
flowchart LR
    A["POST /availability\nAvailability Service"] --> SR["slot-rules.ts\nisWithinOperatingHours\nhasBookingConflict\nisVehicleAvailable"]
    B["POST /bookings\nBooking Service"] --> SR
```
