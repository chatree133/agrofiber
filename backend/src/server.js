import 'dotenv/config';
import express from 'express';
import path from 'path';
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
import accountRoutes from './routes/account.js';
import customerRoutes from './routes/customer.js';
import customerPriceContractRoutes from './routes/customerPriceContract.js';
import inventoryRoutes from './routes/inventory.js';
import stockRoutes from './routes/stock.js';
import wmsRoutes from './routes/wms.js';
import masterRoutes from './routes/masterData.js';
import warehouseRoutes from './routes/warehouses.js';
import itemRoutes from './routes/items.js';
import goodsIssueRoutes from './routes/goodsIssue.js';
import goodsReceiptRoutes from './routes/goodsReceipt.js';
import approvalRoutes from './routes/approval.js';
import workflowRoutes from './routes/workflows.js';
import productionOrderRoutes from './routes/productionOrder.js';
import salesInvoiceRoutes from './routes/salesInvoice.js';
import customerPaymentRoutes from './routes/customerPayment.js';
import qcRoutes from './routes/qc.js';
import companyRoutes from './routes/company.js';
import loadPlanRoutes from './routes/loadPlans.js';

const app = express();
const port = process.env.PORT || 4000;

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '3mb' }));
app.use(morgan('dev'));
app.use('/uploads', express.static(path.resolve('uploads')));
app.use('/public', express.static(path.resolve('src/public')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'agrofiber-erp-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/sale-orders', saleOrderRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/delivery-orders', deliveryOrderRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/customer-price-contracts', customerPriceContractRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/inventory/items', itemRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/goods-issues', goodsIssueRoutes);
app.use('/api/goods-receipts', goodsReceiptRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/production-orders', productionOrderRoutes);
app.use('/api/sales-invoices', salesInvoiceRoutes);
app.use('/api/customer-payments', customerPaymentRoutes);
app.use('/api/qc', qcRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/wms', wmsRoutes);
app.use('/api/wms/load-plans', loadPlanRoutes);
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
