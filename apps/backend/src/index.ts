import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { env } from './lib/env.js';

import authRouter from './routes/auth.routes.js';
import usersRouter from './routes/users.routes.js';
import categoriesRouter from './routes/categories.routes.js';
import equipmentRouter from './routes/equipment.routes.js';
import itemsRouter from './routes/items.routes.js';
import inventoryRouter from './routes/inventory.routes.js';
import dashboardRouter from './routes/dashboard.routes.js';


const app = express();

// Security Headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);

// Cookie Parser
app.use(cookieParser());

// Rate Limiting (60 requests per 15 minutes)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Body Parser
app.use(express.json());

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/equipment', equipmentRouter);
app.use('/api/items', itemsRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/dashboard', dashboardRouter);


// Health Check
app.get('/api/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start Server
const port = env.BACKEND_PORT || 3001;
app.listen(port, () => {
  console.log(
    `[Server] Backend listening on port ${port} in ${env.NODE_ENV} mode`,
  );
});

export default app;
