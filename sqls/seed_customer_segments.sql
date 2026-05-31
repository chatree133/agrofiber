-- --------------------------------------------------------
-- Seed Data for CustomerSegments
-- --------------------------------------------------------

SET IDENTITY_INSERT dbo.CustomerSegments ON;
GO

INSERT INTO dbo.CustomerSegments (CustomerSegmentId, SegmentCode, SegmentName, Description, IsActive)
VALUES 
(1, 'END_USER', 'End user / Retail', N'ลูกค้ารายย่อย / ซื้อปลีก', 1),
(2, 'DEALER', 'Dealer / Distributor', N'ดีลเลอร์ / ผู้จัดจำหน่าย', 1),
(3, 'CONTRACTOR', 'Contractor', N'ช่าง / ผู้รับเหมาก่อสร้าง', 1),
(4, 'PROJECT', 'Project', N'ลูกค้าโครงการ / ผู้พัฒนาอสังหาฯ', 1),
(5, 'MODERN_TRADE', 'Modern Trade', N'ห้างสรรพสินค้า / โมเดิร์นเทรด', 1);
GO

SET IDENTITY_INSERT dbo.CustomerSegments OFF;
GO
