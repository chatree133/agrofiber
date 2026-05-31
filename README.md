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


Viewed erp_schema.sql:352-383

ตาราง `dbo.ItemPricingPolicies` ใช้สำหรับ **กำหนดนโยบายและโครงสร้างราคาของสินค้า (Item Pricing Policy)** ว่าสินค้าแต่ละตัวมีกลยุทธ์การตั้งราคาขายและการควบคุมกำไรอย่างไร โดยรองรับการกำหนดราคาล่วงหน้าหรือตามช่วงเวลาได้ (Effective Date)

ความหมายของแต่ละคอลัมน์มีดังนี้ครับ:

1. **`ItemPricingPolicyId`**: รหัสอ้างอิงหลักของตารางนี้ (Primary Key) สร้างอัตโนมัติเมื่อมีการเพิ่มข้อมูล
2. **`ItemId`**: รหัสสินค้า (เชื่อมโยงกับตาราง `dbo.Items`) เพื่อระบุว่านโยบายราคานี้เป็นของสินค้าตัวไหน
3. **`PricingMethodId`**: รหัสวิธี/กลยุทธ์การตั้งราคา (เชื่อมโยงกับตาราง `dbo.PricingMethods`) เช่น อาจจะหมายถึง
   - *Fixed Price*: ราคาคงที่
   - *Markup on Cost*: บวกเปอร์เซ็นต์เพิ่มจากต้นทุน
   - *Target Margin*: ตั้งราคาแบบรักษาสัดส่วนกำไรขั้นต้น
4. **`StandardPrice`**: "ราคาขายมาตรฐาน" (ราคาตั้งต้นก่อนหักส่วนลดต่างๆ)
5. **`StandardCost`**: "ต้นทุนมาตรฐาน" (ใช้เป็นฐานในการอ้างอิงสำหรับคำนวณกำไรหรือตั้งราคาขายแบบ Markup)
6. **`MinMarginPercent`**: % กำไรขั้นต่ำสุดที่ระบบหรือบริษัทรับได้ (คำนวณแบบ Margin = กำไร / ราคาขาย) มักใช้เป็นตัวเช็ค (Validation) เวลาพนักงานเซลส์จะลดราคา ว่าต้องไม่ทำให้กำไรต่ำกว่า % นี้
7. **`TargetMarginPercent`**: % กำไรเป้าหมาย (เทียบกับราคาขาย) ที่บริษัทคาดหวังไว้สำหรับสินค้านี้
8. **`MinMarkupPercent`**: % การบวกเพิ่มขั้นต่ำจากต้นทุน (คำนวณแบบ Markup = กำไร / ต้นทุน) 
9. **`TargetMarkupPercent`**: % การบวกเพิ่มเป้าหมายจากต้นทุน เพื่อนำไปคำนวณเป็นราคาขายเป้าหมาย
10. **`CurrencyCode`**: สกุลเงินที่ใช้ในนโยบายราคานี้ (ค่าเริ่มต้นคือ `THB` เงินบาท)
11. **`EffectiveFrom`**: วันที่นโยบายราคานี้ "เริ่มมีผลบังคับใช้" (ค่าเริ่มต้นคือวันที่ปัจจุบัน)
12. **`EffectiveTo`**: วันที่นโยบายราคานี้ "สิ้นสุดการมีผล" (ถ้าเป็น `NULL` หมายความว่าใช้ได้ตลอดไปจนกว่าจะมีการเปลี่ยน/ยกเลิก)
13. **`IsActive`**: สถานะการใช้งาน (1 = ใช้งานอยู่, 0 = ปิดการใช้งาน)
14. **`CreatedAt`**: วันเวลาที่บันทึกข้อมูลนโยบายนี้เข้าสู่ระบบ

ส่วนเงื่อนไข (Constraint) ที่อยู่ด้านล่าง:
* `FK_ItemPricingPolicies_Items`: ผูก Foreign Key กับตาราง `Items`
* `FK_ItemPricingPolicies_PricingMethods`: ผูก Foreign Key กับตาราง `PricingMethods`
* `CK_ItemPricingPolicies_DateRange`: กฎเช็คความถูกต้องของช่วงเวลา บังคับว่า **วันที่สิ้นสุด (`EffectiveTo`) ต้องไม่มาก่อนวันที่เริ่มต้น (`EffectiveFrom`)** หรือไม่ก็ต้องเป็นค่าว่าง (`NULL`) ไปเลย

ตารางลักษณะนี้เหมาะกับการทำระบบขายที่มี **การปรับราคาตามฤดูกาลหรือตามประกาศของบริษัท (Price History)** โดยสามารถเตรียมเพิ่มราคาของเดือนหน้าเข้าไปรอไว้ในระบบได้ (โดยตั้ง `EffectiveFrom` เป็นวันในอนาคต) ระบบเวลาขายก็จะดึงราคาและเงื่อนไขไปใช้ให้ถูกต้องตามวันที่เกิดรายการขายครับ

Edited README.md
Viewed erp_schema.sql:351-382

กรณีที่ `ItemId` ซ้ำกันในตาราง `ItemPricingPolicies` (ซึ่งมักจะเกิดจากการปรับเปลี่ยนราคาหรือโปรโมชั่นตามช่วงเวลา) ระบบจะไม่สามารถสุ่มเลือกขึ้นมาได้ครับ แต่จะใช้ **"วันที่ที่ทำรายการ (Transaction Date)"** เป็นตัวกำหนดร่วมกับฟิลด์ `EffectiveFrom`, `EffectiveTo` และ `IsActive` ครับ

โดยปกติแล้ว หลักการดึงราคามาใช้ (เช่น ตอนเปิดบิลขาย) จะใช้เงื่อนไขดังนี้ครับ:

1. **เลือกรายการที่เปิดใช้งานอยู่:** `IsActive = 1`
2. **เลือกรายการที่ครอบคลุมวันที่ขาย:** วันที่เปิดบิล (Transaction Date) จะต้องอยู่ระหว่าง `EffectiveFrom` ถึง `EffectiveTo`
   * `EffectiveFrom <= TransactionDate` (เริ่มมีผลแล้ว)
   * `EffectiveTo IS NULL OR EffectiveTo >= TransactionDate` (ยังไม่หมดอายุ หรือไม่มีวันหมดอายุ)
3. **กรณีที่มีรายการซ้อนทับกัน (Overlap):** มักจะใช้คำสั่ง `ORDER BY EffectiveFrom DESC` เพื่อเลือกนโยบายราคาที่ **"อัปเดตล่าสุด"** หรือเพิ่งประกาศใช้ล่าสุดขึ้นมาเป็นอันดับแรกครับ (`TOP 1`)

**ตัวอย่างคำสั่ง SQL ในการดึงราคาของ ItemId = 5 ณ วันที่ปัจจุบัน:**
```sql
SELECT TOP 1 *
FROM dbo.ItemPricingPolicies
WHERE ItemId = 5
  AND IsActive = 1
  AND EffectiveFrom <= CAST(SYSUTCDATETIME() AS DATE)
  AND (EffectiveTo IS NULL OR EffectiveTo >= CAST(SYSUTCDATETIME() AS DATE))
ORDER BY EffectiveFrom DESC, ItemPricingPolicyId DESC;
```

**สรุปคือ:** ระบบจะเลือก `ItemPricingPolicyId` ของนโยบายที่ **มีผลบังคับใช้ ณ วันนั้นๆ** และถ้ามีช่วงเวลาซ้อนกัน จะเลือกอันที่ **ประกาศใช้หลังสุด (ใหม่สุด)** ครับ


Best practice ของ ERP โดยทั่วไปคือ “แยกหน้าที่ (Segregation of Duties)” เป็นหลัก แล้วค่อยยืดหยุ่นด้วย policy/threshold ไม่ใช่ให้ผู้สร้างอนุมัติเองเป็นค่าเริ่มต้น

1) Accounting officer สร้าง SO ต้องให้ Accounting manager อนุมัติไหม?

โดยทั่วไป “SO” เป็นงานของฝ่ายขายมากกว่า accounting; accounting มักอนุมัติ “เครดิต/ส่วนลด/เงื่อนไขราคา/ปล่อยสินค้า/ออก invoice” มากกว่า
ถ้าองค์กรคุณให้ออก SO โดยฝ่ายบัญชีจริง ๆ:
best practice: ให้มี approval เมื่อมีความเสี่ยง/ผลกระทบ เช่น
ลูกค้าเครดิต/เกิน credit limit
ส่วนลดเกิน policy
override ราคา/กำไรต่ำกว่า threshold
ลูกค้าถูก hold
ถ้าเป็น SO ปกติราคา/เครดิตผ่าน rule แล้ว: อาจ “ไม่ต้อง approval” เพื่อไม่ให้ flow หน่วงงาน
2) ถ้า Accounting manager เป็นคน create เอง ควรให้ “อนุมัติตัวเอง” หรือ auto-approve?

best practice (strict SoD): ไม่ควร self-approve สำหรับเอกสารที่มีผลทางการเงิน/ความเสี่ยงสูง
ตัวเลือกที่พบใน ERP จริง (เรียงจากเข้ม → ผ่อน):
ห้าม self-approve: ถ้าคน create อยู่ใน approver chain → ต้องให้ step ถัดไป/ผู้มีอำนาจคนอื่นอนุมัติ (หรือให้ delegate)
อนุญาต self-approve เฉพาะบางประเภท/บางวงเงิน และต้องมี audit ชัดเจน
auto-approve เมื่อ creator เป็น approver (เร็วสุด แต่เสี่ยงสุด) ใช้ในองค์กรเล็กหรือเอกสาร low-risk
ถ้าคุณถาม “ควรเป็นอะไรใน ERP” คำตอบที่ปลอดภัยและเป็นมาตรฐานคือ:

ตั้งค่า default = ห้าม self-approve
ถ้าต้องการความเร็ว: ทำ “policy exemption” แบบ explicit (เช่น DocumentType บางอย่างหรือวงเงินต่ำ) และ log audit
3) รูปแบบที่แนะนำให้คุณใช้กับ workflow engine ที่ทำอยู่

เพิ่ม policy ใน runtime ตอน submit:
ถ้า creator เป็นคนเดียวกับ approver step นั้น → skip step ได้เฉพาะเมื่อเปิด setting หรือบังคับให้ไป step ถัดไป
เก็บ audit ว่าเกิดการ skip/auto-approve เพราะ policy อะไร (เพื่อให้ตรวจสอบย้อนหลังได้)
ถ้าคุณบอก 2 อย่างนี้ ผมช่วยเสนอ rule set ที่ลงตัวให้เลย:

SO ของคุณถือเป็นเอกสาร “ต้องอนุมัติ” เสมอไหม หรืออนุมัติเฉพาะกรณี (discount/credit/price override)?
บริษัทคุณ “มีคนอนุมัติลำดับถัดไป” เสมอไหม (เช่น manager/finance director) หรือบางครั้งมีแค่คนเดียวจริง ๆ?