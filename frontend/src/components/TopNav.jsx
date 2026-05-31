import { Avatar, Badge, Button, Dropdown } from 'antd';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { findMenuPath, navMenus } from '../data/menuItems.jsx';
import defaultUserAvatar from '../assets/default-user.svg';

export default function TopNav({ collapsed, onToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const breadcrumb = findMenuPath("/" + location.pathname.split("/").filter(Boolean).slice(0, 2).join("/"));
  const fallbackAvatar = defaultUserAvatar;
  const [avatarSrc, setAvatarSrc] = useState(user?.avatarUrl || fallbackAvatar);

  useEffect(() => {
    setAvatarSrc(user?.avatarUrl || fallbackAvatar);
  }, [user?.avatarUrl, fallbackAvatar]);

  const handleAvatarError = () => {
    setAvatarSrc(fallbackAvatar);
    return false;
  };

  const overlay = (
    <div className="w-72 overflow-hidden rounded-md bg-white shadow-xl">
      <div className="flex flex-col items-center gap-3 bg-brand p-6 text-white">
        <Avatar
          src={avatarSrc}
          size={72}
          className="border-4 border-sky-200"
          onError={handleAvatarError}
        />
        <div className="text-lg font-semibold">{user.name}</div>
      </div>
      <div className="p-3">
        <Button
          block
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          ออกจากระบบ
        </Button>
      </div>
    </div>
  );

  return (
    <header className="sticky top-0 z-20 flex h-[76px] items-center gap-4 border-b border-slate-200 bg-white px-5">
      <button
        type="button"
        aria-label={collapsed ? 'เปิดเมนู' : 'ปิดเมนู'}
        onClick={onToggle}
        className="grid h-12 w-12 place-items-center rounded-lg border border-emerald-800 bg-white p-0 shadow-sm transition hover:shadow-md"
      >
        <img src="/hum-menu.svg" alt="" className="h-11 w-11" />
      </button>

      <div className="flex min-w-[220px] flex-wrap items-center gap-2">
        {breadcrumb.length ? (
          breadcrumb.map((item, index) => (
            <Badge
              key={item.key}
              count={index < breadcrumb.length - 1 ? `${item.label} ▶` : item.label}
              style={{
                backgroundColor: '#008f4f',
                color: '#ffffff',
                borderColor: '#065f46',
                borderRadius: 6,
                boxShadow: '0 1px 2px rgb(15 23 42 / 0.15)',
                fontSize: 12,
                fontWeight: 600,
                height: 28,
                lineHeight: '28px',
                padding: '0 12px',
              }}
            />
          ))
        ) : (
          <Badge
            count="Dashboard"
            style={{
              backgroundColor: '#008f4f',
              color: '#ffffff',
              borderColor: '#065f46',
              borderRadius: 6,
              boxShadow: '0 1px 2px rgb(15 23 42 / 0.15)',
              fontSize: 12,
              fontWeight: 600,
              height: 28,
              lineHeight: '28px',
              padding: '0 12px',
            }}
          />
        )}
      </div>

      <nav className="ml-auto hidden items-center gap-7 text-xl font-bold lg:flex">
        {navMenus.map((item) => (
          <Dropdown
            key={item.key}
            menu={{
              items: item.children?.map((child) => ({ key: child.key, label: child.label })) || [],
              onClick: ({ key }) => navigate(key),
            }}
            disabled={!item.children?.length}
            trigger={['hover']}
          >
            <button
              type="button"
              className="whitespace-nowrap border-0 bg-transparent p-0 text-sm font-bold text-[#374151]"
              onClick={() => !item.children?.length && navigate(item.key)}
            >
              {item.label}
            </button>
          </Dropdown>
        ))}
      </nav>

      <Dropdown dropdownRender={() => overlay} trigger={['click']} placement="bottomRight">
        <button type="button" className="ml-auto rounded-full border-2 border-sky-400 p-1 shadow-md lg:ml-3">
          <Avatar src={avatarSrc} size={46} onError={handleAvatarError} />
        </button>
      </Dropdown>
    </header>
  );
}
