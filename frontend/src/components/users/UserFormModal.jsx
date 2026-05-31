import { Button, Form, Input, Modal, Select, Switch, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function UserFormModal({
  open,
  form,
  editingUser,
  roleOptions,
  initialValues,
  onCancel,
  onSubmit,
  onAvatarChange,
}) {
  return (
    <Modal
      title={editingUser ? 'Edit User' : 'Add User'}
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      width={720}
      forceRender
      afterOpenChange={(visible) => {
        if (!visible) return;
        form.resetFields();
        form.setFieldsValue(initialValues);
      }}
      destroyOnClose
    >
      <Form form={form} layout="vertical" preserve={false}>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="staffId" label="Staff ID" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: !editingUser }]}>
            <Input.Password placeholder={editingUser ? 'เว้นว่างถ้าไม่เปลี่ยนรหัสผ่าน' : undefined} />
          </Form.Item>
          <Form.Item name="displayName" label="Display Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="jobTitle" label="Job Title">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="roles" label="Roles" rules={[{ required: true, message: 'เลือก role อย่างน้อย 1 รายการ' }]}>
            <Select mode="multiple" options={roleOptions} />
          </Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="avatarUrl" label="Avatar URL">
            <Input />
          </Form.Item>
          <Form.Item label="Upload Avatar">
            <Upload
              maxCount={1}
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              beforeUpload={async (file) => {
                if (!['image/png', 'image/jpeg'].includes(file.type)) {
                  message.error('รองรับเฉพาะ .png .jpg .jpeg');
                  return Upload.LIST_IGNORE;
                }
                onAvatarChange(await fileToDataUrl(file));
                return false;
              }}
            >
              <Button icon={<UploadOutlined />}>Upload</Button>
            </Upload>
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
