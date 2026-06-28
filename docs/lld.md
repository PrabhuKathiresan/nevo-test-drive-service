# Low-Level Design - Nevo Test Drive Service

Detailed request flow for each endpoint. See [High-Level Design](./hld.md) for architecture and data model.

---

## GET /api/v1/availability

```mermaid
flowchart TD
    A([GET /api/v1/availability]) --> B{Zod validation\ntype · location · startDateTime\ndurationMins · future · ≤14 days}
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
    N -->|No| O[Return\navailable: false]
    N -->|Yes| Q[Return\navailable: true]
```

---

## POST /api/v1/bookings

```mermaid
flowchart TD
    A([POST /api/v1/bookings]) --> B{Zod validation\nlocation · vehicleType · startDateTime\ndurationMins · customerName · email · phone}
    B -->|Invalid| C[400 VALIDATION_ERROR\nfield: message]
    B -->|Valid| D[Compute endDateTime\nstart + durationMins]
    D --> E["Fetch vehicles matching type + location\n- bookings filtered to conflict window ±60min\n- _count.bookings scoped to today only"]
    E --> F["Filter eligible vehicles\nvehicles.filter - isVehicleAvailable"]
    F --> G{Any eligible\nvehicles?}
    G -->|No| H[409 SLOT_UNAVAILABLE]
    G -->|Yes| I["selectLeastBooked - vehicles.reduce\nfewest bookings today · tie-break by id asc"]

    subgraph LeastBooked["selectLeastBooked()"]
        I1{v._count.bookings\n< best._count.bookings?} -->|Yes| I2[v becomes best]
        I1 -->|No| I3{Same count\nand v.id < best.id?}
        I3 -->|Yes| I2
        I3 -->|No| I4[Keep best]
        I2 --> I5{More\nvehicles?}
        I4 --> I5
        I5 -->|Yes| I1
    end

    I --> I1
    I5 -->|No| J[Begin DB transaction]
    J --> K[pg_try_advisory_xact_lock\nhashtext vehicleId · hashtext startDateTime]
    K -->|acquired: false\nanother tx in progress| L[Rollback\n409 SLOT_UNAVAILABLE]
    K -->|acquired: true| M[Fetch vehicle + bookings\nfresh data inside lock]
    M --> N{isWithinOperatingHours?\nday + hours + same UTC day}
    N -->|No| O[Rollback\n409 SLOT_UNAVAILABLE]
    N -->|Yes| P{hasBookingConflict?\noverlap or buffer violation}
    P -->|Yes| Q[Rollback\n409 SLOT_UNAVAILABLE]
    P -->|No| R[INSERT booking record\nvehicleId · start · end · customer]
    R --> S[Commit\nadvisory lock released automatically]
    S --> T[201 bookingId]
```

---

## Shared: Slot Rules

Both flows share `src/utils/slot-rules.ts`. The availability endpoint uses it to filter candidates; the booking endpoint re-runs the same checks inside the transaction as a safety net, regardless of whether the availability endpoint was called first.

```mermaid
flowchart LR
    A["GET /availability\nAvailability Service"] --> SR["slot-rules.ts\nisWithinOperatingHours\nhasBookingConflict\nisVehicleAvailable"]
    B["POST /bookings\nBooking Service"] --> SR
```
