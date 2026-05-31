import { message, Modal, Form } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ItemsTable from "../../components/items/ItemsTable.jsx";
import ItemsToolbar from "../../components/items/ItemsToolbar.jsx";
import ItemSpecModal from "../../components/items/ItemSpecModal.jsx";
import { useItem } from "../../context/ItemContext.jsx";
import { useMasterData } from "../../context/MasterDataContext.jsx";
import ItemsFilterModal from "../../components/items/ItemsFilterModal.jsx";

export default function Items() {
    const navigate = useNavigate();
    const { getItems, deleteItems, deleteItemSpec, updateItemSpec } = useItem();
    const { lookups, fetchLookups } = useMasterData();
    const [items, setItems] = useState([]);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [loading, setLoading] = useState(false);
    const [specModalOpen, setSpecModalOpen] = useState(false);
    const [filterForm] = Form.useForm();
    const [editingSpec, setEditingSpec] = useState(null);
    const [specSaving, setSpecSaving] = useState(false);
    const [filterOpen, setFilterOpen] = useState(false);
    const [filterInitialValues, setFilterInitialValues] = useState({});
    const [filters, setFilters] = useState({});

    const [searchText, setSearchText] = useState("");
    const [appliedSearch, setAppliedSearch] = useState("");
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 20,
        total: 0,
    });

    const filterCount =
        (filters.productTypeId ? 1 : 0) +
        (filters.widthId ? 1 : 0) +
        (filters.lengthId ? 1 : 0) +
        (filters.surfaceId ? 1 : 0) +
        (filters.gradeId ? 1 : 0) +
        (filters.thicknessId ? 1 : 0);

    const getRowKey = (record) =>
        record.itemSpecId
            ? `itemSpec-${record.itemId}-${record.itemSpecId}`
            : `item-${record.itemId}`;

    const itemKeyMap = useMemo(
        () =>
            items.reduce((acc, row) => {
                acc[getRowKey(row)] = row;
                return acc;
            }, {}),
        [items],
    );

    const loadItems = async (next = {}) => {
        const page = next.page ?? pagination.page;
        const pageSize = next.pageSize ?? pagination.pageSize;
        setLoading(true);

        try {
            const data = await getItems({
                page,
                pageSize,
                search: appliedSearch || undefined,
                productTypeId: filters.productTypeId,
                widthId: filters.widthId,
                lengthId: filters.lengthId,
                surfaceId: filters.surfaceId,
                gradeId: filters.gradeId,
                thicknessId: filters.thicknessId,
            });

            setItems(data.data || []);
            setPagination({
                page: data.pagination?.page || page,
                pageSize: data.pagination?.pageSize || pageSize,
                total: data.pagination?.total || 0,
            });
            setSelectedRowKeys([]);
        } catch (err) {
            message.error("โหลดข้อมูลสินค้าไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadItems({ page: 1 });
    }, [appliedSearch]);

    useEffect(() => {
        loadItems({ page: 1 }).catch(() =>
            message.error("โหลดข้อมูลสินค้าไม่สำเร็จ"),
        );
    }, [appliedSearch, filters]);

    useEffect(() => {
        fetchLookups();
    }, [fetchLookups]);

    const getSelectedRows = () =>
        selectedRowKeys.map((key) => itemKeyMap[key]).filter(Boolean);

    const handleSearch = () => {
        if (searchText === appliedSearch) {
            loadItems({ page: 1 });
        } else {
            setAppliedSearch(searchText);
        }
    };

    const confirmDeleteRows = (rows) => {
        const parentIds = new Set();
        const specDeleteKeys = new Set();

        let parentCount = 0;
        let childCount = 0;

        rows.forEach((row) => {
            if (!row) return;

            // child selected directly
            if (row.rowType === "child" && row.itemSpecId) {
                const key = `${row.itemId}-${row.itemSpecId}`;

                if (!specDeleteKeys.has(key)) {
                    specDeleteKeys.add(key);
                    childCount += 1;
                }

                return;
            }

            // parent selected
            if (row.rowType === "parent" && row.itemId) {
                if (!parentIds.has(row.itemId)) {
                    parentIds.add(row.itemId);
                    parentCount += 1;
                }

                // count child rows under parent
                const childRows = items.filter(
                    (x) => x.rowType === "child" && x.itemId === row.itemId,
                );

                childRows.forEach((child) => {
                    const key = `${child.itemId}-${child.itemSpecId}`;

                    if (!specDeleteKeys.has(key)) {
                        specDeleteKeys.add(key);
                        childCount += 1;
                    }
                });
            }
        });

        const specDeletes = Array.from(specDeleteKeys)
            .map((key) => {
                const [itemId, itemSpecId] = key.split("-");

                return {
                    itemId: Number(itemId),
                    itemSpecId: Number(itemSpecId),
                };
            })
            // IMPORTANT:
            // don't delete child separately
            // if parent already deleted
            .filter((x) => !parentIds.has(x.itemId));

        const rowCount = parentCount + childCount;

        if (rowCount === 0) return;

        Modal.confirm({
            title: `ต้องการลบ ${rowCount} รายการนี้จริงๆ ใช่ไหม?`,

            content: `ลบ ${parentCount} สินค้าหลัก และ ${childCount} สเปกย่อย`,

            okText: "Delete",
            okButtonProps: { danger: true },
            cancelText: "Cancel",

            onOk: async () => {
                try {
                    if (parentIds.size) {
                        await deleteItems(Array.from(parentIds));
                    }

                    if (specDeletes.length) {
                        await Promise.all(
                            specDeletes.map((row) =>
                                deleteItemSpec(row.itemId, row.itemSpecId),
                            ),
                        );
                    }

                    await loadItems({
                        page: pagination.page,
                    });

                    message.success("ลบข้อมูลสำเร็จ");
                } catch (error) {
                    message.error(
                        error.response?.data?.message || "ลบข้อมูลไม่สำเร็จ",
                    );
                }
            },
        });
    };

    const handleAdd = () => {
        navigate("/master/items/create");
    };

    const handleEdit = (item) => {
        if (item.rowType === "child") {
            setEditingSpec(item);
            setSpecModalOpen(true);
            return;
        }

        navigate(`/master/items/${item.itemId}/edit`);
    };

    const confirmDelete = (rows) => {
        confirmDeleteRows(rows);
    };

    const handleSpecSave = async (values) => {
        if (!editingSpec) return;
        setSpecSaving(true);
        try {
            await updateItemSpec(
                editingSpec.itemId,
                editingSpec.itemSpecId,
                values,
            );
            setSpecModalOpen(false);
            setEditingSpec(null);
            await loadItems({ page: pagination.page });
            message.success("บันทึกสเปกระบุสำเร็จ");
        } catch (error) {
            message.error(
                error.response?.data?.message || "บันทึกสเปกระบุไม่สำเร็จ",
            );
        } finally {
            setSpecSaving(false);
        }
    };

    const applyFilter = async () => {
        const values = await filterForm.validateFields();
        setFilterInitialValues(values);
        console.log("Applying filters:", values);
        setFilters({
            productTypeId: values.productTypeId,
            widthId: values.widthId,
            lengthId: values.lengthId,
            surfaceId: values.surfaceId,
            gradeId: values.gradeId,
            thicknessId: values.thicknessId,
        });
        setFilterOpen(false);
    };

    const exportAll = async () => {
        const allRows = [];
        const pageSize = 100;
        let page = 1;
        let total = 0;

        try {
            do {
                const data = await getItems({
                    page,
                    pageSize,
                    search: appliedSearch || undefined,
                });
                allRows.push(...(data.data || []));
                total = data.pagination?.total || allRows.length;
                page += 1;
            } while (allRows.length < total);

            const header = [
                "Code/SKU",
                "ItemName",
                "RowType",
                "SpecName",
                "GradeName",
                "Type",
                "ProductGroup",
                "Thickness",
                "Width",
                "Length",
                "Area",
                "Unit",
                "Status",
                "IsActive",
            ];
            const rows = allRows.map((item) => [
                item.displayCode || item.code || "",
                item.name || "",
                item.rowType || "",
                item.specName || "",
                item.gradeName || "",
                item.itemTypeCode || "",
                item.productTypeCode || "",
                item.thicknessMm || "",
                item.widthM || "",
                item.lengthM || "",
                item.areaSqm || "",
                item.unitCode || "",
                item.status,
                item.isActive ? "Yes" : "No",
            ]);
            const csv = [header, ...rows]
                .map((row) =>
                    row
                        .map(
                            (cell) =>
                                `"${String(cell ?? "").replaceAll('"', '""')}"`,
                        )
                        .join(","),
                )
                .join("\n");
            const link = document.createElement("a");
            link.href = URL.createObjectURL(
                new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
            );
            link.download = "items.csv";
            link.click();
        } catch (e) {
            message.error("Export ไม่สำเร็จ");
        }
    };

    return (
        <div className="space-y-3">
            <ItemsToolbar
                searchText={searchText}
                selectedCount={selectedRowKeys.length}
                filterCount={filterCount}
                pagination={pagination}
                onSearchChange={setSearchText}
                onSearch={handleSearch}
                onAdd={handleAdd}
                onDeleteSelected={() => confirmDelete(getSelectedRows())}
                onExport={exportAll}
                onFilter={() => setFilterOpen(true)}
                onPageChange={(page) => loadItems({ page })}
                onPageSizeChange={(pageSize) =>
                    loadItems({ page: 1, pageSize })
                }
            />

            <ItemsTable
                items={items}
                loading={loading}
                selectedRowKeys={selectedRowKeys}
                onSelectionChange={setSelectedRowKeys}
                onEdit={handleEdit}
                onDelete={(item) => confirmDelete([item])}
            />

            <ItemSpecModal
                open={specModalOpen}
                initialValues={
                    editingSpec
                        ? {
                              salesSku: editingSpec.salesSku,
                              specCode: editingSpec.specCode,
                              specName: editingSpec.specName,
                              surfaceName: editingSpec.surfaceName,
                              gradeId: editingSpec.gradeId,
                              isActive: editingSpec.isActive,
                          }
                        : null
                }
                onSave={handleSpecSave}
                onCancel={() => {
                    setSpecModalOpen(false);
                    setEditingSpec(null);
                }}
                confirmLoading={specSaving}
                lookups={lookups}
            />

            <ItemsFilterModal
                open={filterOpen}
                form={filterForm}
                productTypeOptions={lookups?.productTypes || []}
                widthOptions={lookups?.widths || []}
                lengthOptions={lookups?.lengths || []}
                surfaceOptions={lookups?.surfaces || []}
                gradeOptions={lookups?.grades || []}
                thicknessOptions={lookups?.thicknesses || []}
                initialValues={filterInitialValues}
                onCancel={() => setFilterOpen(false)}
                onSubmit={applyFilter}
            />
        </div>
    );
}
