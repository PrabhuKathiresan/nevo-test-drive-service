import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import logger from './lib/logger';
import { availabilityController } from './controllers/availability.controller';
import { bookingController } from './controllers/booking.controller';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/api/v1/availability', availabilityController);
app.post('/api/v1/bookings', bookingController);

app.use((_req: express.Request, res: express.Response) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(err, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' } });
});

app.listen(PORT, () => logger.info(`API listening on port ${PORT}`));
