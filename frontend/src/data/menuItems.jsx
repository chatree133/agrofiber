import {
  AppstoreOutlined,
  AuditOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  FileDoneOutlined,
  FileSearchOutlined,
  HomeOutlined,
  SettingOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  StarOutlined,
  SwapOutlined,
  TeamOutlined,
  TruckOutlined,
} from '@ant-design/icons';

export const navMenus = [
  {
    key: 'users',
    label: 'ปรับแต่งผู้ใช้',
    children: [
      { key: '/users', label: 'ผู้ใช้งาน' },
      { key: '/roles', label: 'สิทธิ์การใช้งาน' },
    ],
  },
  {
    key: 'inventory',
    label: 'สินค้าคงคลัง',
    children: [
      { key: '/inventory/settings', label: 'ตั้งค่า' },
      { key: '/inventory/sales', label: 'ขาย' },
      { key: '/inventory/purchase', label: 'ซื้อ' },
      { key: '/inventory/production', label: 'ผลิต' },
      { key: '/inventory/transfer', label: 'เคลื่อนย้ายสินค้า' },
      { key: '/inventory/reports', label: 'รายงาน' },
    ],
  },
  { key: '/menu1', label: 'เมนู1' },
  { key: '/menu2', label: 'เมนู2' },
  { key: '/menu3', label: 'เมนู3' },
];

export const appMenus = [
  {
    key: '/favorite',
    icon: <StarOutlined />,
    label: 'Favorite',
    allowedRoles: ['admin', 'accounting', 'user', 'audit'],
    children: [],
  },
  {
    key: '/dashboard',
    icon: <HomeOutlined />,
    label: 'Dashboard',
    allowedRoles: ['admin', 'accounting', 'user', 'audit'],
  },
  {
    key: '/salesorder',
    icon: <FileSearchOutlined />,
    label: 'ใบสั่งขาย',
    allowedRoles: ['admin', 'accounting', 'user'],
    children: [
      {
        key: '/salesorder/create',
        label: 'สร้างใบสั่งขาย',
        allowedRoles: ['admin', 'user'],
      },
      {
        key: '/salesorder/list',
        label: 'รายการใบสั่งขาย',
        allowedRoles: ['admin', 'accounting', 'user', 'audit'],
      },
    ],
  },
  {
    key: '/quotation',
    icon: <FileDoneOutlined />,
    label: 'ใบเสนอราคา',
    allowedRoles: ['admin', 'user'],
    children: [
      { key: '/quotation/create', label: 'สร้างใบเสนอราคา', allowedRoles: ['admin', 'user'] },
      { key: '/quotation/list', label: 'รายการใบเสนอราคา', allowedRoles: ['admin', 'user', 'audit'] },
    ],
  },
  {
    key: '/purchaseorder',
    icon: <ShoppingCartOutlined />,
    label: 'ใบสั่งซื้อ',
    allowedRoles: ['admin', 'accounting'],
    children: [
      { key: '/purchaseorder/create', label: 'สร้างใบสั่งซื้อ', allowedRoles: ['admin', 'accounting'] },
      { key: '/purchaseorder/list', label: 'รายการใบสั่งซื้อ', allowedRoles: ['admin', 'accounting', 'audit'] },
    ],
  },
  {
    key: '/deliveryorder',
    icon: <TruckOutlined />,
    label: 'ใบส่งสินค้า',
    allowedRoles: ['admin', 'user'],
    children: [
      { key: '/deliveryorder/create', label: 'สร้างใบส่งสินค้า', allowedRoles: ['admin', 'user'] },
      { key: '/deliveryorder/list', label: 'รายการใบส่งสินค้า', allowedRoles: ['admin', 'user', 'audit'] },
    ],
  },
  {
    key: '/inventory',
    icon: <DatabaseOutlined />,
    label: 'สินค้าคงคลัง',
    allowedRoles: ['admin', 'accounting', 'user', 'audit'],
    children: [
      { key: '/inventory/items', label: 'สินค้า', allowedRoles: ['admin', 'user', 'audit'] },
      { key: '/inventory/stock', label: 'ยอดคงเหลือ', allowedRoles: ['admin', 'accounting', 'user', 'audit'] },
      { key: '/inventory/transfer', label: 'เคลื่อนย้ายสินค้า', allowedRoles: ['admin', 'user'] },
      { key: '/inventory/reports', label: 'รายงานสินค้าคงคลัง', allowedRoles: ['admin', 'accounting', 'audit'] },
    ],
  },
  {
    key: '/wms',
    icon: <AppstoreOutlined />,
    label: 'WMS',
    allowedRoles: ['admin', 'user'],
    children: [
      { key: '/wms/receiving', label: 'รับสินค้าเข้าคลัง', allowedRoles: ['admin', 'user'] },
      { key: '/wms/picking', label: 'หยิบสินค้า', allowedRoles: ['admin', 'user'] },
      { key: '/wms/packing', label: 'แพ็คสินค้า', allowedRoles: ['admin', 'user'] },
    ],
  },
  {
    key: '/master',
    icon: <ShopOutlined />,
    label: 'ข้อมูลหลัก',
    allowedRoles: ['admin'],
    children: [
      { key: '/master/customers', label: 'ลูกค้า', allowedRoles: ['admin', 'accounting'] },
      { key: '/master/vendors', label: 'ผู้ขาย', allowedRoles: ['admin', 'accounting'] },
      { key: '/master/warehouses', label: 'คลังสินค้า', allowedRoles: ['admin'] },
    ],
  },
  {
    key: '/reports',
    icon: <BarChartOutlined />,
    label: 'Reports',
    allowedRoles: ['admin', 'accounting', 'audit'],
    children: [
      { key: '/reports/sales', label: 'รายงานขาย', allowedRoles: ['admin', 'accounting', 'audit'] },
      { key: '/reports/stock', label: 'รายงานสต็อก', allowedRoles: ['admin', 'accounting', 'audit'] },
    ],
  },
  {
    key: '/users',
    icon: <TeamOutlined />,
    label: 'User Portal',
    allowedRoles: ['admin'],
    children: [
      { key: '/users', label: 'ผู้ใช้งาน', allowedRoles: ['admin'] },
      { key: '/roles', label: 'บทบาท', allowedRoles: ['admin'] },
    ],
  },
  {
    key: '/audit',
    icon: <AuditOutlined />,
    label: 'Audit',
    allowedRoles: ['admin', 'audit'],
    children: [
      { key: '/audit/logs', label: 'Audit Logs', allowedRoles: ['admin', 'audit'] },
      { key: '/audit/approvals', label: 'รายการอนุมัติ', allowedRoles: ['admin', 'audit'] },
    ],
  },
  {
    key: '/settings',
    icon: <SettingOutlined />,
    label: 'Administrator',
    allowedRoles: ['admin'],
    children: [
      { key: '/settings/company', label: 'บริษัท', allowedRoles: ['admin'] },
      { key: '/settings/numbering', label: 'เลขที่เอกสาร', allowedRoles: ['admin'] },
    ],
  },
];

export function flattenMenus(items = appMenus) {
  return items.flatMap((item) => [item, ...(item.children || [])]);
}

export function findMenuPath(pathname, items = appMenus) {
  for (const item of items) {
    if (item.key === pathname) return [item];
    const child = item.children?.find((entry) => entry.key === pathname);
    if (child) return [item, child];
  }
  return [];
}
