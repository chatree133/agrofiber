import {
    DeleteOutlined,
    EditOutlined,
    PlusOutlined,
    SaveOutlined,
    FileExcelOutlined,
    SearchOutlined,
} from "@ant-design/icons";
import {
    Button,
    Form,
    Input,
    Modal,
    Popconfirm,
    Space,
    Switch,
    Table,
    Tabs,
    Tooltip,
    message,
    Tag,
    Card,
    Select,
} from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCustomer } from "../../context/CustomerContext.jsx";
import { useMasterData } from "../../context/MasterDataContext.jsx";
// If you have PriceLists or DiscountRules in MasterData Context, import it here if needed.

export default function CustomerForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const {
        getCustomer,
        createCustomer,
        updateCustomer,
        getAddresses,
        createAddress,
        updateAddress,
        deleteAddress,
        getContacts,
        createContact,
        updateContact,
        deleteContact,
    } = useCustomer();

    const isEdit = Boolean(id);
    const { lookups, fetchLookups } = useMasterData();
    const [form] = Form.useForm();
    const [addressForm] = Form.useForm();
    const [contactForm] = Form.useForm();

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Addresses
    const [addresses, setAddresses] = useState([]);
    const [loadingAddresses, setLoadingAddresses] = useState(false);
    const [searchAddressText, setSearchAddressText] = useState("");
    const [addressModalOpen, setAddressModalOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState(null);

    // Contacts
    const [contacts, setContacts] = useState([]);
    const [loadingContacts, setLoadingContacts] = useState(false);
    const [searchContactText, setSearchContactText] = useState("");
    const [contactModalOpen, setContactModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState(null);

    useEffect(() => {
        if (!lookups || Object.keys(lookups).length === 0) {
            fetchLookups();
        }
    }, [lookups, fetchLookups]);

    useEffect(() => {
        if (isEdit) {
            loadCustomer();
            loadAddresses();
            loadContacts();
        } else {
            form.setFieldValue("isActive", true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, isEdit]);

    const loadCustomer = async () => {
        try {
            setLoading(true);
            const data = await getCustomer(id);
            form.setFieldsValue(data);
        } catch (err) {
            message.error(
                err.response?.data?.message || "ไม่สามารถโหลดข้อมูลลูกค้าได้",
            );
        } finally {
            setLoading(false);
        }
    };

    const loadAddresses = async () => {
        try {
            setLoadingAddresses(true);
            const data = await getAddresses(id);
            setAddresses(data);
        } catch (err) {
            message.error(
                err.response?.data?.message || "ไม่สามารถโหลดข้อมูลที่อยู่ได้",
            );
        } finally {
            setLoadingAddresses(false);
        }
    };

    const loadContacts = async () => {
        try {
            setLoadingContacts(true);
            const data = await getContacts(id);
            setContacts(data);
        } catch (err) {
            message.error(
                err.response?.data?.message ||
                    "ไม่สามารถโหลดข้อมูลบุคคลติดต่อได้",
            );
        } finally {
            setLoadingContacts(false);
        }
    };

    const handleSaveCustomer = async () => {
        try {
            const values = await form.validateFields();
            setSaving(true);
            if (isEdit) {
                await updateCustomer(id, values);
                message.success("อัปเดตข้อมูลลูกค้าสำเร็จ");
                navigate("/master/customers");
            } else {
                const newCustomer = await createCustomer(values);
                message.success("สร้างลูกค้าใหม่สำเร็จ");
                navigate(`/master/customers/${newCustomer.id}/edit`);
            }
        } catch (err) {
            if (err.errorFields) return;
            message.error(err.response?.data?.message || "บันทึกไม่สำเร็จ");
        } finally {
            setSaving(false);
        }
    };

    // ----- ADDRESSES -----
    const handleOpenAddressModal = (record = null) => {
        setEditingAddress(record);
        if (record) {
            addressForm.setFieldsValue(record);
        } else {
            addressForm.resetFields();
            addressForm.setFieldsValue({
                isActive: true,
                isDefault: false,
                type: "billing",
                countryCode: "TH",
            });
        }
        setAddressModalOpen(true);
    };

    const handleCloseAddressModal = () => {
        setAddressModalOpen(false);
        addressForm.resetFields();
        setEditingAddress(null);
    };

    const handleSaveAddress = async () => {
        try {
            const values = await addressForm.validateFields();
            if (editingAddress) {
                await updateAddress(id, editingAddress.id, values);
                message.success("อัปเดตที่อยู่สำเร็จ");
            } else {
                await createAddress(id, values);
                message.success("เพิ่มที่อยู่สำเร็จ");
            }
            handleCloseAddressModal();
            loadAddresses();
        } catch (err) {
            if (err.errorFields) return;
            message.error(
                err.response?.data?.message || "บันทึกที่อยู่ไม่สำเร็จ",
            );
        }
    };

    const handleDeleteAddress = async (addressId) => {
        try {
            await deleteAddress(id, addressId);
            message.success("ลบที่อยู่สำเร็จ");
            loadAddresses();
        } catch (err) {
            message.error(err.response?.data?.message || "ลบที่อยู่ไม่สำเร็จ");
        }
    };

    const filteredAddresses = addresses.filter((a) => {
        if (!searchAddressText) return true;
        const term = searchAddressText.toLowerCase();
        return (
            (a.code || "").toLowerCase().includes(term) ||
            (a.addressLine1 || "").toLowerCase().includes(term) ||
            (a.district || "").toLowerCase().includes(term) ||
            (a.province || "").toLowerCase().includes(term)
        );
    });

    const handleExportAddresses = () => {
        const header = [
            "รหัสที่อยู่",
            "สาขา",
            "ประเภท",
            "ที่อยู่ 1",
            "ที่อยู่ 2",
            "เขต/อำเภอ",
            "จังหวัด",
            "รหัสไปรษณีย์",
            "ติดต่อ",
            "เบอร์โทร",
            "ค่าเริ่มต้น",
            "สถานะ",
        ];
        const rows = filteredAddresses.map((a) => [
            a.code || "",
            a.branchCode || "",
            a.type || "",
            a.addressLine1 || "",
            a.addressLine2 || "",
            a.district || "",
            a.province || "",
            a.postalCode || "",
            a.contactName || "",
            a.phone || "",
            a.isDefault ? "ใช่" : "ไม่ใช่",
            a.isActive ? "เปิดใช้" : "ปิดใช้",
        ]);
        const csv = [header, ...rows]
            .map((row) =>
                row
                    .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
                    .join(","),
            )
            .join("\n");
        const link = document.createElement("a");
        link.href = URL.createObjectURL(
            new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
        );
        link.download = `customer_addresses_${id}.csv`;
        link.click();
    };

    const addressColumns = [
        {
            title: "",
            key: "actions",
            width: 120,
            align: "center",
            render: (_, record) => (
                <div className="flex justify-center gap-2">
                    <Popconfirm
                        title="ยืนยันการลบ?"
                        onConfirm={() => handleDeleteAddress(record.id)}
                    >
                        <DeleteOutlined className="text-red-500 cursor-pointer hover:text-red-600" />
                    </Popconfirm>
                    <EditOutlined className="text-blue-600 cursor-pointer hover:text-blue-700" onClick={() => handleOpenAddressModal(record)} />
                </div>
            ),
        },
        {
            title: "รหัสสาขา",
            dataIndex: "branchCode",
            key: "branchCode",
            render: (val, record) => `${val || ""} - ${record.code || ""}`,
        },
        { title: "ประเภท", dataIndex: "type", key: "type" },
        { title: "ที่อยู่", dataIndex: "addressLine1", key: "addressLine1" },
        { title: "จังหวัด", dataIndex: "province", key: "province" },
        {
            title: "ค่าเริ่มต้น",
            dataIndex: "isDefault",
            key: "isDefault",
            render: (val) => (val ? <Tag color="green">ใช่</Tag> : "ไม่ใช่"),
        },
        {
            title: "สถานะ",
            dataIndex: "isActive",
            key: "isActive",
            render: (val) => (
                <Tag color={val ? "blue" : "red"}>
                    {val ? "เปิดใช้" : "ปิดใช้"}
                </Tag>
            ),
        },
    ];

    // ----- CONTACTS -----
    const handleOpenContactModal = (record = null) => {
        setEditingContact(record);
        if (record) {
            contactForm.setFieldsValue(record);
        } else {
            contactForm.resetFields();
            contactForm.setFieldsValue({ isActive: true, isPrimary: false });
        }
        setContactModalOpen(true);
    };

    const handleCloseContactModal = () => {
        setContactModalOpen(false);
        contactForm.resetFields();
        setEditingContact(null);
    };

    const handleSaveContact = async () => {
        try {
            const values = await contactForm.validateFields();
            if (editingContact) {
                await updateContact(id, editingContact.id, values);
                message.success("อัปเดตบุคคลติดต่อสำเร็จ");
            } else {
                await createContact(id, values);
                message.success("เพิ่มบุคคลติดต่อสำเร็จ");
            }
            handleCloseContactModal();
            loadContacts();
        } catch (err) {
            if (err.errorFields) return;
            message.error(
                err.response?.data?.message || "บันทึกบุคคลติดต่อไม่สำเร็จ",
            );
        }
    };

    const handleDeleteContact = async (contactId) => {
        try {
            await deleteContact(id, contactId);
            message.success("ลบบุคคลติดต่อสำเร็จ");
            loadContacts();
        } catch (err) {
            message.error(
                err.response?.data?.message || "ลบบุคคลติดต่อไม่สำเร็จ",
            );
        }
    };

    const filteredContacts = contacts.filter((c) => {
        if (!searchContactText) return true;
        const term = searchContactText.toLowerCase();
        return (
            (c.name || "").toLowerCase().includes(term) ||
            (c.email || "").toLowerCase().includes(term) ||
            (c.phone || "").toLowerCase().includes(term)
        );
    });

    const handleExportContacts = () => {
        const header = [
            "ชื่อติดต่อ",
            "ตำแหน่ง",
            "เบอร์โทรศัพท์",
            "อีเมล",
            "ผู้ติดต่อหลัก",
            "สถานะ",
        ];
        const rows = filteredContacts.map((c) => [
            c.name || "",
            c.jobTitle || "",
            c.phone || "",
            c.email || "",
            c.isPrimary ? "ใช่" : "ไม่ใช่",
            c.isActive ? "เปิดใช้" : "ปิดใช้",
        ]);
        const csv = [header, ...rows]
            .map((row) =>
                row
                    .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
                    .join(","),
            )
            .join("\n");
        const link = document.createElement("a");
        link.href = URL.createObjectURL(
            new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
        );
        link.download = `customer_contacts_${id}.csv`;
        link.click();
    };

    const contactColumns = [
        {
            title: "",
            key: "actions",
            width: 120,
            align: "center",
            render: (_, record) => (
                <div className="flex justify-center gap-2">
                    <Popconfirm
                        title="ยืนยันการลบ?"
                        onConfirm={() => handleDeleteContact(record.id)}
                    >
                        <DeleteOutlined className="text-red-500 cursor-pointer hover:text-red-600" />
                    </Popconfirm>
                    <EditOutlined className="text-blue-600 cursor-pointer hover:text-blue-700" onClick={() => handleOpenContactModal(record)} />
                </div>
            ),
        },
        { title: "ชื่อติดต่อ", dataIndex: "name", key: "name" },
        { title: "ตำแหน่ง", dataIndex: "jobTitle", key: "jobTitle" },
        { title: "เบอร์โทร", dataIndex: "phone", key: "phone" },
        { title: "อีเมล", dataIndex: "email", key: "email" },
        {
            title: "หลัก",
            dataIndex: "isPrimary",
            key: "isPrimary",
            render: (val) => (val ? <Tag color="green">ใช่</Tag> : "ไม่ใช่"),
        },
        {
            title: "สถานะ",
            dataIndex: "isActive",
            key: "isActive",
            render: (val) => (
                <Tag color={val ? "blue" : "red"}>
                    {val ? "เปิดใช้" : "ปิดใช้"}
                </Tag>
            ),
        },
    ];

    const tabItems = [
        {
            key: "general",
            label: "ข้อมูลทั่วไป (General Information)",
            children: (
                <Card loading={loading} className="shadow-sm">
                    <Form form={form} layout="vertical">
                        <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
                            <Form.Item name="code" label="รหัสลูกค้า">
                                <Input
                                    disabled
                                    placeholder="สร้างอัตโนมัติ (เช่น C00001)"
                                />
                            </Form.Item>
                            <Form.Item
                                name="taxId"
                                label="เลขประจำตัวผู้เสียภาษี"
                            >
                                <Input placeholder="เช่น 01055xxxxxxxx" />
                            </Form.Item>
                        </div>
                        <Form.Item
                            name="name"
                            label="ชื่อลูกค้า"
                            rules={[
                                {
                                    required: true,
                                    message: "กรุณากรอกชื่อลูกค้า",
                                },
                            ]}
                        >
                            <Input placeholder="เช่น บริษัท ลูกค้าดี จำกัด" />
                        </Form.Item>
                        <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
                            <Form.Item name="priceListId" label="Price List ID">
                                <Input placeholder="รหัส Price List..." />
                            </Form.Item>
                            <Form.Item
                                name="discountRuleId"
                                label="Discount Rule ID"
                            >
                                <Input placeholder="รหัส Discount Rule..." />
                            </Form.Item>
                        </div>
                        <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
                            <Form.Item
                                name="customerSegmentId"
                                label="ประเภทลูกค้า"
                            >
                                <Select
                                    options={lookups.customerSegments}
                                    // defaultValue={1}
                                ></Select>
                            </Form.Item>
                            <Form.Item
                                name="CustomerPriceGroupId"
                                label="กลุ่มราคาลูกค้า"
                            >
                                <Select
                                    options={lookups.customerPriceGroups}
                                    defaultValue={1}
                                ></Select>
                            </Form.Item>
                        </div>
                        <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
                            <Form.Item
                                name="isActive"
                                label="สถานะการใช้งาน"
                                valuePropName="checked"
                            >
                                <Switch
                                    checkedChildren="เปิด"
                                    unCheckedChildren="ปิด"
                                />
                            </Form.Item>
                        </div>
                    </Form>
                </Card>
            ),
        },
        {
            key: "addresses",
            label: "ที่อยู่ (Addresses)",
            children: isEdit ? (
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex w-full md:max-w-[400px]">
                            <Input
                                allowClear
                                placeholder="ค้นหารหัส, ที่อยู่, จังหวัด..."
                                value={searchAddressText}
                                onChange={(e) =>
                                    setSearchAddressText(e.target.value)
                                }
                                className="rounded-r-none"
                            />
                            <Button
                                type="primary"
                                icon={<SearchOutlined />}
                                className="rounded-l-none"
                            />
                        </div>
                        <Space>
                            <Tooltip title="Export CSV">
                                <Button
                                    icon={<FileExcelOutlined />}
                                    onClick={handleExportAddresses}
                                />
                            </Tooltip>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => handleOpenAddressModal()}
                            >
                                เพิ่มที่อยู่
                            </Button>
                        </Space>
                    </div>
                    <div className="rounded-lg border border-slate-200">
                        <Table
                            columns={addressColumns}
                            dataSource={filteredAddresses}
                            rowKey="id"
                            loading={loadingAddresses}
                            pagination={false}
                            size="small"
                            scroll={{ x: "max-content" }}
                        />
                    </div>
                </div>
            ) : (
                <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500 mt-4">
                    กรุณาบันทึกข้อมูลลูกค้าก่อนเพื่อเพิ่มที่อยู่
                </div>
            ),
        },
        {
            key: "contacts",
            label: "บุคคลติดต่อ (Contacts)",
            children: isEdit ? (
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex w-full md:max-w-[400px]">
                            <Input
                                allowClear
                                placeholder="ค้นหาชื่อ, อีเมล, เบอร์โทร..."
                                value={searchContactText}
                                onChange={(e) =>
                                    setSearchContactText(e.target.value)
                                }
                                className="rounded-r-none"
                            />
                            <Button
                                type="primary"
                                icon={<SearchOutlined />}
                                className="rounded-l-none"
                            />
                        </div>
                        <Space>
                            <Tooltip title="Export CSV">
                                <Button
                                    icon={<FileExcelOutlined />}
                                    onClick={handleExportContacts}
                                />
                            </Tooltip>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => handleOpenContactModal()}
                            >
                                เพิ่มบุคคลติดต่อ
                            </Button>
                        </Space>
                    </div>
                    <div className="rounded-lg border border-slate-200">
                        <Table
                            columns={contactColumns}
                            dataSource={filteredContacts}
                            rowKey="id"
                            loading={loadingContacts}
                            pagination={false}
                            size="small"
                            scroll={{ x: "max-content" }}
                        />
                    </div>
                </div>
            ) : (
                <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500 mt-4">
                    กรุณาบันทึกข้อมูลลูกค้าก่อนเพื่อเพิ่มบุคคลติดต่อ
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-lg font-semibold text-slate-800">
                        {isEdit ? "แก้ไขลูกค้า" : "เพิ่มลูกค้าใหม่"}
                    </h1>
                </div>
                <Space>
                    <Button onClick={() => navigate("/master/customers")}>
                        ยกเลิก
                    </Button>
                    <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        loading={saving}
                        onClick={handleSaveCustomer}
                    >
                        บันทึก
                    </Button>
                </Space>
            </div>

            <Tabs defaultActiveKey="general" items={tabItems} />

            {/* Address Modal */}
            <Modal
                title={editingAddress ? "แก้ไขที่อยู่" : "เพิ่มที่อยู่"}
                open={addressModalOpen}
                onOk={handleSaveAddress}
                onCancel={handleCloseAddressModal}
                okText="บันทึก"
                cancelText="ยกเลิก"
                width={700}
            >
                <Form form={addressForm} layout="vertical" className="mt-4">
                    <div className="grid grid-cols-1 gap-x-6 md:grid-cols-3">
                        <Form.Item
                            name="code"
                            label="รหัสอ้างอิง"
                            rules={[
                                {
                                    required: true,
                                    message: "กรุณากรอกรหัสอ้างอิง",
                                },
                            ]}
                        >
                            <Input placeholder="เช่น MAIN, WH1" />
                        </Form.Item>
                        <Form.Item
                            name="branchCode"
                            label="รหัสสาขา"
                            rules={[
                                {
                                    required: true,
                                    message: "กรุณากรอกรหัสสาขา (เช่น 00000)",
                                },
                            ]}
                        >
                            <Input placeholder="เช่น 00000" />
                        </Form.Item>
                        <Form.Item
                            name="type"
                            label="ประเภทที่อยู่"
                            rules={[
                                {
                                    required: true,
                                    message: "กรุณาเลือกประเภทที่อยู่",
                                },
                            ]}
                        >
                            <Select>
                                <Select.Option value="BILLING">
                                    Billing
                                </Select.Option>
                                <Select.Option value="SHIPPING">
                                    Shipping
                                </Select.Option>
                                <Select.Option value="BILLING_SHIPPING">
                                    Billing & Shipping
                                </Select.Option>
                            </Select>
                        </Form.Item>
                    </div>
                    <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
                        <Form.Item name="contactName" label="ชื่อผู้ติดต่อ">
                            <Input placeholder="ชื่อผู้รับ/ผู้ติดต่อ..." />
                        </Form.Item>
                        <Form.Item name="phone" label="เบอร์โทรศัพท์">
                            <Input placeholder="เบอร์โทร..." />
                        </Form.Item>
                    </div>
                    <Form.Item
                        name="addressLine1"
                        label="ที่อยู่บรรทัดที่ 1"
                        rules={[
                            {
                                required: true,
                                message: "กรุณากรอกที่อยู่บรรทัด 1",
                            },
                        ]}
                    >
                        <Input.TextArea
                            rows={2}
                            placeholder="บ้านเลขที่, ถนน, ซอย..."
                        />
                    </Form.Item>
                    <Form.Item
                        name="addressLine2"
                        label="ที่อยู่บรรทัดที่ 2 (เพิ่มเติม)"
                    >
                        <Input.TextArea
                            rows={2}
                            placeholder="จุดสังเกตเพิ่มเติม..."
                        />
                    </Form.Item>
                    <div className="grid grid-cols-1 gap-x-6 md:grid-cols-3">
                        <Form.Item name="district" label="เขต/อำเภอ">
                            <Input placeholder="เช่น เมือง" />
                        </Form.Item>
                        <Form.Item name="province" label="จังหวัด">
                            <Input placeholder="เช่น เชียงใหม่" />
                        </Form.Item>
                        <Form.Item name="postalCode" label="รหัสไปรษณีย์">
                            <Input placeholder="เช่น 50000" />
                        </Form.Item>
                    </div>
                    <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
                        <Form.Item
                            name="isDefault"
                            label="เป็นที่อยู่หลัก (Default)"
                            valuePropName="checked"
                        >
                            <Switch
                                checkedChildren="ใช่"
                                unCheckedChildren="ไม่ใช่"
                            />
                        </Form.Item>
                        <Form.Item
                            name="isActive"
                            label="สถานะการใช้งาน"
                            valuePropName="checked"
                        >
                            <Switch
                                checkedChildren="เปิด"
                                unCheckedChildren="ปิด"
                            />
                        </Form.Item>
                    </div>
                </Form>
            </Modal>

            {/* Contact Modal */}
            <Modal
                title={editingContact ? "แก้ไขบุคคลติดต่อ" : "เพิ่มบุคคลติดต่อ"}
                open={contactModalOpen}
                onOk={handleSaveContact}
                onCancel={handleCloseContactModal}
                okText="บันทึก"
                cancelText="ยกเลิก"
                width={600}
            >
                <Form form={contactForm} layout="vertical" className="mt-4">
                    <Form.Item
                        name="name"
                        label="ชื่อบุคคลติดต่อ"
                        rules={[{ required: true, message: "กรุณากรอกชื่อ" }]}
                    >
                        <Input placeholder="ชื่อ-นามสกุล..." />
                    </Form.Item>
                    <Form.Item name="jobTitle" label="ตำแหน่ง">
                        <Input placeholder="เช่น ผู้จัดการ, จัดซื้อ..." />
                    </Form.Item>
                    <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
                        <Form.Item name="phone" label="เบอร์โทรศัพท์">
                            <Input placeholder="เช่น 081-xxx-xxxx" />
                        </Form.Item>
                        <Form.Item name="email" label="อีเมล">
                            <Input placeholder="เช่น name@example.com" />
                        </Form.Item>
                    </div>
                    <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
                        <Form.Item
                            name="isPrimary"
                            label="ผู้ติดต่อหลัก"
                            valuePropName="checked"
                        >
                            <Switch
                                checkedChildren="ใช่"
                                unCheckedChildren="ไม่ใช่"
                            />
                        </Form.Item>
                        <Form.Item
                            name="isActive"
                            label="สถานะการใช้งาน"
                            valuePropName="checked"
                        >
                            <Switch
                                checkedChildren="เปิด"
                                unCheckedChildren="ปิด"
                            />
                        </Form.Item>
                    </div>
                </Form>
            </Modal>
        </div>
    );
}
