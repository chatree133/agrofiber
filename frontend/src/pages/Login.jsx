import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, message } from 'antd';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const navigate = useNavigate();
  const { token, login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  if (token) return <Navigate to="/dashboard" replace />;

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const user =  await login(values.username, values.password);
      console.log('Logged in user:', user);
      if (user.roles.includes('wms') && user.roles.length === 1) {
        navigate('/wms/dashboard');
      }else{
        navigate('/dashboard');
      }
    } catch (error) {
      message.error(error?.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 px-4">
      <Card className="w-full max-w-[420px] shadow-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-20 w-20 place-items-center overflow-hidden rounded-full border-2 border-sky-300 bg-white p-2">
            <img
              src="https://www.agro-thailand.com/wp-content/uploads/2025/12/logo03.png"
              alt="Agro Thailand"
              className="h-full w-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold">เข้าสู่ระบบ ERP System</h1>
        </div>

        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input prefix={<UserOutlined />} size="large" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password
              prefix={<LockOutlined />}
              size="large"
              onPressEnter={() => form.submit()}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={loading}>
            เข้าสู่ระบบ
          </Button>
        </Form>
      </Card>
    </div>
  );
}
