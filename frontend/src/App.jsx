import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { AppProviders } from './context/AppProviders.jsx';
import MainLayout from './components/MainLayout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import GenericPage from './pages/GenericPage.jsx';
import Login from './pages/Login.jsx';
import SalesOrderCreate from './pages/salesOrders/SalesOrderCreate.jsx';
import DeliveryScheduler from './pages/salesOrders/DeliveryScheduler.jsx';
import SalesOrderList from './pages/salesOrders/SalesOrderList.jsx';
import Users from './pages/users/Users.jsx';
import Roles from './pages/users/Roles.jsx';
import Items from './pages/master/Items.jsx';
import ItemForm from './pages/master/ItemForm.jsx';
import Warehouses from './pages/master/Warehouses.jsx';
import CompanyList from './pages/settings/CompanyList.jsx';
import CompanyForm from './pages/settings/CompanyForm.jsx';
import Numbering from './pages/settings/Numbering.jsx';
import SmtpSettings from './pages/settings/SmtpSettings.jsx';
import PricingPolicies from './pages/master/PricingPolicies.jsx';
import PricingPolicyHistory from './pages/master/PricingPolicyHistory.jsx';
import Customers from './pages/master/Customers.jsx';
import CustomerForm from './pages/master/CustomerForm.jsx';
import WorkflowSettings from './pages/master/WorkflowSettings.jsx';
import QuotationCreate from './pages/quotation/QuotationCreate.jsx';
import QuotationList from './pages/quotation/QuotationList.jsx';
import StockCheck from './pages/inventory/StockCheck.jsx';
import StockList from './pages/inventory/StockList.jsx';
import InventoryReports from './pages/inventory/InventoryReports.jsx';
import DocumentPrint from './pages/document/DocumentPrint.jsx';
import ApprovalsDashboard from './pages/audit/ApprovalsDashboard.jsx';
import Receiving from './pages/wms/Receiving.jsx';
import PickingList from './pages/wms/PickingList.jsx';
import WavePickingDetail from './pages/wms/WavePickingDetail.jsx';
import TransferTasks from './pages/wms/TransferTasks.jsx';
import TransferTaskDetail from './pages/wms/TransferTaskDetail.jsx';
import WmsDashboard from './pages/wms/WmsDashboard.jsx';
import IncidentList from './pages/wms/IncidentList.jsx';
import LoadPlanList from './pages/wms/LoadPlanList.jsx';
import LoadPlanCreate from './pages/wms/LoadPlanCreate.jsx';
import DriverPortal from './pages/wms/DriverPortal.jsx';
import TransportMaster from './pages/wms/TransportMaster.jsx';
import DeliveryOrderList from './pages/deliveryorder/DeliveryOrderList.jsx';
import DeliveryOrderDetail from './pages/deliveryorder/DeliveryOrderDetail.jsx';
import GoodsIssueList from './pages/inventory/GoodsIssueList.jsx';
import GoodsIssueForm from './pages/inventory/GoodsIssueForm.jsx';
import GoodsIssueDetail from './pages/inventory/GoodsIssueDetail.jsx';
import GoodsReceiptList from './pages/inventory/GoodsReceiptList.jsx';
import GoodsReceiptForm from './pages/inventory/GoodsReceiptForm.jsx';
import GoodsReceiptDetail from './pages/inventory/GoodsReceiptDetail.jsx';
import InventoryTransfer from './pages/inventory/InventoryTransfer.jsx';
import TransactionTypes from './pages/master/TransactionTypes.jsx';
import Conversions from './pages/master/Conversions.jsx';
import Uom from './pages/master/Uom.jsx';

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="salesorder/create" element={<SalesOrderCreate />} />
        <Route path="salesorder/list" element={<SalesOrderList />} />
        <Route path="users" element={<Users />} />
        <Route path="roles" element={<Roles />} />
        <Route path="master/items" element={<Items />} />
        <Route path="master/items/create" element={<ItemForm />} />
        <Route path="master/items/:id/edit" element={<ItemForm />} />
        <Route path="master/conversions" element={<Conversions />} />
        <Route path="master/pricing-policies" element={<PricingPolicies />} />
        <Route path="master/pricing-policy-history" element={<PricingPolicyHistory />} />
        <Route path="master/workflows" element={<WorkflowSettings />} />
        <Route path="master/warehouses" element={<Warehouses />} />
        <Route path="master/customers" element={<Customers />} />
        <Route path="master/customers/create" element={<CustomerForm />} />
        <Route path="master/customers/:id/edit" element={<CustomerForm />} />
        <Route path="master/uom" element={<Uom />} />
        
        <Route path="quotation/create" element={<QuotationCreate />} />
        <Route path="quotation/list" element={<QuotationList />} />
        <Route path="inventory/stock-check" element={<StockCheck />} />
        <Route path="inventory/stock" element={<StockList />} />
        <Route path="inventory/reports" element={<InventoryReports />} />
        
        {/* Goods Issue Routes */}
        <Route path="inventory/goods-issues" element={<GoodsIssueList />} />
        <Route path="inventory/goods-issues/create" element={<GoodsIssueForm />} />
        <Route path="inventory/goods-issues/:id" element={<GoodsIssueDetail />} />
        <Route path="inventory/goods-issues/:id/edit" element={<GoodsIssueForm />} />

        {/* Goods Receipt Routes */}
        <Route path="inventory/goods-receipts" element={<GoodsReceiptList />} />
        <Route path="inventory/goods-receipts/create" element={<GoodsReceiptForm />} />
        <Route path="inventory/goods-receipts/:id" element={<GoodsReceiptDetail />} />
        <Route path="inventory/goods-receipts/:id/edit" element={<GoodsReceiptForm />} />
        <Route path="inventory/transfer" element={<InventoryTransfer />} />

        {/* Master Transaction Types */}
        <Route path="master/transaction-types" element={<TransactionTypes />} />
        
        <Route path="document/print" element={<DocumentPrint />} />
        <Route path="audit/approvals" element={<ApprovalsDashboard />} />
        
        {/* WMS Routes */}
        <Route path="wms/dashboard" element={<WmsDashboard />} />
        <Route path="wms/receiving" element={<Receiving />} />
        <Route path="wms/picking" element={<PickingList />} />
        <Route path="wms/waves/:id" element={<WavePickingDetail />} />
        <Route path="wms/transfers" element={<TransferTasks />} />
        <Route path="wms/transfers/:id" element={<TransferTaskDetail />} />
        <Route path="wms/incidents" element={<IncidentList />} />
        <Route path="wms/transport-master" element={<TransportMaster />} />
        <Route path="wms/load-plans" element={<LoadPlanList />} />
        <Route path="wms/load-plans/create" element={<LoadPlanCreate />} />
        
        {/* Delivery Order Routes */}
        <Route path="deliveryorder/list" element={<DeliveryOrderList />} />
        <Route path="deliveryorder/:id" element={<DeliveryOrderDetail />} />
        
        <Route path="settings/company" element={<CompanyList />} />
        <Route path="settings/company/create" element={<CompanyForm />} />
        <Route path="settings/company/:id/edit" element={<CompanyForm />} />
        <Route path="settings/numbering" element={<Numbering />} />
        <Route path="settings/smtp" element={<SmtpSettings />} />
        <Route path="*" element={<GenericPage />} />
      </Route>
      <Route
        path="/driver/deliveries"
        element={
          <ProtectedRoute>
            <DriverPortal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/salesorder/delivery-scheduler"
        element={
          <ProtectedRoute>
            <DeliveryScheduler />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  );
}
