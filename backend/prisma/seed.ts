import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import * as fs from 'fs';
import * as path from 'path';

dayjs.extend(utc);

const prisma = new PrismaClient();

async function main() {
  const vehiclesPath = path.join(__dirname, 'data/vehicles.json');
  const reservationsPath = path.join(__dirname, 'data/reservations.json');

  const { vehicles } = JSON.parse(fs.readFileSync(vehiclesPath, 'utf-8'));
  const { reservations } = JSON.parse(fs.readFileSync(reservationsPath, 'utf-8'));

  for (const v of vehicles) {
    await prisma.vehicle.upsert({
      where: { id: v.id },
      update: {},
      create: {
        id: v.id,
        type: v.type,
        location: v.location,
        availableFromTime: v.availableFromTime,
        availableToTime: v.availableToTime,
        availableDays: v.availableDays,
        minimumMinutesBetweenBookings: v.minimumMinutesBetweenBookings,
      },
    });
  }

  for (const r of reservations) {
    await prisma.booking.upsert({
      where: { id: String(r.id) },
      update: {},
      create: {
        id: String(r.id),
        vehicleId: r.vehicleId,
        startDateTime: dayjs.utc(r.startDateTime).toDate(),
        endDateTime: dayjs.utc(r.endDateTime).toDate(),
        customerName: r.customerName,
        customerEmail: r.customerEmail,
        customerPhone: r.customerPhone,
      },
    });
  }

  console.log('Seed complete');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
