import { Button, Input, Pagination, Select, Space, Tooltip, Badge } from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
} from '@ant-design/icons';

const pageSizeOptions = [10, 20, 50, 100].map((value) => ({ value, label: `${value}/page` }));

export default function SalesOrdersToolbar({
  searchText,
  onSearchChange,
  onSearch,
  onAdd,
  pagination,
  onPageChange,
  onPageSizeChange,
  filterCount,
  onFilter,
}) {
  return (
    <>
      {/* Row 1: Search and Add Button */}
      <div className="flex max-w-[560px]">
        <Input
          allowClear
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
          onPressEnter={() => onSearch(searchText)}
          placeholder="ค้นหาใบสั่งขาย (เลขที่เอกสาร หรือชื่อลูกค้า)..."
          className="rounded-r-none"
        />
        <Button type="primary" icon={<SearchOutlined />} className="rounded-l-none" onClick={() => onSearch(searchText)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Space>
          <Tooltip title="สร้างใบสั่งขาย">
            <Button icon={<PlusOutlined />} onClick={onAdd} />
          </Tooltip>
        </Space>

        <Space wrap>
          <Badge count={filterCount} size="small">
            <Button icon={<FilterOutlined />} onClick={onFilter} />
          </Badge>
          <span>
            {pagination.total ? (pagination.page - 1) * pagination.pageSize + 1 : 0}-
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} จากทั้งหมด {pagination.total} รายการ
          </span>
          <Pagination
            simple
            current={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            onChange={onPageChange}
          />
          <Select
            value={pagination.pageSize}
            className="w-28"
            options={pageSizeOptions}
            onChange={onPageSizeChange}
          />
        </Space>
      </div>
    </>
  );
}
