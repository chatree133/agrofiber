import { Card, Empty } from 'antd';
import { useLocation } from 'react-router-dom';
import { findMenuPath } from '../data/menuItems.jsx';

export default function GenericPage() {
  const { pathname } = useLocation();
  const path = findMenuPath(pathname);
  const title = path.at(-1)?.label || pathname;

  return (
    <Card title={title} size="small">
      <Empty description="Dummy page สำหรับเตรียม UX/UI และ route ก่อนเชื่อมต่อฐานข้อมูลจริง" />
    </Card>
  );
}
