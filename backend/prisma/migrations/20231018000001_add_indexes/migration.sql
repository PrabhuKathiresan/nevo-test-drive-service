-- Composite index for the availability query: WHERE type = ? AND location = ?
CREATE INDEX "vehicles_type_location_idx" ON "vehicles" ("type", "location");

-- FK index on bookings.vehicleId — PostgreSQL does not create FK indexes automatically.
-- Every include: { bookings: true } runs SELECT * FROM bookings WHERE "vehicleId" = ?
CREATE INDEX "bookings_vehicleId_idx" ON "bookings" ("vehicleId");
