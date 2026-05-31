import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Modal, Typography, Form } from 'antd';
import SalesOrdersToolbar from '../../components/items/SalesOrdersToolbar.jsx';
import SalesOrdersTable from '../../components/items/SalesOrdersTable.jsx';
import SalesOrdersFilterModal from '../../components/items/SalesOrdersFilterModal.jsx';
import { useSalesOrder } from '../../context/SalesOrderContext.jsx';

const { Text } = Typography;

export default function SalesOrderList() {
  const navigate = useNavigate();
  const { getSalesOrders, cancelSalesOrder } = useSalesOrder();

  // State
  const [salesOrders, setSalesOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState(null); // [dateFrom, dateTo] as dayjs objects

  // Filter form modal states
  const [filterForm] = Form.useForm();
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterInitialValues, setFilterInitialValues] = useState({});

  const filterCount =
    (statusFilter ? 1 : 0) +
    (dateRange && dateRange[0] && dateRange[1] ? 1 : 0);

  const applyFilter = async () => {
    const values = await filterForm.validateFields();
    setFilterInitialValues(values);
    setStatusFilter(values.status || '');
    setDateRange(values.dateRange || null);
    setFilterOpen(false);
  };

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
  });

  const loadSalesOrders = async (next = {}) => {
    setLoading(true);
    const page = next.page ?? pagination.page;
    const pageSize = next.pageSize ?? pagination.pageSize;

    // Build filters
    const params = {
      page,
      pageSize,
      search: appliedSearch || undefined,
      status: statusFilter || undefined,
    };

    if (dateRange && dateRange[0] && dateRange[1]) {
      params.dateFrom = dateRange[0].format('YYYY-MM-DD');
      params.dateTo = dateRange[1].format('YYYY-MM-DD');
    }

    try {
      const res = await getSalesOrders(params);
      setSalesOrders(res.data || []);
      setPagination({
        page: res.pagination?.page || page,
        pageSize: res.pagination?.pageSize || pageSize,
        total: res.pagination?.total || 0,
      });
    } catch (err) {
      console.error('Failed to load sales orders', err);
      message.error('โหลดข้อมูลใบสั่งขายไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  // Reload when search or filter states change
  useEffect(() => {
    loadSalesOrders({ page: 1 });
  }, [appliedSearch, statusFilter, dateRange]);

  const handleSearch = () => {
    setAppliedSearch(searchText);
  };

  const handleSearchChange = (val) => {
    setSearchText(val);
    if (!val) {
      setAppliedSearch('');
    }
  };

  const handleAdd = () => {
    navigate('/salesorder/create');
  };

  const handleEdit = (record) => {
    // Navigate to Sales Order creation form with clone/edit parameters
    navigate(`/salesorder/create?cloneId=${record.id}`);
  };

  const handleView = (record) => {
    navigate(`/salesorder/create?viewId=${record.id}`);
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: `ยืนยันการยกเลิกใบสั่งขาย?`,
      content: (
        <div>
          <p>คุณต้องการยกเลิกใบสั่งขายเลขที่ <Text strong className="text-slate-800">{record.documentNo}</Text> จริงหรือไม่?</p>
          <p className="text-red-500 font-medium text-xs mt-1">* ระบบจะเปลี่ยนสถานะเป็น "ยกเลิก (Cancelled)" และทำการคืนยอดจองสินค้า (Release Reservations)</p>
        </div>
      ),
      okText: 'ยกเลิกใบสั่งขาย',
      okButtonProps: { danger: true },
      cancelText: 'ย้อนกลับ',
      onOk: async () => {
        try {
          await cancelSalesOrder(record.id);
          message.success('ยกเลิกใบสั่งขายสำเร็จ');
          await loadSalesOrders();
        } catch (err) {
          console.error('Cancel sales order failed', err);
          message.error(err.message || 'ยกเลิกใบสั่งขายล้มเหลว');
        }
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar controls */}
      <SalesOrdersToolbar
        searchText={searchText}
        onSearchChange={handleSearchChange}
        onSearch={handleSearch}
        onAdd={handleAdd}
        pagination={pagination}
        onPageChange={(page) => loadSalesOrders({ page })}
        onPageSizeChange={(pageSize) => loadSalesOrders({ page: 1, pageSize })}
        filterCount={filterCount}
        onFilter={() => setFilterOpen(true)}
      />

      {/* Table grid */}
      <SalesOrdersTable
        salesOrders={salesOrders}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
      />

      {/* Filter modal */}
      <SalesOrdersFilterModal
        open={filterOpen}
        form={filterForm}
        initialValues={filterInitialValues}
        onCancel={() => setFilterOpen(false)}
        onSubmit={applyFilter}
      />
    </div>
  );
}
