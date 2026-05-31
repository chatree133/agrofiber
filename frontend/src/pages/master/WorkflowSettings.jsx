import {
    DeleteOutlined,
    PlusOutlined,
    ReloadOutlined,
} from "@ant-design/icons";
import {
    Button,
    Card,
    Form,
    Input,
    Modal,
    Select,
    Space,
    Switch,
    Table,
    Typography,
    message,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkflow } from "../../context/WorkflowContext.jsx";
import { useUser } from "../../context/UserContext.jsx";

const { Text } = Typography;

export default function WorkflowSettings() {
    const {
        getWorkflowDefinitions,
        createWorkflowDefinition,
        updateWorkflowDefinition,
        getWorkflowSteps,
        createWorkflowStep,
        deleteWorkflowStep,
    } = useWorkflow();

    const { getRoles, getUsers } = useUser();

    const [loading, setLoading] = useState(false);
    const [definitions, setDefinitions] = useState([]);
    const [selectedDefinitionId, setSelectedDefinitionId] = useState(null);
    const [steps, setSteps] = useState([]);
    const [loadingSteps, setLoadingSteps] = useState(false);

    const [roles, setRoles] = useState([]);
    const [userOptions, setUserOptions] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const userSearchTimerRef = useRef(null);

    const [createDefOpen, setCreateDefOpen] = useState(false);
    const [createStepOpen, setCreateStepOpen] = useState(false);

    const [createDefForm] = Form.useForm();
    const [createStepForm] = Form.useForm();

    const selectedDefinition = useMemo(
        () => definitions.find((d) => d.id === selectedDefinitionId) || null,
        [definitions, selectedDefinitionId],
    );

    const roleIdWidthCh = useMemo(() => {
        const maxId = Math.max(
            0,
            ...(Array.isArray(roles)
                ? roles.map((r) => Number(r.id) || 0)
                : []),
        );
        return Math.max(String(maxId || 0).length, 1);
    }, [roles]);

    const formatAlignedIdLabel = (id, content, widthCh) => (
        <span className="inline-flex items-center">
            <span
                style={{
                    display: "inline-block",
                    minWidth: `${widthCh}ch`,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {id}
            </span>
            <span style={{ margin: "0 8px", opacity: 0.6 }}>-</span>
            <span>{content}</span>
        </span>
    );

    const loadDefinitions = async () => {
        setLoading(true);
        try {
            const data = await getWorkflowDefinitions();
            setDefinitions(Array.isArray(data) ? data : []);
            if (
                selectedDefinitionId &&
                !data?.some((d) => d.id === selectedDefinitionId)
            ) {
                setSelectedDefinitionId(null);
                setSteps([]);
            }
        } catch (err) {
            message.error(err.message || "โหลด workflow definitions ไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    };

    const loadSteps = async (definitionId) => {
        if (!definitionId) return;
        setLoadingSteps(true);
        try {
            const data = await getWorkflowSteps(definitionId);
            setSteps(Array.isArray(data) ? data : []);
        } catch (err) {
            message.error(err.message || "โหลด workflow steps ไม่สำเร็จ");
        } finally {
            setLoadingSteps(false);
        }
    };

    useEffect(() => {
        loadDefinitions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const data = await getRoles();
                setRoles(Array.isArray(data) ? data : []);
            } catch (err) {
                message.error(err.message || "โหลด roles ไม่สำเร็จ");
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (selectedDefinitionId) loadSteps(selectedDefinitionId);
        else setSteps([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDefinitionId]);

    const definitionColumns = [
        { title: "ID", dataIndex: "id", key: "id", width: 80 },
        {
            title: "Code",
            dataIndex: "workflowCode",
            key: "workflowCode",
            width: 240,
        },
        {
            title: "Name",
            dataIndex: "workflowName",
            key: "workflowName",
            width: 280,
        },
        {
            title: "DocumentType",
            dataIndex: "documentType",
            key: "documentType",
            width: 200,
        },
        {
            title: "Active",
            dataIndex: "isActive",
            key: "isActive",
            width: 110,
            render: (value, record) => (
                <Switch
                    checked={Boolean(value)}
                    onChange={async (checked) => {
                        try {
                            await updateWorkflowDefinition(record.id, {
                                isActive: checked,
                            });
                            message.success("อัปเดตสถานะ workflow แล้ว");
                            await loadDefinitions();
                        } catch (err) {
                            message.error(
                                err.message || "อัปเดตสถานะ workflow ไม่สำเร็จ",
                            );
                        }
                    }}
                />
            ),
        },
        {
            title: "CreatedAt",
            dataIndex: "createdAt",
            key: "createdAt",
            width: 180,
        },
    ];

    const stepColumns = [
        { title: "Step", dataIndex: "stepNo", key: "stepNo", width: 90 },
        {
            title: "ApproverRoleId",
            dataIndex: "approverRoleId",
            key: "approverRoleId",
            width: 160,
            render: (_v, r) =>
                r.approverRoleId
                    ? `${r.approverRoleId} - ${r.roleName || "-"}`
                    : "-",
        },
        {
            title: "ApproverUserId",
            dataIndex: "approverUserId",
            key: "approverUserId",
            width: 160,
            render: (_v, r) =>
                r.approverUserId
                    ? `${r.approverUserId} - ${r.userName || "-"}`
                    : "-",
        },
        {
            title: "Required",
            dataIndex: "isRequired",
            key: "isRequired",
            width: 110,
            render: (v) => (v ? "Yes" : "No"),
        },
        {
            title: "CreatedAt",
            dataIndex: "createdAt",
            key: "createdAt",
            width: 180,
        },
        {
            title: "",
            key: "actions",
            width: 80,
            render: (_, record) => (
                <Button
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={async () => {
                        if (!selectedDefinitionId) return;
                        try {
                            await deleteWorkflowStep(
                                selectedDefinitionId,
                                record.id,
                            );
                            message.success("ลบ step แล้ว");
                            await loadSteps(selectedDefinitionId);
                        } catch (err) {
                            message.error(err.message || "ลบ step ไม่สำเร็จ");
                        }
                    }}
                />
            ),
        },
    ];

    const handleCreateDefinition = async () => {
        try {
            const values = await createDefForm.validateFields();
            await createWorkflowDefinition({
                workflowCode: values.workflowCode,
                workflowName: values.workflowName,
                documentType: values.documentType,
                isActive: values.isActive ?? true,
            });
            message.success("สร้าง workflow definition แล้ว");
            setCreateDefOpen(false);
            createDefForm.resetFields();
            await loadDefinitions();
        } catch (err) {
            if (err?.errorFields) return;
            message.error(err.message || "สร้าง workflow definition ไม่สำเร็จ");
        }
    };

    const handleCreateStep = async () => {
        if (!selectedDefinitionId) return;
        try {
            const values = await createStepForm.validateFields();
            await createWorkflowStep(selectedDefinitionId, {
                stepNo: values.stepNo,
                approverRoleId: values.approverRoleId
                    ? Number(values.approverRoleId)
                    : null,
                approverUserId: values.approverUserId
                    ? Number(values.approverUserId)
                    : null,
                isRequired: values.isRequired ?? true,
            });
            message.success("เพิ่ม step แล้ว");
            setCreateStepOpen(false);
            createStepForm.resetFields();
            await loadSteps(selectedDefinitionId);
        } catch (err) {
            if (err?.errorFields) return;
            message.error(err.message || "เพิ่ม step ไม่สำเร็จ");
        }
    };

    const searchUsers = async (searchText) => {
        const text = String(searchText || "").trim();
        if (!text) {
            setUserOptions([]);
            return;
        }

        setLoadingUsers(true);
        try {
            const data = await getUsers({
                page: 1,
                pageSize: 20,
                search: text,
                isActive: true,
            });
            const rows = Array.isArray(data?.data) ? data.data : [];
            setUserOptions(
                rows.map((u) => ({
                    value: String(u.id),
                    label: formatAlignedIdLabel(
                        u.id,
                        u.displayName || u.username || "-",
                        Math.max(String(u.id || "").length, 1),
                    ),
                })),
            );
        } catch (err) {
            message.error(err.message || "ค้นหา users ไม่สำเร็จ");
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleUserSearch = (value) => {
        if (userSearchTimerRef.current) {
            clearTimeout(userSearchTimerRef.current);
        }
        userSearchTimerRef.current = setTimeout(() => {
            searchUsers(value);
        }, 250);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-lg font-semibold text-slate-800">
                        Workflow Settings
                    </h1>
                </div>
            </div>

            <Card
                title="Workflow Definitions"
                className="shadow-sm"
                extra={
                    selectedDefinitionId && (
                        <Space wrap>
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={loadDefinitions}
                                loading={loading}
                            >
                                Reload
                            </Button>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => setCreateDefOpen(true)}
                            >
                                New Definition
                            </Button>
                        </Space>
                    )
                }
            >
                <Table
                    columns={definitionColumns}
                    dataSource={definitions}
                    rowKey="id"
                    loading={loading}
                    size="small"
                    pagination={false}
                    scroll={{ x: 1100 }}
                    rowSelection={{
                        type: "radio",
                        selectedRowKeys: selectedDefinitionId
                            ? [selectedDefinitionId]
                            : [],
                        onChange: (keys) =>
                            setSelectedDefinitionId(keys[0] ?? null),
                    }}
                />
            </Card>

            <Card
                title={`Workflow Steps${
                    selectedDefinition
                        ? `: ${selectedDefinition.workflowCode}`
                        : ""
                }`}
                className="shadow-sm"
                extra={
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        disabled={!selectedDefinitionId}
                        onClick={() => setCreateStepOpen(true)}
                    >
                        Add Step
                    </Button>
                }
            >
                <Table
                    columns={stepColumns}
                    dataSource={steps}
                    rowKey="id"
                    loading={loadingSteps}
                    size="small"
                    pagination={false}
                    scroll={{ x: 900 }}
                />
            </Card>

            <Modal
                title="New Workflow Definition"
                open={createDefOpen}
                onCancel={() => setCreateDefOpen(false)}
                onOk={handleCreateDefinition}
                okText="Create"
            >
                <Form form={createDefForm} layout="vertical">
                    <Form.Item
                        label="WorkflowCode"
                        name="workflowCode"
                        rules={[
                            { required: true, message: "กรอก workflowCode" },
                        ]}
                    >
                        <Input placeholder="WF_ITEM_PRICING_POLICY" />
                    </Form.Item>
                    <Form.Item
                        label="WorkflowName"
                        name="workflowName"
                        rules={[
                            { required: true, message: "กรอก workflowName" },
                        ]}
                    >
                        <Input placeholder="Workflow: ..." />
                    </Form.Item>
                    <Form.Item
                        label="DocumentType"
                        name="documentType"
                        rules={[
                            { required: true, message: "กรอก documentType" },
                        ]}
                    >
                        <Input placeholder="SO / PO / ITEM_PRICING_POLICY / ..." />
                    </Form.Item>
                    <Form.Item
                        label="IsActive"
                        name="isActive"
                        valuePropName="checked"
                    >
                        <Switch defaultChecked />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Add Workflow Step"
                open={createStepOpen}
                onCancel={() => setCreateStepOpen(false)}
                onOk={handleCreateStep}
                okText="Add"
            >
                <Form form={createStepForm} layout="vertical">
                    <Form.Item
                        label="StepNo"
                        name="stepNo"
                        rules={[{ required: true, message: "กรอก stepNo" }]}
                    >
                        <Input placeholder="1" />
                    </Form.Item>
                    <Form.Item label="ApproverRoleId" name="approverRoleId">
                        <Select
                            allowClear
                            placeholder="เลือก Role"
                            options={roles.map((r) => ({
                                value: String(r.id),
                                label: formatAlignedIdLabel(
                                    r.id,
                                    `${r.name} (${r.code})`,
                                    roleIdWidthCh,
                                ),
                            }))}
                        />
                    </Form.Item>
                    <Form.Item label="ApproverUserId" name="approverUserId">
                        <Select
                            allowClear
                            showSearch
                            filterOption={false}
                            placeholder="ค้นหา User"
                            onSearch={handleUserSearch}
                            options={userOptions}
                            loading={loadingUsers}
                            notFoundContent={
                                loadingUsers ? "Searching..." : null
                            }
                        />
                    </Form.Item>
                    <Form.Item
                        label="IsRequired"
                        name="isRequired"
                        valuePropName="checked"
                    >
                        <Switch defaultChecked />
                    </Form.Item>
                    <div className="text-sm text-slate-500">
                        ต้องกรอกอย่างน้อย 1 ค่า: ApproverRoleId หรือ
                        ApproverUserId
                    </div>
                </Form>
            </Modal>
        </div>
    );
}
