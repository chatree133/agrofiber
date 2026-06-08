import { AuthProvider } from './AuthContext.jsx';
import { MasterDataProvider } from './MasterDataContext.jsx';
import { UserProvider } from './UserContext.jsx';
import { WorkflowProvider } from './WorkflowContext.jsx';
import { ItemProvider } from './ItemContext.jsx';
import { WarehouseProvider } from './WarehouseContext.jsx';
import { CompanyProvider } from './CompanyContext.jsx';
import { CustomerProvider } from './CustomerContext.jsx';
import { QuotationProvider } from './QuotationContext.jsx';
import { SalesOrderProvider } from './SalesOrderContext.jsx';
import { DeliveryOrderProvider } from './DeliveryOrderContext.jsx';
import { WmsProvider } from './WmsContext.jsx';
import { GoodsIssueProvider } from './GoodsIssueContext.jsx';
import { GoodsReceiptProvider } from './GoodsReceiptContext.jsx';
import { PurchaseOrderProvider } from './PurchaseOrderContext.jsx';
import { VendorProvider } from './VendorContext.jsx';
import { StockProvider } from './StockContext.jsx';
import { DocumentProvider } from './DocumentContext.jsx';

// Compose helper to recursively wrap providers in correct order (leftmost = outermost)
const composeProviders = (...providers) => {
  return ({ children }) =>
    providers.reduceRight(
      (composed, Provider) => <Provider>{composed}</Provider>,
      children
    );
};

// Order is preserved: AuthProvider is outermost so inner providers can consume AuthContext
export const AppProviders = composeProviders(
  AuthProvider,
  MasterDataProvider,
  UserProvider,
  WorkflowProvider,
  ItemProvider,
  WarehouseProvider,
  CompanyProvider,
  CustomerProvider,
  QuotationProvider,
  SalesOrderProvider,
  DeliveryOrderProvider,
  WmsProvider,
  GoodsIssueProvider,
  GoodsReceiptProvider,
  PurchaseOrderProvider,
  VendorProvider,
  StockProvider,
  DocumentProvider
);
