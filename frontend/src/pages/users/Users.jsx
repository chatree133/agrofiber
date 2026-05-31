import { Form, Modal, message } from 'antd';
import { useEffect, useState } from 'react';
import UserFilterModal from '../../components/users/UserFilterModal.jsx';
import UserFormModal from '../../components/users/UserFormModal.jsx';
import UsersTable from '../../components/users/UsersTable.jsx';
import UsersToolbar from '../../components/users/UsersToolbar.jsx';
import { useUser } from '../../context/UserContext.jsx';

function roleValues(user) {
  return user?.roles?.map((role) => role.id) || [];
}

export default function Users() {
  const { getUsers, createUser, updateUser, deleteUsers, getRoles } = useUser();
  const [form] = Form.useForm();
  const [filterForm] = Form.useForm();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [avatarDataUrl, setAvatarDataUrl] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [filterInitialValues, setFilterInitialValues] = useState({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const roleOptions = roles.map((role) => ({ value: role.id, label: `${role.code} - ${role.name}` }));
  const modalInitialValues = editingUser
    ? {
        username: editingUser.username,
        staffId: editingUser.staffId,
        displayName: editingUser.displayName,
        jobTitle: editingUser.jobTitle,
        email: editingUser.email,
        avatarUrl: editingUser.avatarUrl,
        isActive: editingUser.isActive,
        roles: roleValues(editingUser),
      }
    : { isActive: true, roles: [] };

  const filterCount =
    (filters.createdFrom || filters.createdTo ? 1 : 0) +
    (filters.roleIds?.length ? 1 : 0) +
    (filters.isActive !== undefined ? 1 : 0);

  const accountQueryParams = {
    search: appliedSearch || undefined,
    createdFrom: filters.createdFrom,
    createdTo: filters.createdTo,
    roleIds: filters.roleIds?.join(','),
    isActive: filters.isActive,
  };

  const loadRoles = async () => {
    const data = await getRoles();
    setRoles(data || []);
  };

  const loadUsers = async (next = {}) => {
    const page = next.page ?? pagination.page;
    const pageSize = next.pageSize ?? pagination.pageSize;
    setLoading(true);

    try {
      const data = await getUsers({
        page,
        pageSize,
        ...accountQueryParams,
      });

      setUsers(data.data || []);
      setPagination({
        page: data.pagination?.page || page,
        pageSize: data.pagination?.pageSize || pageSize,
        total: data.pagination?.total || 0,
      });
      setSelectedRowKeys([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles().catch(() => message.error('โหลด role ไม่สำเร็จ'));
  }, []);

  useEffect(() => {
    loadUsers({ page: 1 }).catch(() => message.error('โหลดข้อมูลผู้ใช้ไม่สำเร็จ'));
  }, [appliedSearch, filters]);

  const openAdd = () => {
    setEditingUser(null);
    setAvatarDataUrl(null);
    setModalOpen(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setAvatarDataUrl(null);
    setModalOpen(true);
  };

  const submitUser = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        avatarDataUrl,
        roles: values.roles,
      };

      if (editingUser && !payload.password) delete payload.password;

      if (editingUser) {
        await updateUser(editingUser.id, payload);
        message.success('แก้ไขผู้ใช้แล้ว');
      } else {
        await createUser(payload);
        message.success('เพิ่มผู้ใช้แล้ว');
      }

      setModalOpen(false);
      await loadUsers();
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.response?.data?.message || 'บันทึกไม่สำเร็จ');
    }
  };

  const confirmDelete = (ids) => {
    Modal.confirm({
      title: `ต้องการ delete ${ids.length} จำนวนนี้จริงๆ ใช่ไหม`,
      okText: 'Delete',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteUsers(ids);

          setUsers((current) => current.filter((user) => !ids.includes(user.id)));
          setSelectedRowKeys((current) => current.filter((id) => !ids.includes(id)));
          setPagination((current) => ({ ...current, total: Math.max(current.total - ids.length, 0) }));
          message.success('ลบข้อมูลแล้ว');
        } catch (error) {
          message.error(error.response?.data?.message || 'ลบไม่สำเร็จ');
        }
      },
    });
  };

  const applyFilter = async () => {
    const values = await filterForm.validateFields();
    setFilterInitialValues(values);
    setFilters({
      createdFrom: values.createdAt?.[0]?.format('YYYY-MM-DD'),
      createdTo: values.createdAt?.[1]?.format('YYYY-MM-DD'),
      roleIds: values.roleIds,
      isActive: values.isActive,
    });
    setFilterOpen(false);
  };

  const exportAll = async () => {
    const allRows = [];
    const pageSize = 100;
    let page = 1;
    let total = 0;

    do {
      const data = await getUsers({
        page,
        pageSize,
        ...accountQueryParams,
      });
      allRows.push(...(data.data || []));
      total = data.pagination?.total || allRows.length;
      page += 1;
    } while (allRows.length < total);

    const header = ['Username', 'StaffId', 'DisplayName', 'JobTitle', 'Email', 'Roles', 'IsActive', 'CreatedAt'];
    const rows = allRows.map((user) => [
      user.username,
      user.staffId,
      user.displayName,
      user.jobTitle || '',
      user.email || '',
      user.roles.map((role) => role.code).join('|'),
      user.isActive ? 'Active' : 'Inactive',
      user.createdAt || '',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = 'users.csv';
    link.click();
  };

  return (
    <div className="space-y-3">
      <UsersToolbar
        searchText={searchText}
        selectedCount={selectedRowKeys.length}
        filterCount={filterCount}
        pagination={pagination}
        onSearchChange={setSearchText}
        onSearch={setAppliedSearch}
        onAdd={openAdd}
        onDeleteSelected={() => confirmDelete(selectedRowKeys)}
        onExport={exportAll}
        onFilter={() => setFilterOpen(true)}
        onPageChange={(page) => loadUsers({ page })}
        onPageSizeChange={(pageSize) => loadUsers({ page: 1, pageSize })}
      />

      <UsersTable
        users={users}
        loading={loading}
        selectedRowKeys={selectedRowKeys}
        onSelectionChange={setSelectedRowKeys}
        onEdit={openEdit}
        onDelete={(user) => confirmDelete([user.id])}
      />

      <UserFormModal
        open={modalOpen}
        form={form}
        editingUser={editingUser}
        roleOptions={roleOptions}
        initialValues={modalInitialValues}
        onCancel={() => setModalOpen(false)}
        onSubmit={submitUser}
        onAvatarChange={setAvatarDataUrl}
      />

      <UserFilterModal
        open={filterOpen}
        form={filterForm}
        roleOptions={roleOptions}
        initialValues={filterInitialValues}
        onCancel={() => setFilterOpen(false)}
        onSubmit={applyFilter}
      />
    </div>
  );
}
