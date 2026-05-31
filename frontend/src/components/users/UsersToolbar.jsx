import { Badge, Button, Input, Pagination, Select, Space, Tooltip } from 'antd';
import {
  DeleteOutlined,
  FileExcelOutlined,
  FilterOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';

const pageSizeOptions = [10, 20, 50, 100].map((value) => ({ value, label: `${value}/page` }));

export default function UsersToolbar({
  searchText,
  selectedCount,
  filterCount,
  pagination,
  onSearchChange,
  onSearch,
  onAdd,
  onDeleteSelected,
  onExport,
  onFilter,
  onPageChange,
  onPageSizeChange,
}) {
  return (
    <>
      <div className="flex max-w-[560px]">
        <Input
          allowClear
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
          onPressEnter={() => onSearch(searchText)}
          placeholder="Search"
          className="rounded-r-none"
        />
        <Button type="primary" icon={<SearchOutlined />} className="rounded-l-none" onClick={() => onSearch(searchText)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Space>
          <Tooltip title="Add">
            <Button icon={<PlusOutlined />} onClick={onAdd} />
          </Tooltip>
          <Tooltip title="Delete selected">
            <Button
              danger
              type="primary"
              icon={<DeleteOutlined />}
              disabled={!selectedCount}
              onClick={onDeleteSelected}
            />
          </Tooltip>
        </Space>

        <Space wrap>
          <Tooltip title="Export CSV">
            <Button icon={<FileExcelOutlined />} onClick={onExport} />
          </Tooltip>
          <Badge count={filterCount} size="small">
            <Button icon={<FilterOutlined />} onClick={onFilter} />
          </Badge>
          <span>
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
