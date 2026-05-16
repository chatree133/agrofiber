import { LogoutOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import { Avatar, Button, Layout, Menu, Tooltip } from 'antd';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { appMenus, flattenMenus } from '../data/menuItems.jsx';

const { Sider } = Layout;

function isAllowed(item, roles) {
  if (!item.allowedRoles?.length) return true;
  return item.allowedRoles.some((role) => roles.includes(role));
}

export function AppSidebarContent({ collapsed = false, onNavigate }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, updateFavoriteMenus } = useAuth();
  const [openKeys, setOpenKeys] = useState(['/favorite']);
  const favoriteMenus = user.favoriteMenus || [];
  const allMenus = flattenMenus(appMenus);

  const items = useMemo(() => {
    const favorites = favoriteMenus
      .map((key) => allMenus.find((item) => item.key === key))
      .filter(Boolean)
      .map((item) => ({
        key: `favorite:${item.key}`,
        label: item.label,
      }));

    return appMenus
      .filter((item) => isAllowed(item, user.roles || []))
      .map((item) => {
        const children =
          item.key === '/favorite'
            ? favorites
            : item.children?.filter((child) => isAllowed(child, user.roles || []));

        return {
          key: item.key,
          icon: item.icon,
          label: item.label,
          children: children?.map((child) => ({
            key: child.key,
            label: (
              <span className="group flex items-center justify-between gap-2">
                <span className="truncate">{child.label}</span>
                {item.key !== '/favorite' && (
                  <Tooltip title={favoriteMenus.includes(child.key) ? 'ลบจาก Favorite' : 'เพิ่ม Favorite'}>
                    <Button
                      type="text"
                      size="small"
                      icon={
                        favoriteMenus.includes(child.key) ? (
                          <StarFilled className="text-yellow-400" />
                        ) : (
                          <StarOutlined className="text-slate-300 group-hover:text-yellow-400" />
                        )
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        updateFavoriteMenus(child.key);
                      }}
                    />
                  </Tooltip>
                )}
              </span>
            ),
          })),
        };
      });
  }, [allMenus, favoriteMenus, updateFavoriteMenus, user.roles]);

  const handleNavigate = (key) => {
    navigate(String(key).replace('favorite:', ''));
    onNavigate?.();
  };

  return (
    <div className="flex h-screen min-h-0 flex-col bg-ink px-3 py-5 text-white">
      <div className="flex flex-col items-center gap-3 border-b border-white/15 pb-3">
        <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-sky-300 bg-white p-2">
          <img
            src="https://www.agro-thailand.com/wp-content/uploads/2025/12/logo03.png"
            alt="Agro Thailand"
            className="h-full w-full object-contain"
          />
        </div>
        {!collapsed && <div className="text-sm font-semibold">Agrofiber System</div>}
      </div>

      <div className="flex flex-col items-center gap-3 border-b border-white/15 py-3">
        <Avatar src={user.avatarUrl} size={64} className="border-2 border-sky-300" />
        {!collapsed && <div className="text-center text-base">{user.name}</div>}
      </div>

      <Menu
        mode="inline"
        theme="dark"
        selectedKeys={[location.pathname]}
        openKeys={collapsed ? [] : openKeys}
        onOpenChange={setOpenKeys}
        items={items}
        onClick={({ key }) => handleNavigate(key)}
        className="mt-1 min-h-0 flex-1 overflow-y-auto border-0 bg-transparent pb-3"
      />

      <div className="mt-3 shrink-0 border-t border-white/15 pt-3">
        <Button
          type="text"
          danger
          block
          icon={<LogoutOutlined />}
          className={`${collapsed ? 'justify-center' : 'justify-start'} text-base`}
          onClick={() => {
            logout();
            navigate('/login');
            onNavigate?.();
          }}
        >
          {!collapsed && 'ออกจากระบบ'}
        </Button>
      </div>
    </div>
  );
}

export default function AppSidebar({ collapsed }) {
  return (
    <Sider
      width={290}
      collapsedWidth={88}
      collapsed={collapsed}
      className="sticky top-0 hidden h-screen overflow-hidden bg-ink lg:block"
    >
      <AppSidebarContent collapsed={collapsed} />
    </Sider>
  );
}
