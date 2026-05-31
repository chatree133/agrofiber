import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Modal, Card, Typography, Form } from 'antd';
import QuotationsToolbar from '../../components/items/QuotationsToolbar.jsx';
import QuotationsTable from '../../components/items/QuotationsTable.jsx';
import QuotationsFilterModal from '../../components/items/QuotationsFilterModal.jsx';
import { useQuotation } from '../../context/QuotationContext.jsx';

const { Title, Text } = Typography;

export default function QuotationList() {
  const navigate = useNavigate();
  const { getQuotations, deleteQuotation } = useQuotation();

  // State
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState(null); // [startDate, endDate] as dayjs objects

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

  const loadQuotations = async (next = {}) => {
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
      params.startDate = dateRange[0].format('YYYY-MM-DD');
      params.endDate = dateRange[1].format('YYYY-MM-DD');
    }

    try {
      const res = await getQuotations(params);
      setQuotations(res.data || []);
      setPagination({
        page: res.pagination?.page || page,
        pageSize: res.pagination?.pageSize || pageSize,
        total: res.pagination?.total || 0,
      });
    } catch (err) {
      console.error('Failed to load quotations', err);
      message.error('โหลดข้อมูลใบเสนอราคาไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  // Reload when search or filter states change
  useEffect(() => {
    loadQuotations({ page: 1 });
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
    navigate('/quotation/create');
  };

  const handleEdit = (record) => {
    // Navigate to Quotation creation form with clone/edit parameters
    navigate(`/quotation/create?cloneId=${record.id}`);
  };

  const handleView = (record) => {
    navigate(`/quotation/create?viewId=${record.id}`);
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: `ยืนยันการลบใบเสนอราคา?`,
      content: (
        <div>
          <p>คุณต้องการลบใบเสนอราคาเลขที่ <Text strong className="text-slate-800">{record.documentNo}</Text> จริงหรือไม่?</p>
          <p className="text-red-500 font-medium text-xs mt-1">* การลบจะเป็นแบบ Soft Delete โดยระบบจะเปลี่ยนสถานะเป็น "ปิดเอกสาร (Closed)"</p>
        </div>
      ),
      okText: 'ลบเอกสาร',
      okButtonProps: { danger: true },
      cancelText: 'ยกเลิก',
      onOk: async () => {
        try {
          await deleteQuotation(record.id);
          message.success('ลบใบเสนอราคา (ปิดเอกสาร) สำเร็จ');
          await loadQuotations();
        } catch (err) {
          console.error('Delete quotation failed', err);
          message.error(err.message || 'ลบใบเสนอราคาล้มเหลว');
        }
      },

    });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar controls */}
      <QuotationsToolbar
        searchText={searchText}
        onSearchChange={handleSearchChange}
        onSearch={handleSearch}
        onAdd={handleAdd}
        pagination={pagination}
        onPageChange={(page) => loadQuotations({ page })}
        onPageSizeChange={(pageSize) => loadQuotations({ page: 1, pageSize })}
        filterCount={filterCount}
        onFilter={() => setFilterOpen(true)}
      />

      {/* Table grid */}
      <QuotationsTable
        quotations={quotations}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
      />

      {/* Filter modal */}
      <QuotationsFilterModal
        open={filterOpen}
        form={filterForm}
        initialValues={filterInitialValues}
        onCancel={() => setFilterOpen(false)}
        onSubmit={applyFilter}
      />
    </div>
  );
}
