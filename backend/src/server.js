import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import { corsOptions } from './config/cors.js';
import authRoutes from './routes/auth.js';
import saleOrderRoutes from './routes/saleOrder.js';
import purchaseOrderRoutes from './routes/purchaseOrder.js';
import deliveryOrderRoutes from './routes/deliveryOrder.js';
import quotationRoutes from './routes/quotation.js';
import userRoutes from './routes/user.js';
import inventoryRoutes from './routes/inventory.js';
import stockRoutes from './routes/stock.js';
import wmsRoutes from './routes/wms.js';
import masterRoutes from './routes/masterData.js';

const app = express();
const port = process.env.PORT || 4000;

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'agrofiber-erp-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/sale-orders', saleOrderRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/delivery-orders', deliveryOrderRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/wms', wmsRoutes);
app.use('/api/master-data', masterRoutes);

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({
    message: error.message || 'Internal server error',
  });
});

app.listen(port, () => {
  console.log(`Agrofiber ERP API listening on port ${port}`);
});
