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
    ScheduleOutlined,
    TeamOutlined,
    TruckOutlined,
} from "@ant-design/icons";

export const navMenus = [
    {
        key: "users",
        label: "ปรับแต่งผู้ใช้",
        children: [
            { key: "/users", label: "ผู้ใช้งาน" },
            { key: "/roles", label: "สิทธิ์การใช้งาน" },
        ],
    },
    {
        key: "inventory",
        label: "สินค้าคงคลัง",
        children: [
            { key: "/inventory/stock", label: "ยอดคงเหลือ" },
            { key: "/inventory/transfer", label: "เคลื่อนย้ายสินค้า" },
            { key: "/inventory/goods-receipts", label: "รับสินค้า (GR)" },
            { key: "/inventory/goods-issues", label: "จ่ายสินค้า (GI)" },
            { key: "/inventory/reports", label: "รายงานสินค้า" },
        ],
    },
    {
        key: "/wms",
        label: "WMS",
        children: [{ key: "/wms/dashboard", label: "Dashboard" }],
    },
];

export const appMenus = [
    {
        key: "/favorite",
        icon: <StarOutlined />,
        label: "Favorite",
        allowedRoles: ["admin", "accounting", "user", "audit"],
        children: [],
    },
    {
        key: "/dashboard",
        icon: <HomeOutlined />,
        label: "Dashboard",
        allowedRoles: ["admin", "accounting", "user", "audit"],
    },
    {
        key: "/salesorder",
        icon: <FileSearchOutlined />,
        label: "ใบสั่งขาย (Sale Order)",
        allowedRoles: ["admin", "accounting", "user"],
        children: [
            {
                key: "/salesorder/create",
                label: "สร้างใบสั่งขาย",
                allowedRoles: ["admin", "user"],
            },
            {
                key: "/salesorder/list",
                label: "รายการใบสั่งขาย",
                allowedRoles: ["admin", "accounting", "user", "audit"],
            },
        ],
    },
    {
        key: "/quotation",
        icon: <FileDoneOutlined />,
        label: "ใบเสนอราคา (Quotation)",
        allowedRoles: ["admin", "user"],
        children: [
            {
                key: "/quotation/create",
                label: "สร้างใบเสนอราคา",
                allowedRoles: ["admin", "user"],
            },
            {
                key: "/quotation/list",
                label: "รายการใบเสนอราคา",
                allowedRoles: ["admin", "user", "audit"],
            },
        ],
    },
    {
        key: "/purchaseorder",
        icon: <ShoppingCartOutlined />,
        label: "ใบสั่งซื้อ (Purchase Order)",
        allowedRoles: ["admin", "accounting"],
        hiddenInMenu: true,
        children: [
            {
                key: "/purchaseorder/create",
                label: "สร้างใบสั่งซื้อ",
                allowedRoles: ["admin", "accounting"],
            },
            {
                key: "/purchaseorder/list",
                label: "รายการใบสั่งซื้อ",
                allowedRoles: ["admin", "accounting", "audit"],
            },
        ],
    },
    {
        key: "/deliveryorder",
        icon: <ScheduleOutlined />,
        label: "ใบส่งสินค้า (Delivery Order)",
        allowedRoles: ["admin", "user"],
        children: [
            {
                key: "/deliveryorder/list",
                label: "รายการใบส่งสินค้า",
                allowedRoles: ["admin", "user", "audit"],
            },
        ],
    },
    {
        key: "/inventory",
        icon: <DatabaseOutlined />,
        label: "สินค้าคงคลัง",
        allowedRoles: ["admin", "accounting", "user", "audit"],
        children: [
            {
                key: "/inventory/items",
                label: "สินค้า",
                allowedRoles: ["admin", "user", "audit"],
            },
            {
                key: "/inventory/stock",
                label: "ยอดคงเหลือ",
                allowedRoles: ["admin", "accounting", "user", "audit"],
            },
            {
                key: "/inventory/transfer",
                label: "เคลื่อนย้ายสินค้า",
                allowedRoles: ["admin", "user"],
            },
            {
                key: "/inventory/goods-receipts",
                label: "รับสินค้า (Goods Receipt)",
                allowedRoles: ["admin", "accounting", "user", "audit"],
            },
            {
                key: "/inventory/goods-issues",
                label: "จ่ายสินค้า (Goods Issue)",
                allowedRoles: ["admin", "accounting", "user", "audit"],
            },
            {
                key: "/inventory/reports",
                label: "รายงานสินค้าคงคลัง",
                allowedRoles: ["admin", "accounting", "audit"],
            },
        ],
    },
    {
        key: "/wms",
        icon: <AppstoreOutlined />,
        label: "WMS",
        allowedRoles: [
            "admin",
            "user",
            "warehouse",
            "warehouse_manager",
            "wms",
        ],
        children: [
            {
                key: "/wms/dashboard",
                label: "Dashboard",
                allowedRoles: [
                    "admin",
                    "warehouse",
                    "warehouse_manager",
                    "wms",
                ],
            },
            {
                key: "/wms/receiving",
                label: "รับสินค้าเข้าคลัง",
                allowedRoles: [
                    "admin",
                    "user",
                    "warehouse",
                    "warehouse_manager",
                    "wms",
                ],
            },
            {
                key: "/wms/picking",
                label: "หยิบสินค้า",
                allowedRoles: [
                    "admin",
                    "user",
                    "warehouse",
                    "warehouse_manager",
                    "wms",
                ],
            },
            {
                key: "/wms/transfers",
                label: "โอนย้ายสินค้า (สแกน)",
                allowedRoles: [
                    "admin",
                    "warehouse",
                    "warehouse_manager",
                    "wms",
                ],
            },
            {
                key: "/wms/incidents",
                label: "รายการหยิบขาด/ปัญหาคลัง",
                allowedRoles: [
                    "admin",
                    "warehouse_manager",
                    "wms",
                ],
            },
            // {
            //     key: "/wms/packing",
            //     label: "แพ็คสินค้า",
            //     allowedRoles: ["admin", "user"],
            // },
        ],
    },
    {
        key: "/transportation",
        icon: <TruckOutlined />,
        label: "การขนส่ง",
        allowedRoles: [
            "admin",
            "warehouse_manager",
            "wms",
        ],
        children: [
            {
                key: "/wms/transport-master",
                label: "บริหารข้อมูลขนส่ง",
                allowedRoles: [
                    "admin",
                    "warehouse_manager",
                    "wms",
                ],
            },
            {
                key: "/wms/load-plans",
                label: "แผนจัดส่งสินค้า (Load Plans)",
                allowedRoles: [
                    "admin",
                    "warehouse_manager",
                    "wms",
                ],
            },
        ],
    },
    {
        key: "/master",
        icon: <ShopOutlined />,
        label: "ข้อมูลหลัก",
        allowedRoles: ["admin", "user"],
        children: [
            {
                key: "/master/items",
                label: "สินค้า",
                allowedRoles: ["admin", "user", "accounting"],
            },
            {
                key: "/master/conversions",
                label: "แปลงหน่วย (Conversions)",
                allowedRoles: ["admin", "user", "accounting"],
            },
            {
                key: "/master/uom",
                label: "หน่วยนับ (UOM)",
                allowedRoles: ["admin", "user", "accounting"],
            },
            {
                key: "/master/pricing-policies",
                label: "ราคาโครงสร้าง-อัพโหลด",
                allowedRoles: ["admin", "user", "accounting"],
            },
            {
                key: "/master/pricing-contract",
                label: "ราคาพิเศษ-อัพโหลด",
                allowedRoles: ["admin", "user", "accounting"],
            },
            {
                key: "/master/pricing-policy-history",
                label: "ประวัติราคาโครงสร้าง",
                allowedRoles: ["admin", "user", "accounting"],
            },
            {
                key: "/master/pricing-contract-history",
                label: "ประวัติราคาพิเศษ",
                allowedRoles: ["admin", "user", "accounting"],
            },
            {
                key: "/master/workflows",
                label: "ตั้งค่า Workflow",
                allowedRoles: ["admin"],
            },
            {
                key: "/master/transaction-types",
                label: "ประเภทธุรกรรมคลัง",
                allowedRoles: ["admin", "user", "accounting"],
            },
            {
                key: "/master/customers",
                label: "ลูกค้า",
                allowedRoles: ["admin", "accounting"],
            },
            {
                key: "/master/vendors",
                label: "ผู้ขาย",
                allowedRoles: ["admin", "accounting"],
            },
            {
                key: "/master/warehouses",
                label: "คลังสินค้า",
                allowedRoles: ["admin"],
            },
        ],
    },
    {
        key: "/reports",
        icon: <BarChartOutlined />,
        label: "รายงาน",
        allowedRoles: ["admin", "accounting", "audit"],
        children: [
            {
                key: "/reports/sales",
                label: "รายงานขาย",
                allowedRoles: ["admin", "accounting", "audit"],
            },
            {
                key: "/reports/stock",
                label: "รายงานสต็อก",
                allowedRoles: ["admin", "accounting", "audit"],
            },
        ],
    },
    {
        key: "/users",
        icon: <TeamOutlined />,
        label: "บัญชีผู้ใช้งาน",
        allowedRoles: ["admin"],
        children: [
            { key: "/users", label: "ผู้ใช้งาน", allowedRoles: ["admin"] },
            { key: "/roles", label: "บทบาท", allowedRoles: ["admin"] },
        ],
    },
    {
        key: "/audit",
        icon: <AuditOutlined />,
        label: "ตรวจสอบและอนุมัติ",
        allowedRoles: ["admin", "audit"],
        children: [
            {
                key: "/audit/logs",
                label: "Audit Logs",
                allowedRoles: ["admin", "audit"],
            },
            {
                key: "/audit/approvals",
                label: "รายการอนุมัติ",
                allowedRoles: ["admin", "audit"],
            },
        ],
    },
    {
        key: "/settings",
        icon: <SettingOutlined />,
        label: "ตั้งค่าการใช้งาน",
        allowedRoles: ["admin"],
        children: [
            {
                key: "/settings/company",
                label: "บริษัท",
                allowedRoles: ["admin"],
            },
            {
                key: "/settings/numbering",
                label: "เลขที่เอกสาร",
                allowedRoles: ["admin"],
            },
            {
                key: "/settings/system",
                label: "ตั้งค่าระบบ",
                allowedRoles: ["admin"],
            },
        ],
    },
    {
        key: "/document",
        icon: <SettingOutlined />,
        label: "เอกสาร",
        allowedRoles: ["admin"],
        hiddenInMenu: true,
        children: [
            {
                key: "/document/print",
                label: "พิมพ์เอกสาร",
                allowedRoles: ["admin"],
            },
        ],
    },
];

export function flattenMenus(items = appMenus) {
    return items
        .filter((item) => !item.hiddenInMenu)
        .flatMap((item) => [item, ...(item.children || [])]);
}

export function findMenuPath(pathname, items = appMenus) {
    for (const item of items) {
        if (item.key === pathname) return [item];
        const child = item.children?.find((entry) => entry.key === pathname);
        if (child) return [item, child];
    }
    return [];
}
