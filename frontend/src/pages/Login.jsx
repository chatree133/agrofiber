import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input } from 'antd';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const navigate = useNavigate();
  const { token, login } = useAuth();
  const [loading, setLoading] = useState(false);

  if (token) return <Navigate to="/dashboard" replace />;

  const onFinish = async (values) => {
    setLoading(true);
    await login(values.username, values.password);
    setLoading(false);
    navigate('/dashboard');
  };

  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 px-4">
      <Card className="w-full max-w-[420px] shadow-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-blue-800 text-sm font-bold italic text-white">
            Double A
          </div>
          <h1 className="text-2xl font-bold">Admin System</h1>
          <p className="mt-1 text-slate-500">เข้าสู่ระบบ ERP</p>
        </div>

        <Form layout="vertical" onFinish={onFinish} initialValues={{ username: 'chatree', password: 'password' }}>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input prefix={<UserOutlined />} size="large" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password prefix={<LockOutlined />} size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={loading}>
            เข้าสู่ระบบ
          </Button>
        </Form>
      </Card>
    </div>
  );
}
