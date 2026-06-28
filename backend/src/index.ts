import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { availabilityController } from './controllers/availability.controller';
import { bookingController } from './controllers/booking.controller';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/v1/availability', availabilityController);
app.post('/api/v1/bookings', bookingController);

app.use((_req: express.Request, res: express.Response) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' } });
});

app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
