import { Drawer, Layout } from 'antd';
import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar, { AppSidebarContent } from './AppSidebar.jsx';
import { useLocation } from 'react-router-dom';
import TopNav from './TopNav.jsx';

export default function MainLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleToggleMenu = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setCollapsed((value) => !value);
      return;
    }

    setMobileMenuOpen(true);
  };

  useEffect(() => {
    if (location.pathname.includes('/document/print')) {
      setCollapsed(true);
    }
  }, []);

  return (
    <Layout className="min-h-screen">
      <AppSidebar collapsed={collapsed} />
      <Layout>
        <TopNav collapsed={collapsed} onToggle={handleToggleMenu} />
        <main className="min-h-[calc(100vh-76px)] bg-white px-4 py-4 lg:px-5 lg:py-5">
          <Outlet />
        </main>
      </Layout>
      <Drawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        placement="left"
        width={290}
        closable={false}
        styles={{
          body: { padding: 0, background: '#071d2c' },
          content: { background: '#071d2c' },
        }}
      >
        <AppSidebarContent onNavigate={() => setMobileMenuOpen(false)} />
      </Drawer>
    </Layout>
  );
}
