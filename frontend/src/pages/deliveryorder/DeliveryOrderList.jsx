import React, { useEffect, useState } from 'react';
import { Card, Space, Table, Tag, Typography, message, Pagination } from 'antd';
import { TruckOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDeliveryOrder } from '../../context/DeliveryOrderContext.jsx';

const { Title, Text } = Typography;

export default function DeliveryOrderList() {
  const navigate = useNavigate();
  const { getDeliveryOrders } = useDeliveryOrder();
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 15, total: 0 });

  const fetchDeliveryOrders = async (page = 1) => {
    setLoading(true);
    try {
      const res = await getDeliveryOrders({
        page,
        pageSize: pagination.pageSize
      });
      setDeliveryOrders(res.data || []);
      setPagination(prev => ({
        ...prev,
        page,
        total: res.pagination?.total || 0
      }));
    } catch (err) {
      message.error('ไม่สามารถดึงข้อมูลใบส่งสินค้าได้: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveryOrders();
  }, []);

  const onPageChange = (page) => {
    fetchDeliveryOrders(page);
  };

  const columns = [
    {
      title: 'เลขที่เอกสาร DO',
      dataIndex: 'documentNo',
      key: 'documentNo',
      render: (text, r) => <a onClick={() => navigate(`/deliveryorder/${r.id}`)}>{text}</a>,
    },
    {
      title: 'อ้างอิง Sales Order',
      dataIndex: 'salesOrderNo',
      key: 'salesOrderNo',
      render: (text) => text ? <Text strong>{text}</Text> : '-',
    },
    {
      title: 'ลูกค้า',
      dataIndex: 'customerName',
      key: 'customerName',
      render: (text, r) => `${r.customerCode} - ${text}`,
    },
    {
      title: 'วันที่เอกสาร',
      dataIndex: 'documentDate',
      key: 'documentDate',
      render: (date) => new Date(date).toLocaleDateString('th-TH'),
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'closed' ? 'green' : status === 'shipped' ? 'blue' : 'orange'}>
          {status === 'closed' ? 'ส่งมอบแล้ว (Closed)' : status === 'shipped' ? 'จัดส่งแล้ว' : 'ฉบับร่าง (Draft)'}
        </Tag>
      ),
    },
    {
      title: 'ที่อยู่จัดส่ง',
      dataIndex: 'shipToAddress',
      key: 'shipToAddress',
      ellipsis: true,
    },
    {
      title: 'วันที่บันทึก',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString('th-TH'),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-800">
        ใบส่งสินค้า (Delivery Order)
      </h1>
      <div className="shadow-sm">
        <div className="flex justify-end items-center gap-4 mb-4">
          <span className="text-slate-500 text-sm">
            {pagination.total ? (pagination.page - 1) * pagination.pageSize + 1 : 0}-
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} items
          </span>
          <Pagination
            simple
            current={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            onChange={onPageChange}
          />
        </div>
        <div className="rounded-lg border border-slate-200">
          <Table
            size='small'
            columns={columns}
            dataSource={deliveryOrders.map(doItem => ({ ...doItem, key: doItem.id }))}
            loading={loading}
            pagination={false}
          />
        </div>
      </div>
    </div>
  );
}
