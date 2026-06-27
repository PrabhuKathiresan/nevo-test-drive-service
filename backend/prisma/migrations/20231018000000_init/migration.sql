CREATE TABLE "vehicles" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "availableFromTime" TEXT NOT NULL,
  "availableToTime" TEXT NOT NULL,
  "availableDays" TEXT[] NOT NULL,
  "minimumMinutesBetweenBookings" INTEGER NOT NULL,
  CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bookings" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "startDateTime" TIMESTAMPTZ NOT NULL,
  "endDateTime" TIMESTAMPTZ NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerEmail" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bookings_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
