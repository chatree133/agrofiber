# TODO

## Backend: Create User via Stored Procedure (ภายหลัง)

บริบท: `backend/src/routes/account.js` ใน `router.post('/')` ตอนนี้สร้าง user ด้วย query + transaction ใน Node (ทำงานได้) แต่อนาคตอาจย้ายไปทำใน Stored Procedure เพื่อให้ logic ฝั่ง DB เป็นศูนย์กลางและลด round-trip.

### งานที่ต้องทำ

- [ ] ออกแบบ SP: `dbo.CreateUser`
- [ ] กำหนด input/output ของ SP
- [ ] รองรับ roles แบบ bulk
- [ ] ทำ transaction ใน SP (insert Users + insert UserRoles)
- [ ] คืนค่า `UserId` และข้อมูลที่จำเป็น
- [ ] ปรับ `backend/src/routes/account.js` ให้เรียก `mssqlExecProc('DEFAULT', 'dbo.CreateUser', ...)`
- [ ] จัดการ error ให้ตอบ status code ถูกต้อง
- [ ] อัปเดตเอกสาร/ตัวอย่างการตั้งค่า env และ schema

### ข้อเสนอแนะเชิงเทคนิค

- Hash password ควรทำใน Node แล้วส่ง `passwordHash` เข้า SP (ไม่ควรส่ง plain password)
- Avatar upload (`avatarDataUrl -> /uploads/...`) ยังควรทำใน Node แล้วส่ง `avatarUrl` เข้า SP
- Bulk roles:
- ถ้าใช้ SQL Server แนะนำ TVP (Table-Valued Parameter) หรือส่ง JSON แล้ว parse ใน SP
- Mapping error:
- Duplicate `Username/StaffId` ควร map เป็น `409 Conflict` พร้อม message ชัดเจน

## Backend: Decide which documents require approval

บริบท: approval/workflow engine ถูกทำให้ generic แล้ว (WorkflowDefinitions/WorkflowSteps + ApprovalRequests/ApprovalSteps) แต่ยังต้องกำหนด “policy” ว่าเอกสารประเภทไหนจำเป็นต้องผ่าน approval flow และเอกสารประเภทไหนข้ามได้ (เช่น Sales Order บาง role สามารถ create เป็น `confirmed` ได้โดยไม่ต้อง request approval)

### งานที่ต้องทำ

- [ ] นิยามรายการ `DocumentType` ทั้งหมดที่อยู่ในระบบ (รวม master/config ที่ไม่ต้องมี DocumentSeries)
- [ ] ตัดสินใจ per-DocumentType ว่า `approvalRequired` หรือ optional
- [ ] ถ้า optional: นิยามเงื่อนไข/สิทธิ์ที่ข้ามได้ (เช่น role ที่ create ได้เลย, หรือ flag/setting)
- [ ] ออกแบบจุดบังคับใช้ใน backend (เช่น helper `ensureApprovalRequired(documentType, userRoleIds)` หรือ config table)
- [ ] ให้สถานะเอกสาร/DocumentStatusHistory สอดคล้องกับ flow (draft/requested/approved/rejected/confirmed/closed)

## Pricing: Add UnitId to ItemPricingPolicies & Bulk Excel Import (ภายหลัง)

บริบท: ในอนาคตอาจมีแผนในการเพิ่มฟิลด์ `UnitId` ลงในตาราง `dbo.ItemPricingPolicies` ตั้งแต่แรกเริ่มสร้างนโยบายราคา เพื่อให้การควบคุมและกำหนดราคาสินค้ายืดหยุ่นตามหน่วยนับต่างๆ

### งานที่ต้องทำ

- [ ] ออกแบบการเพิ่มฟิลด์ `UnitId` ในตาราง `dbo.ItemPricingPolicies` และเพิ่ม Foreign Key เชื่อมกับตาราง `dbo.Units(UnitId)`
- [ ] ปรับปรุงระบบการอัปโหลดข้อมูลนโยบายราคาผ่าน Excel (`POST /bulk/pricing-policies` ใน `backend/src/routes/items.js`) ให้รองรับการอัปโหลดหน่วยขาย (UoM) โดยตรงจาก Excel
- [ ] รองรับการประมวลผลและการบันทึกข้อมูลตามรหัสหน่วยขายที่หลากหลาย เช่น:
  - `PALLET`
  - `PCS`
  - `SHEET`
  - `PACK`
- [ ] อัปเดตตรรกะการตรวจสอบและการนำส่งข้อมูลในขั้นตอนการแสดงผลและการคำนวณราคาขายตามหน่วยนับที่กำหนด

## Sales Order Cancellation: Discuss with Accounting (ยังไม่ต้องทำปุ่มยกเลิกตอนนี้)

บริบท: ต้องการรองรับการ "ยกเลิกใบสั่งขาย" (Cancel Sales Order) ในอนาคต แต่ยังไม่มีการทำปุ่มในตอนนี้

### งานที่ต้องทำ

- [ ] ตรวจสอบเงื่อนไขกับแผนกบัญชีก่อนว่า มีเงื่อนไขอะไรบ้างที่สามารถยกเลิกได้ และมีเงื่อนไขอะไรบ้างที่ไม่สามารถยกเลิกได้
- [ ] สรุปกฎเกณฑ์และนำมาออกแบบจุดบังคับใช้ในระบบ (เช่น สถานะการออก DO, การออก Invoice, การจองสต็อก)

