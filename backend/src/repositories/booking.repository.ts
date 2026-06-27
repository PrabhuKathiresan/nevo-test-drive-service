import prisma from '../lib/prisma';

export interface CreateBookingInput {
  vehicleId: string;
  startDateTime: Date;
  endDateTime: Date;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export async function createBooking(data: CreateBookingInput) {
  return prisma.booking.create({ data });
}
