# Agrofiber ERP Starter

React + Vite + Tailwind + Ant Design frontend และ Node.js + Express backend สำหรับระบบ ERP เบื้องต้น

## โครงสร้าง

- `frontend` React app พร้อมหน้า login, member layout, navbar, breadcrumb, sidebar menu tree และ favorite menu
- `backend` Express API พร้อม JWT auth, role-based middleware, CORS allowlist และ route ERP หลัก
- `sqls/erp_schema.sql` MSSQL schema สำหรับ users, roles, SO, PO, DO, quotations, inventory, stock และ WMS

## วิธีรัน

```bash
npm install
npm run dev
npm run dev:backend
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:4000`

Dummy login:

- username: `chatree`
- password: `password`

## Route Backend หลัก

- `POST /api/auth/login`
- `GET /api/sale-orders`
- `POST /api/sale-orders`
- `GET /api/purchase-orders`
- `POST /api/purchase-orders`
- `GET /api/delivery-orders`
- `POST /api/delivery-orders`
- `GET /api/quotations`
- `POST /api/quotations`
- `GET /api/inventory/items`
- `GET /api/stock/on-hand`
- `GET /api/wms/tasks`
- `PUT /api/users/menus/favorite`

## CORS

Allowed origins รองรับ:

- `localhost`
- `127.0.0.1`
- `*.advanceagro.net`
- `*.advanceagro.com`
- `*.doubleapaper.com`
