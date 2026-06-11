CREATE DATABASE AgrofiberERP;
GO

USE AgrofiberERP;
GO

CREATE TABLE dbo.Roles (
    RoleId INT IDENTITY(1,1) PRIMARY KEY,
    RoleCode NVARCHAR(50) NOT NULL UNIQUE,
    RoleName NVARCHAR(100) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.Users (
    UserId INT IDENTITY(1,1) PRIMARY KEY,
    Username NVARCHAR(100) NOT NULL UNIQUE,
    StaffId NVARCHAR(100) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    DisplayName NVARCHAR(200) NOT NULL,
    JobTitle NVARCHAR(100) NULL,
    Email NVARCHAR(255) NULL,
    AvatarUrl NVARCHAR(500) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL
);

CREATE TABLE dbo.UserRoles (
    UserId INT NOT NULL,
    RoleId INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT PK_UserRoles PRIMARY KEY (UserId, RoleId),
    CONSTRAINT FK_UserRoles_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_UserRoles_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles(RoleId)
);

CREATE TABLE dbo.UserFavoriteMenus (
    UserId INT NOT NULL,
    MenuKey NVARCHAR(200) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_UserFavoriteMenus PRIMARY KEY (UserId, MenuKey),
    CONSTRAINT FK_UserFavoriteMenus_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId)
);

CREATE TABLE dbo.Companies (
    CompanyId INT IDENTITY(1,1) PRIMARY KEY,
    CompanyCode NVARCHAR(30) NOT NULL UNIQUE,
    CompanyName NVARCHAR(255) NOT NULL,
    TaxId NVARCHAR(50) NULL,
    Address NVARCHAR(1000) NULL,
    Phone NVARCHAR(50) NULL,
    Email NVARCHAR(255) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.Branches (
    BranchId INT IDENTITY(1,1) PRIMARY KEY,
    CompanyId INT NOT NULL,
    BranchCode NVARCHAR(30) NOT NULL,
    BranchName NVARCHAR(255) NOT NULL,
    TaxBranchCode NVARCHAR(30) NULL,
    Address NVARCHAR(1000) NULL,
    IsHeadOffice BIT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT UQ_Branches UNIQUE (CompanyId, BranchCode),
    CONSTRAINT FK_Branches_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(CompanyId)
);

CREATE TABLE dbo.DocumentSeries (
    DocumentSeriesId INT IDENTITY(1,1) PRIMARY KEY,
    DocumentType NVARCHAR(40) NOT NULL,
    SeriesCode NVARCHAR(30) NOT NULL,
    BranchId INT NULL,
    PrefixFormat NVARCHAR(50) NOT NULL,
    PaddingLength INT NOT NULL DEFAULT 4,
    ResetFrequency NVARCHAR(20) NOT NULL DEFAULT 'yearly',
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT UQ_DocumentSeries UNIQUE (DocumentType, SeriesCode, BranchId),
    CONSTRAINT FK_DocumentSeries_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
    CONSTRAINT CK_DocumentSeries_ResetFrequency CHECK (ResetFrequency IN ('never', 'yearly', 'monthly', 'daily'))
);

CREATE TABLE dbo.DocumentNumberCounters (
    DocumentNumberCounterId INT IDENTITY(1,1) PRIMARY KEY,
    DocumentSeriesId INT NOT NULL,
    PeriodKey NVARCHAR(20) NOT NULL,
    LastNumber INT NOT NULL DEFAULT 0,
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_DocumentNumberCounters UNIQUE (DocumentSeriesId, PeriodKey),
    CONSTRAINT FK_DocumentNumberCounters_DocumentSeries FOREIGN KEY (DocumentSeriesId) REFERENCES dbo.DocumentSeries(DocumentSeriesId)
);

CREATE TABLE dbo.SmtpSettings (
    SmtpSettingId INT IDENTITY(1,1) PRIMARY KEY,
    SmtpHost NVARCHAR(255) NOT NULL,
    SmtpPort INT NOT NULL DEFAULT 587,
    SmtpUser NVARCHAR(255) NOT NULL,
    SmtpPassword NVARCHAR(255) NOT NULL,
    SmtpSender NVARCHAR(255) NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL
);

CREATE TABLE dbo.DocumentStatuses (
    DocumentStatusId INT IDENTITY(1,1) PRIMARY KEY,
    DocumentType NVARCHAR(40) NOT NULL,
    StatusCode NVARCHAR(30) NOT NULL,
    StatusName NVARCHAR(100) NOT NULL,
    IsTerminal BIT NOT NULL DEFAULT 0,
    SortOrder INT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT UQ_DocumentStatuses UNIQUE (DocumentType, StatusCode)
);

CREATE TABLE dbo.TaxCodes (
    TaxCodeId INT IDENTITY(1,1) PRIMARY KEY,
    TaxCode NVARCHAR(30) NOT NULL UNIQUE,
    TaxName NVARCHAR(100) NOT NULL,
    TaxRatePercent DECIMAL(9,4) NOT NULL DEFAULT 0,
    IsDefault BIT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.PaymentTerms (
    PaymentTermId INT IDENTITY(1,1) PRIMARY KEY,
    PaymentTermCode NVARCHAR(50) NOT NULL UNIQUE,
    PaymentTermName NVARCHAR(255) NOT NULL,
    Days INT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.PricingMethods (
    PricingMethodId INT IDENTITY(1,1) PRIMARY KEY,
    PricingMethodCode NVARCHAR(30) NOT NULL UNIQUE,
    PricingMethodName NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500) NULL,
    IsActive BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.CustomerSegments (
    CustomerSegmentId INT IDENTITY(1,1) PRIMARY KEY,
    SegmentCode NVARCHAR(30) NOT NULL UNIQUE,
    SegmentName NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500) NULL,
    IsActive BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.CustomerPriceGroups (
    CustomerPriceGroupId INT IDENTITY(1,1) PRIMARY KEY,
    PriceGroupCode NVARCHAR(50) NOT NULL UNIQUE,
    PriceGroupName NVARCHAR(255) NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.PriceLists (
    PriceListId INT IDENTITY(1,1) PRIMARY KEY,
    PriceListCode NVARCHAR(50) NOT NULL UNIQUE,
    PriceListName NVARCHAR(255) NOT NULL,
    CustomerSegmentId INT NULL,
    CurrencyCode CHAR(3) NOT NULL DEFAULT 'THB',
    IsActive BIT NOT NULL DEFAULT 1,
    Priority INT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CustomerPriceGroupId INT NULL,
    CONSTRAINT FK_PriceLists_CustomerSegments FOREIGN KEY (CustomerSegmentId) REFERENCES dbo.CustomerSegments(CustomerSegmentId),
    CONSTRAINT FK_PriceLists_CustomerPriceGroups FOREIGN KEY (CustomerPriceGroupId) REFERENCES dbo.CustomerPriceGroups(CustomerPriceGroupId)
);

CREATE TABLE dbo.DiscountRules (
    DiscountRuleId INT IDENTITY(1,1) PRIMARY KEY,
    DiscountRuleCode NVARCHAR(50) NOT NULL UNIQUE,
    DiscountRuleName NVARCHAR(255) NOT NULL,
    DiscountType NVARCHAR(30) NOT NULL DEFAULT 'PERCENT',
    DiscountPercent DECIMAL(9,4) NULL,
    DiscountAmount DECIMAL(18,4) NULL,
    Priority INT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,
    ApplyLevel NVARCHAR(20) NOT NULL DEFAULT 'LINE',
    CanCombine BIT NOT NULL DEFAULT 1,
    StopProcessing BIT NOT NULL DEFAULT 0,
    MinOrderAmount DECIMAL(18,4) NULL,
    MaxOrderAmount DECIMAL(18,4) NULL,
    PricingSequenceId INT NULL,
    Description NVARCHAR(500) NULL,
    ItemId INT NULL,
    CustomerId INT NULL,
    EffectiveFrom DATE NOT NULL DEFAULT (CAST(SYSUTCDATETIME() AS DATE)),
    EffectiveTo DATE NULL,
    CONSTRAINT CK_DiscountRules_Level CHECK (ApplyLevel IN ('LINE', 'ORDER')),
    CONSTRAINT CK_DiscountRules_Type CHECK (DiscountType IN ('PERCENT', 'AMOUNT')),
    CONSTRAINT CK_DiscountRules_Amount CHECK (MaxOrderAmount IS NULL OR MinOrderAmount IS NULL OR MaxOrderAmount >= MinOrderAmount),
    CONSTRAINT FK_DiscountRules_PricingSequences FOREIGN KEY (PricingSequenceId) REFERENCES dbo.PricingSequences(PricingSequenceId)
);

CREATE TABLE dbo.PricingSequences (
    PricingSequenceId INT IDENTITY(1,1) PRIMARY KEY,
    SequenceCode NVARCHAR(50) NOT NULL UNIQUE,
    SequenceName NVARCHAR(255) NOT NULL,
    ExecutionOrder INT NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1
);

INSERT INTO dbo.PricingSequences
(
    SequenceCode,
    SequenceName,
    ExecutionOrder
)
VALUES
('BASE_PRICE', 'Base Price', 10),
('CONTRACT_PRICE', 'Customer Contract', 20),
('LINE_DISCOUNT', 'Line Discount', 30),
('ORDER_DISCOUNT', 'Order Discount', 40),
('PROMOTION', 'Promotion', 50);

CREATE TABLE dbo.Customers (
    CustomerId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerCode NVARCHAR(50) NOT NULL UNIQUE,
    CustomerName NVARCHAR(255) NOT NULL,
    CustomerSegmentId INT NULL,
    TaxId NVARCHAR(50) NULL,
    PriceListId INT NULL,
    DiscountRuleId INT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CustomerPriceGroupId INT NULL,
    CONSTRAINT FK_Customers_CustomerSegments FOREIGN KEY (CustomerSegmentId) REFERENCES dbo.CustomerSegments(CustomerSegmentId),
    CONSTRAINT FK_Customers_PriceLists FOREIGN KEY (PriceListId) REFERENCES dbo.PriceLists(PriceListId),
    CONSTRAINT FK_Customers_DiscountRules FOREIGN KEY (DiscountRuleId) REFERENCES dbo.DiscountRules(DiscountRuleId),
    CONSTRAINT FK_Customers_CustomerPriceGroups FOREIGN KEY (CustomerPriceGroupId) REFERENCES dbo.CustomerPriceGroups(CustomerPriceGroupId)
);

CREATE TABLE dbo.CustomerAddresses (
    CustomerAddressId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NOT NULL,
    AddressCode NVARCHAR(50) NOT NULL,
    BranchCode NVARCHAR(5) NOT NULL,
    AddressType NVARCHAR(30) NOT NULL,
    ContactName NVARCHAR(255) NULL,
    Phone NVARCHAR(50) NULL,
    AddressLine1 NVARCHAR(500) NOT NULL,
    AddressLine2 NVARCHAR(500) NULL,
    District NVARCHAR(100) NULL,
    Province NVARCHAR(100) NULL,
    PostalCode NVARCHAR(20) NULL,
    CountryCode CHAR(2) NOT NULL DEFAULT 'TH',
    IsDefault BIT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT UQ_CustomerAddresses UNIQUE (CustomerId, AddressCode),
    CONSTRAINT FK_CustomerAddresses_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId),
    CONSTRAINT CK_CustomerAddresses_Type CHECK (AddressType IN ('BILLING', 'SHIPPING', 'BILLING_SHIPPING'))
);

CREATE TABLE dbo.CustomerContacts (
    CustomerContactId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NOT NULL,
    ContactName NVARCHAR(255) NOT NULL,
    JobTitle NVARCHAR(100) NULL,
    Phone NVARCHAR(50) NULL,
    Email NVARCHAR(255) NULL,
    IsPrimary BIT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT FK_CustomerContacts_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId)
);

CREATE TABLE dbo.Vendors (
    VendorId INT IDENTITY(1,1) PRIMARY KEY,
    VendorCode NVARCHAR(50) NOT NULL UNIQUE,
    VendorName NVARCHAR(255) NOT NULL,
    TaxId NVARCHAR(50) NULL,
    Address NVARCHAR(1000) NULL,
    IsActive BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.VendorContacts (
    VendorContactId INT IDENTITY(1,1) PRIMARY KEY,
    VendorId INT NOT NULL,
    ContactName NVARCHAR(255) NOT NULL,
    JobTitle NVARCHAR(100) NULL,
    Phone NVARCHAR(50) NULL,
    Email NVARCHAR(255) NULL,
    IsPrimary BIT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT FK_VendorContacts_Vendors FOREIGN KEY (VendorId) REFERENCES dbo.Vendors(VendorId)
);

CREATE TABLE dbo.Units (
    UnitId INT IDENTITY(1,1) PRIMARY KEY,
    UnitCode NVARCHAR(30) NOT NULL UNIQUE,
    UnitName NVARCHAR(100) NOT NULL
);

CREATE TABLE dbo.ProductTypes (
    ProductTypeId INT IDENTITY(1,1) PRIMARY KEY,
    ProductTypeCode NVARCHAR(50) NOT NULL UNIQUE,
    ProductTypeName NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500) NULL,
    IsActive BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.Surfaces (
    SurfaceId INT IDENTITY(1,1) PRIMARY KEY,
    SurfaceCode NVARCHAR(50) NOT NULL UNIQUE,
    SurfaceName NVARCHAR(100) NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1
);
INSERT INTO dbo.Surfaces (SurfaceCode, SurfaceName) VALUES 
('S1', 'เรียบ (Smooth)'),
('S2', 'ขัดทราย (Sanded)'),
('S3', 'ดิบ (Raw)');

CREATE TABLE dbo.Grades (
    GradeId INT IDENTITY(1,1) PRIMARY KEY,
    GradeCode NVARCHAR(50) NOT NULL UNIQUE,
    GradeName NVARCHAR(100) NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1
);
INSERT INTO dbo.Grades (GradeCode, GradeName) VALUES 
('A', 'เกรด A (Grade A)'),
('B', 'เกรด B (Grade B)'),
('REJECT', 'ตกเกรด (Reject)');

CREATE TABLE dbo.ItemTypes (
    ItemTypeId INT IDENTITY(1,1) PRIMARY KEY,
    ItemTypeCode NVARCHAR(30) NOT NULL UNIQUE,
    ItemTypeName NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500) NULL,
    IsStockItem BIT NOT NULL DEFAULT 1,
    IsSellable BIT NOT NULL DEFAULT 0,
    IsPurchasable BIT NOT NULL DEFAULT 0,
    IsManufacturable BIT NOT NULL DEFAULT 0,
    IsBomComponent BIT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.ItemThicknesses (
    ThicknessId INT IDENTITY(1,1) PRIMARY KEY,
    ThicknessMm DECIMAL(9,3) NOT NULL UNIQUE,
    ThicknessLabel NVARCHAR(50) NULL,
    IsActive BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.ItemWidths (
    WidthId INT IDENTITY(1,1) PRIMARY KEY,
    WidthM DECIMAL(9,3) NOT NULL UNIQUE,
    WidthLabel NVARCHAR(50) NULL,
    IsActive BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.ItemLengths (
    LengthId INT IDENTITY(1,1) PRIMARY KEY,
    LengthM DECIMAL(9,3) NOT NULL UNIQUE,
    LengthLabel NVARCHAR(50) NULL,
    IsActive BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.Items (
    ItemId INT IDENTITY(1,1) PRIMARY KEY,
    ItemCode NVARCHAR(80) NOT NULL UNIQUE,
    ItemName NVARCHAR(255) NOT NULL,
    ItemTypeId INT NOT NULL,
    ProductTypeId INT NULL,
    ThicknessId INT NULL,
    WidthId INT NULL,
    LengthId INT NULL,
    AreaSqm DECIMAL(18,6) NULL,
    UnitId INT NOT NULL,
    TaxCodeId INT NULL,
    DefaultWarehouseId INT NULL,
    ValuationMethod NVARCHAR(20) NOT NULL DEFAULT 'average',
    AllowNegativeStock BIT NOT NULL DEFAULT 0,
    Status NVARCHAR(30) NOT NULL DEFAULT 'draft',
    IsLotControlled BIT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT FK_Items_ItemTypes FOREIGN KEY (ItemTypeId) REFERENCES dbo.ItemTypes(ItemTypeId),
    CONSTRAINT FK_Items_ProductTypes FOREIGN KEY (ProductTypeId) REFERENCES dbo.ProductTypes(ProductTypeId),
    CONSTRAINT FK_Items_Thicknesses FOREIGN KEY (ThicknessId) REFERENCES dbo.ItemThicknesses(ThicknessId),
    CONSTRAINT FK_Items_Widths FOREIGN KEY (WidthId) REFERENCES dbo.ItemWidths(WidthId),
    CONSTRAINT FK_Items_Lengths FOREIGN KEY (LengthId) REFERENCES dbo.ItemLengths(LengthId),
    CONSTRAINT FK_Items_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId),
    CONSTRAINT FK_Items_TaxCodes FOREIGN KEY (TaxCodeId) REFERENCES dbo.TaxCodes(TaxCodeId),
    CONSTRAINT CK_Items_ValuationMethod CHECK (ValuationMethod IN ('fifo', 'average', 'standard')),
    CONSTRAINT CK_Items_Status CHECK (Status IN ('draft', 'active', 'obsolete'))
);

CREATE TABLE dbo.ItemSpecs (
    ItemSpecId INT IDENTITY(1,1) PRIMARY KEY,
    ItemId INT NOT NULL,
    SalesSKU NVARCHAR(100) NOT NULL UNIQUE,
    SpecCode NVARCHAR(50) NOT NULL,
    SpecName NVARCHAR(255) NOT NULL,
    SurfaceId INT NULL,
    GradeId INT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT UQ_ItemSpecs_ItemSpecCode UNIQUE (ItemId, SpecCode),
    CONSTRAINT FK_ItemSpecs_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_ItemSpecs_Surfaces FOREIGN KEY (SurfaceId) REFERENCES dbo.Surfaces(SurfaceId),
    CONSTRAINT FK_ItemSpecs_Grades FOREIGN KEY (GradeId) REFERENCES dbo.Grades(GradeId)
);

CREATE TABLE dbo.UnitConversions (
    UnitConversionId INT IDENTITY(1,1) PRIMARY KEY,
    FromUnitId INT NOT NULL,
    ToUnitId INT NOT NULL,
    ConversionFactor DECIMAL(18,8) NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT UQ_UnitConversions UNIQUE (FromUnitId, ToUnitId),
    CONSTRAINT FK_UnitConversions_FromUnits FOREIGN KEY (FromUnitId) REFERENCES dbo.Units(UnitId),
    CONSTRAINT FK_UnitConversions_ToUnits FOREIGN KEY (ToUnitId) REFERENCES dbo.Units(UnitId)
);

CREATE TABLE dbo.ItemUnitConversions (
    ItemUnitConversionId INT IDENTITY(1,1) PRIMARY KEY,
    ItemId INT NOT NULL,
    ItemSpecId INT NULL,
    FromUnitId INT NOT NULL,
    ToUnitId INT NOT NULL,
    ConversionFactor DECIMAL(18,8) NOT NULL,
    EffectiveFrom DATE NOT NULL DEFAULT (CAST(SYSUTCDATETIME() AS DATE)),
    EffectiveTo DATE NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT UQ_ItemUnitConversions UNIQUE (ItemId, ItemSpecId, FromUnitId, ToUnitId, EffectiveFrom),
    CONSTRAINT FK_ItemUnitConversions_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_ItemUnitConversions_ItemSpecs FOREIGN KEY (ItemSpecId) REFERENCES dbo.ItemSpecs(ItemSpecId),
    CONSTRAINT FK_ItemUnitConversions_FromUnits FOREIGN KEY (FromUnitId) REFERENCES dbo.Units(UnitId),
    CONSTRAINT FK_ItemUnitConversions_ToUnits FOREIGN KEY (ToUnitId) REFERENCES dbo.Units(UnitId),
    CONSTRAINT CK_ItemUnitConversions_DateRange CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
);

CREATE TABLE dbo.ItemPricingPolicyVersions (
    ItemPricingPolicyVersionId INT IDENTITY(1,1) PRIMARY KEY,
    VersionNo NVARCHAR(30) NOT NULL UNIQUE,
    Status NVARCHAR(30) NOT NULL DEFAULT 'draft',
    CreatedBy INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ApprovedBy INT NULL,
    ApprovedAt DATETIME2 NULL,
    Remark NVARCHAR(1000) NULL,
    CONSTRAINT FK_ItemPricingPolicyVersions_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_ItemPricingPolicyVersions_ApprovedBy FOREIGN KEY (ApprovedBy) REFERENCES dbo.Users(UserId)
);

CREATE TABLE dbo.ItemPricingPolicies (
    ItemPricingPolicyId INT IDENTITY(1,1) PRIMARY KEY,
    ItemId INT NOT NULL,
    ItemSpecId INT NULL,
    PricingMethodId INT NOT NULL, -- วิธีการกำหนดราคาหลัก เช่น ราคาขายปกติ, ราคาตามสัญญา, ส่วนลดตามเงื่อนไข ฯลฯ
    Status NVARCHAR(30) NOT NULL DEFAULT 'draft', -- สถานะของนโยบายราคา เช่น draft, requested, approved, rejected
    ApprovedBy INT NULL,
    ApprovedAt DATETIME2 NULL,
    VersionNo NVARCHAR(30) NOT NULL DEFAULT 'V1',
    Priority INT NOT NULL DEFAULT 0,
    Remark NVARCHAR(1000) NULL,
    StandardPrice DECIMAL(18,4) NOT NULL DEFAULT 0, -- ราคาขายปกติ (Base Price)
    StandardCost DECIMAL(18,4) NOT NULL DEFAULT 0, -- ราคาทุนปกติ (Standard Cost)
    MinMarginPercent DECIMAL(9,4) NULL, -- กำไรขั้นต้นขั้นต่ำเป็นเปอร์เซ็นต์
    TargetMarginPercent DECIMAL(9,4) NULL, -- เป้าหมายกำไรขั้นต้นเป็นเปอร์เซ็นต์
    MinMarkupPercent DECIMAL(9,4) NULL, -- กำไรขั้นต้นขั้นต่ำเป็นเปอร์เซ็นต์
    TargetMarkupPercent DECIMAL(9,4) NULL, -- เป้าหมายกำไรขั้นต้นเป็นเปอร์เซ็นต์
    CurrencyCode CHAR(3) NOT NULL DEFAULT 'THB',
    EffectiveFrom DATE NOT NULL DEFAULT (CAST(SYSUTCDATETIME() AS DATE)),
    EffectiveTo DATE NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedBy INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ItemPricingPolicies_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_ItemPricingPolicies_ItemSpecs FOREIGN KEY (ItemSpecId) REFERENCES dbo.ItemSpecs(ItemSpecId),
    CONSTRAINT FK_ItemPricingPolicies_PricingMethods FOREIGN KEY (PricingMethodId) REFERENCES dbo.PricingMethods(PricingMethodId),
    CONSTRAINT FK_ItemPricingPolicies_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_ItemPricingPolicies_Versions FOREIGN KEY (VersionNo) REFERENCES dbo.ItemPricingPolicyVersions(VersionNo),
    CONSTRAINT CK_ItemPricingPolicies_DateRange CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
);

CREATE TABLE dbo.ItemCosts (
    ItemCostId INT IDENTITY(1,1) PRIMARY KEY,
    ItemId INT NOT NULL,
    CostMethod NVARCHAR(30) NOT NULL,
    UnitCost DECIMAL(18,4) NOT NULL DEFAULT 0,
    CurrencyCode CHAR(3) NOT NULL DEFAULT 'THB',
    EffectiveFrom DATE NOT NULL DEFAULT (CAST(SYSUTCDATETIME() AS DATE)),
    EffectiveTo DATE NULL,
    SourceReference NVARCHAR(100) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ItemCosts_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT CK_ItemCosts_Method CHECK (CostMethod IN ('bom', 'rm', 'average', 'manual')),
    CONSTRAINT CK_ItemCosts_DateRange CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
);

CREATE TABLE dbo.Boms (
    BomId INT IDENTITY(1,1) PRIMARY KEY,
    FinishedGoodItemId INT NOT NULL,
    BomCode NVARCHAR(80) NOT NULL UNIQUE,
    BomName NVARCHAR(255) NOT NULL,
    RevisionNo NVARCHAR(30) NOT NULL DEFAULT '1',
    YieldQuantity DECIMAL(18,4) NOT NULL DEFAULT 1,
    UnitId INT NOT NULL,
    EffectiveFrom DATE NOT NULL DEFAULT (CAST(SYSUTCDATETIME() AS DATE)),
    EffectiveTo DATE NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT FK_Boms_FinishedGoodItems FOREIGN KEY (FinishedGoodItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_Boms_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId),
    CONSTRAINT CK_Boms_DateRange CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
);

CREATE TABLE dbo.BomLines (
    BomLineId INT IDENTITY(1,1) PRIMARY KEY,
    BomId INT NOT NULL,
    LineNum INT NOT NULL,
    ComponentItemId INT NOT NULL,
    QuantityPer DECIMAL(18,6) NOT NULL,
    UnitId INT NOT NULL,
    ScrapPercent DECIMAL(9,4) NOT NULL DEFAULT 0,
    CONSTRAINT UQ_BomLines UNIQUE (BomId, LineNum),
    CONSTRAINT FK_BomLines_Boms FOREIGN KEY (BomId) REFERENCES dbo.Boms(BomId),
    CONSTRAINT FK_BomLines_ComponentItems FOREIGN KEY (ComponentItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_BomLines_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId)
);

CREATE TABLE dbo.PriceListItems (
    PriceListItemId INT IDENTITY(1,1) PRIMARY KEY,
    PriceListId INT NOT NULL,
    ItemId INT NOT NULL,
    ItemSpecId INT NULL,
    UnitId INT NOT NULL,
    UnitPrice DECIMAL(18,4) NOT NULL,
    UnitCost DECIMAL(18,4) NULL,
    CurrencyCode CHAR(3) NOT NULL DEFAULT 'THB',
    EffectiveFrom DATE NOT NULL DEFAULT (CAST(SYSUTCDATETIME() AS DATE)),
    EffectiveTo DATE NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    MinQuantity DECIMAL(18,4) NULL,
    MaxQuantity DECIMAL(18,4) NULL,
    PricingMethod NVARCHAR(30) NOT NULL DEFAULT 'FIXED_PRICE',
    DiscountPercent DECIMAL(9,4) NULL,
    DiscountAmount DECIMAL(18,4) NULL,
    MarkupPercent DECIMAL(9,4) NULL,
    MarginPercent DECIMAL(9,4) NULL,
    CONSTRAINT UQ_PriceListItems UNIQUE (PriceListId, ItemId, ItemSpecId, UnitId, EffectiveFrom),
    CONSTRAINT FK_PriceListItems_PriceLists FOREIGN KEY (PriceListId) REFERENCES dbo.PriceLists(PriceListId),
    CONSTRAINT FK_PriceListItems_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_PriceListItems_ItemSpecs FOREIGN KEY (ItemSpecId) REFERENCES dbo.ItemSpecs(ItemSpecId),
    CONSTRAINT FK_PriceListItems_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId),
    CONSTRAINT CK_PriceListItems_DateRange CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom),
    CONSTRAINT FK_PriceListItems_PricingMethod FOREIGN KEY (PricingMethod) REFERENCES dbo.PricingMethods(PricingMethodCode)
);

CREATE TABLE dbo.CustomerPriceContracts (
    CustomerPriceContractId INT IDENTITY(1,1) PRIMARY KEY,
    ContractNo NVARCHAR(80) NOT NULL UNIQUE,
    CustomerId INT NOT NULL,
    ContractName NVARCHAR(255) NULL,
    CurrencyCode CHAR(3) NOT NULL DEFAULT 'THB',
    EffectiveFrom DATE NOT NULL,
    EffectiveTo DATE NOT NULL,
    Priority INT NOT NULL DEFAULT 100,
    Status NVARCHAR(30) NOT NULL DEFAULT 'active',
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CanCombine BIT NOT NULL DEFAULT 0,
    StopProcessing BIT NOT NULL DEFAULT 1,
    PricingSequenceId INT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT FK_CustomerPriceContracts_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId),
    CONSTRAINT CK_CustomerPriceContracts_DateRange CHECK (EffectiveTo >= EffectiveFrom),
    CONSTRAINT FK_CustomerPriceContracts_PricingSequences FOREIGN KEY (PricingSequenceId) REFERENCES dbo.PricingSequences(PricingSequenceId)
);

CREATE TABLE dbo.CustomerPriceContractLines (
    CustomerPriceContractLineId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerPriceContractId INT NOT NULL,
    LineNum INT NOT NULL,
    ItemId INT NOT NULL,
    ItemSpecId INT NULL,
    UnitId INT NOT NULL,
    UnitPrice DECIMAL(18,4) NOT NULL,
    UnitCost DECIMAL(18,4) NULL,
    MinQuantity DECIMAL(18,4) NULL,
    MaxQuantity DECIMAL(18,4) NULL,
    PricingMethod NVARCHAR(30) NOT NULL DEFAULT 'FIXED_PRICE',
    DiscountPercent DECIMAL(9,4) NULL,
    DiscountAmount DECIMAL(18,4) NULL,
    MarkupPercent DECIMAL(9,4) NULL,
    MarginPercent DECIMAL(9,4) NULL,
    CONSTRAINT UQ_CustomerPriceContractLines UNIQUE (CustomerPriceContractId, LineNum),
    CONSTRAINT FK_CustomerPriceContractLines_Contracts FOREIGN KEY (CustomerPriceContractId) REFERENCES dbo.CustomerPriceContracts(CustomerPriceContractId),
    CONSTRAINT FK_CustomerPriceContractLines_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_CustomerPriceContractLines_ItemSpecs FOREIGN KEY (ItemSpecId) REFERENCES dbo.ItemSpecs(ItemSpecId),
    CONSTRAINT FK_CustomerPriceContractLines_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId),
    CONSTRAINT CK_CustomerPriceContractLines_QuantityRange CHECK (MaxQuantity IS NULL OR MinQuantity IS NULL OR MaxQuantity >= MinQuantity),
    CONSTRAINT FK_CustomerPriceContractLines_PricingMethods FOREIGN KEY (PricingMethod) REFERENCES dbo.PricingMethods(PricingMethodCode)
);

CREATE TABLE dbo.Warehouses (
    WarehouseId INT IDENTITY(1,1) PRIMARY KEY,
    WarehouseCode NVARCHAR(50) NOT NULL UNIQUE,
    WarehouseName NVARCHAR(255) NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1
);

ALTER TABLE dbo.Items
ADD CONSTRAINT FK_Items_DefaultWarehouses
    FOREIGN KEY (DefaultWarehouseId) REFERENCES dbo.Warehouses(WarehouseId);

CREATE TABLE dbo.WarehouseLocations (
    LocationId INT IDENTITY(1,1) PRIMARY KEY,
    WarehouseId INT NOT NULL,
    LocationCode NVARCHAR(80) NOT NULL,
    LocationName NVARCHAR(255) NULL,
    IsPickable BIT NOT NULL DEFAULT 1,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT UQ_WarehouseLocations UNIQUE (WarehouseId, LocationCode),
    CONSTRAINT FK_WarehouseLocations_Warehouses FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId)
);

CREATE TABLE dbo.Lots (
    LotId BIGINT IDENTITY(1,1) PRIMARY KEY,
    ItemId INT NOT NULL,
    LotNo NVARCHAR(80) NOT NULL,
    ProductionDate DATE NULL,
    ExpiryDate DATE NULL,
    Grade NVARCHAR(50) NULL,
    QualityStatus NVARCHAR(30) NOT NULL DEFAULT 'pending',
    MoisturePercent DECIMAL(9,4) NULL,
    DensityKgM3 DECIMAL(18,4) NULL,
    SourceDocumentType NVARCHAR(40) NULL,
    SourceDocumentId INT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Lots UNIQUE (ItemId, LotNo),
    CONSTRAINT FK_Lots_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT CK_Lots_QualityStatus CHECK (QualityStatus IN ('pending', 'approved', 'rejected', 'hold'))
);

CREATE TABLE dbo.InventoryUnits (
    InventoryUnitId BIGINT IDENTITY(1,1) PRIMARY KEY,
    ItemId INT NOT NULL,
    ItemSpecId INT NULL,
    TrackingNo NVARCHAR(100) NOT NULL UNIQUE,
    LotId BIGINT NULL,
    GradeId INT NULL,
    WarehouseId INT NOT NULL,
    LocationId INT NOT NULL,
    QtySheet DECIMAL(18,4) NOT NULL,
    QtySqm DECIMAL(18,4) NULL,
    PalletNo NVARCHAR(100) NULL,
    InventoryStatus NVARCHAR(30) NOT NULL DEFAULT 'available',
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_InventoryUnits_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_InventoryUnits_ItemSpecs FOREIGN KEY (ItemSpecId) REFERENCES dbo.ItemSpecs(ItemSpecId),
    CONSTRAINT FK_InventoryUnits_Lots FOREIGN KEY (LotId) REFERENCES dbo.Lots(LotId),
    CONSTRAINT FK_InventoryUnits_Warehouses FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId),
    CONSTRAINT FK_InventoryUnits_Locations FOREIGN KEY (LocationId) REFERENCES dbo.WarehouseLocations(LocationId),
    CONSTRAINT FK_InventoryUnits_Grades FOREIGN KEY (GradeId) REFERENCES dbo.Grades(GradeId),
    CONSTRAINT CK_InventoryUnits_Status CHECK (InventoryStatus IN ('available', 'quarantine', 'blocked', 'damaged'))
);

CREATE TABLE dbo.InventoryReservations (
    InventoryReservationId BIGINT IDENTITY(1,1) PRIMARY KEY,
    ReferenceType NVARCHAR(30) NOT NULL,
    ReferenceId INT NULL,
    ReferenceLineId INT NULL,
    ItemId INT NOT NULL,
    ItemSpecId INT NULL,
    LotId BIGINT NULL,
    WarehouseId INT NULL,
    LocationId INT NULL,
    InventoryUnitId BIGINT NULL,
    ReservedQty DECIMAL(18,4) NOT NULL,
    PickedQty DECIMAL(18,4) NOT NULL DEFAULT 0,
    Status NVARCHAR(30) NOT NULL DEFAULT 'open',
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_InventoryReservations_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_InventoryReservations_ItemSpecs FOREIGN KEY (ItemSpecId) REFERENCES dbo.ItemSpecs(ItemSpecId),
    CONSTRAINT FK_InventoryReservations_Lots FOREIGN KEY (LotId) REFERENCES dbo.Lots(LotId),
    CONSTRAINT FK_InventoryReservations_Warehouses FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId),
    CONSTRAINT FK_InventoryReservations_Locations FOREIGN KEY (LocationId) REFERENCES dbo.WarehouseLocations(LocationId),
    CONSTRAINT FK_InventoryReservations_Units FOREIGN KEY (InventoryUnitId) REFERENCES dbo.InventoryUnits(InventoryUnitId),
    CONSTRAINT CK_InventoryReservations_ReferenceType CHECK (ReferenceType IN ('SO', 'GI', 'TRANSFER')),
    CONSTRAINT CK_InventoryReservations_Status CHECK (Status IN ('open', 'allocated', 'picked', 'released', 'cancelled'))
);

CREATE TABLE dbo.QualitySpecs (
    QualitySpecId INT IDENTITY(1,1) PRIMARY KEY,
    QualitySpecCode NVARCHAR(50) NOT NULL UNIQUE,
    QualitySpecName NVARCHAR(255) NOT NULL,
    ProductTypeId INT NULL,
    ItemId INT NULL,
    TestName NVARCHAR(100) NOT NULL,
    TargetValue DECIMAL(18,6) NULL,
    MinValue DECIMAL(18,6) NULL,
    MaxValue DECIMAL(18,6) NULL,
    UnitId INT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT FK_QualitySpecs_ProductTypes FOREIGN KEY (ProductTypeId) REFERENCES dbo.ProductTypes(ProductTypeId),
    CONSTRAINT FK_QualitySpecs_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_QualitySpecs_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId)
);

CREATE TABLE dbo.QualityInspections (
    QualityInspectionId BIGINT IDENTITY(1,1) PRIMARY KEY,
    InspectionNo NVARCHAR(80) NOT NULL UNIQUE,
    ItemId INT NOT NULL,
    LotId BIGINT NULL,
    ReferenceType NVARCHAR(40) NULL,
    ReferenceId INT NULL,
    InspectionDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    Status NVARCHAR(30) NOT NULL DEFAULT 'pending',
    InspectedBy INT NULL,
    ApprovedBy INT NULL,
    ApprovedAt DATETIME2 NULL,
    Notes NVARCHAR(1000) NULL,
    CONSTRAINT FK_QualityInspections_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_QualityInspections_Lots FOREIGN KEY (LotId) REFERENCES dbo.Lots(LotId),
    CONSTRAINT FK_QualityInspections_InspectedBy FOREIGN KEY (InspectedBy) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_QualityInspections_ApprovedBy FOREIGN KEY (ApprovedBy) REFERENCES dbo.Users(UserId),
    CONSTRAINT CK_QualityInspections_Status CHECK (Status IN ('pending', 'passed', 'failed', 'hold'))
);

CREATE TABLE dbo.QualityInspectionResults (
    QualityInspectionResultId BIGINT IDENTITY(1,1) PRIMARY KEY,
    QualityInspectionId BIGINT NOT NULL,
    QualitySpecId INT NULL,
    TestName NVARCHAR(100) NOT NULL,
    ResultValue DECIMAL(18,6) NULL,
    ResultText NVARCHAR(255) NULL,
    UnitId INT NULL,
    IsPassed BIT NULL,
    CONSTRAINT FK_QualityInspectionResults_Inspections FOREIGN KEY (QualityInspectionId) REFERENCES dbo.QualityInspections(QualityInspectionId),
    CONSTRAINT FK_QualityInspectionResults_Specs FOREIGN KEY (QualitySpecId) REFERENCES dbo.QualitySpecs(QualitySpecId),
    CONSTRAINT FK_QualityInspectionResults_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId)
);

CREATE TABLE dbo.ProductionOrders (
    ProductionOrderId INT IDENTITY(1,1) PRIMARY KEY,
    DocumentNo NVARCHAR(50) NOT NULL UNIQUE,
    BranchId INT NULL,
    FinishedGoodItemId INT NOT NULL,
    BomId INT NULL,
    PlannedQuantity DECIMAL(18,4) NOT NULL,
    CompletedQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,
    UnitId INT NOT NULL,
    WarehouseId INT NULL,
    LocationId INT NULL,
    PlannedStartDate DATE NULL,
    PlannedEndDate DATE NULL,
    ActualStartAt DATETIME2 NULL,
    ActualEndAt DATETIME2 NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'draft',
    CreatedBy INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    CONSTRAINT FK_ProductionOrders_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
    CONSTRAINT FK_ProductionOrders_FinishedGoodItems FOREIGN KEY (FinishedGoodItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_ProductionOrders_Boms FOREIGN KEY (BomId) REFERENCES dbo.Boms(BomId),
    CONSTRAINT FK_ProductionOrders_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId),
    CONSTRAINT FK_ProductionOrders_Warehouses FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId),
    CONSTRAINT FK_ProductionOrders_Locations FOREIGN KEY (LocationId) REFERENCES dbo.WarehouseLocations(LocationId),
    CONSTRAINT FK_ProductionOrders_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId)
);

CREATE TABLE dbo.ProductionConsumption (
    ProductionConsumptionId BIGINT IDENTITY(1,1) PRIMARY KEY,
    ProductionOrderId INT NOT NULL,
    LineNum INT NOT NULL,
    ItemId INT NOT NULL,
    LotId BIGINT NULL,
    WarehouseId INT NULL,
    LocationId INT NULL,
    PlannedQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,
    ConsumedQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,
    UnitId INT NOT NULL,
    UnitCostSnapshot DECIMAL(18,4) NULL,
    CONSTRAINT UQ_ProductionConsumption UNIQUE (ProductionOrderId, LineNum),
    CONSTRAINT FK_ProductionConsumption_Orders FOREIGN KEY (ProductionOrderId) REFERENCES dbo.ProductionOrders(ProductionOrderId),
    CONSTRAINT FK_ProductionConsumption_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_ProductionConsumption_Lots FOREIGN KEY (LotId) REFERENCES dbo.Lots(LotId),
    CONSTRAINT FK_ProductionConsumption_Warehouses FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId),
    CONSTRAINT FK_ProductionConsumption_Locations FOREIGN KEY (LocationId) REFERENCES dbo.WarehouseLocations(LocationId),
    CONSTRAINT FK_ProductionConsumption_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId)
);

CREATE TABLE dbo.ProductionOutput (
    ProductionOutputId BIGINT IDENTITY(1,1) PRIMARY KEY,
    ProductionOrderId INT NOT NULL,
    LineNum INT NOT NULL,
    ItemId INT NOT NULL,
    LotId BIGINT NULL,
    WarehouseId INT NULL,
    LocationId INT NULL,
    Quantity DECIMAL(18,4) NOT NULL,
    UnitId INT NOT NULL,
    UnitCostSnapshot DECIMAL(18,4) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_ProductionOutput UNIQUE (ProductionOrderId, LineNum),
    CONSTRAINT FK_ProductionOutput_Orders FOREIGN KEY (ProductionOrderId) REFERENCES dbo.ProductionOrders(ProductionOrderId),
    CONSTRAINT FK_ProductionOutput_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_ProductionOutput_Lots FOREIGN KEY (LotId) REFERENCES dbo.Lots(LotId),
    CONSTRAINT FK_ProductionOutput_Warehouses FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId),
    CONSTRAINT FK_ProductionOutput_Locations FOREIGN KEY (LocationId) REFERENCES dbo.WarehouseLocations(LocationId),
    CONSTRAINT FK_ProductionOutput_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId)
);

CREATE TABLE dbo.PricingSources (
    PricingSourceCode NVARCHAR(40) PRIMARY KEY,
    PricingSourceName NVARCHAR(100) NOT NULL
);

INSERT INTO dbo.PricingSources
VALUES
('CONTRACT', 'Customer Contract'),
('CUSTOMER_PRICE_LIST', 'Customer Price List'),
('ITEM_DEFAULT', 'Item Default'),
('PROMOTION', 'Promotion'),
('MANUAL', 'Manual');

CREATE TABLE dbo.SalesOrders (
    SalesOrderId INT IDENTITY(1,1) PRIMARY KEY,
    DocumentNo NVARCHAR(50) NOT NULL UNIQUE,
    BranchId INT NULL,
    CustomerId INT NOT NULL,
    DocumentDate DATE NOT NULL,
    RequiredDate DATE NULL,
    CustomerPoNo NVARCHAR(100) NULL,
    CustomerPoDate DATE NULL,
    SalesPersonId INT NULL,
    PaymentTermId INT NULL,
    PriceListId INT NULL,
    WarehouseId INT NULL,
    TaxType NVARCHAR(20) NOT NULL DEFAULT 'exclusive',
    Status NVARCHAR(30) NOT NULL DEFAULT 'draft',
    ShippingAddress NVARCHAR(1000) NULL,
    Remarks NVARCHAR(MAX) NULL,
    CurrencyCode CHAR(3) NOT NULL DEFAULT 'THB',
    SubTotalAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    DiscountAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    TaxAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    GrandTotalAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    CreatedBy INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    DiscountRuleId INT NULL,
    PricingRemarks NVARCHAR(1000) NULL,
    CONSTRAINT FK_SalesOrders_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
    CONSTRAINT FK_SalesOrders_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId),
    CONSTRAINT FK_SalesOrders_SalesPersons FOREIGN KEY (SalesPersonId) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_SalesOrders_PaymentTerms FOREIGN KEY (PaymentTermId) REFERENCES dbo.PaymentTerms(PaymentTermId),
    CONSTRAINT FK_SalesOrders_PriceLists FOREIGN KEY (PriceListId) REFERENCES dbo.PriceLists(PriceListId),
    CONSTRAINT FK_SalesOrders_Warehouses FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId),
    CONSTRAINT FK_SalesOrders_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_SalesOrders_DiscountRules FOREIGN KEY (DiscountRuleId) REFERENCES dbo.DiscountRules(DiscountRuleId)
);

CREATE TABLE dbo.SalesOrderLines (
    SalesOrderLineId INT IDENTITY(1,1) PRIMARY KEY,
    SalesOrderId INT NOT NULL,
    LineNum INT NOT NULL,
    ItemId INT NOT NULL,
    ItemSpecId INT NULL,
    Quantity DECIMAL(18,4) NOT NULL,
    UnitPrice DECIMAL(18,4) NOT NULL DEFAULT 0,
    DiscountPercent DECIMAL(9,4) NULL,
    DiscountAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    TaxRatePercent DECIMAL(9,4) NOT NULL DEFAULT 0,
    UnitCostSnapshot DECIMAL(18,4) NULL,
    PricingSource NVARCHAR(40) NULL,
    PricingReferenceId INT NULL,
    MarginPercentSnapshot DECIMAL(9,4) NULL,
    MarkupPercentSnapshot DECIMAL(9,4) NULL,
    LineAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    TaxCodeId INT NULL,
    TaxAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    UnitId INT NOT NULL,
    PricingStatus NVARCHAR(30) NOT NULL DEFAULT 'PENDING',
    ResolvedAt DATETIME2 NULL,
    PricingResolvedBy NVARCHAR(100) NULL,
    Remark NVARCHAR(1000) NULL,
    CONSTRAINT UQ_SalesOrderLines UNIQUE (SalesOrderId, LineNum),
    CONSTRAINT FK_SalesOrderLines_SalesOrders FOREIGN KEY (SalesOrderId) REFERENCES dbo.SalesOrders(SalesOrderId),
    CONSTRAINT FK_SalesOrderLines_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_SalesOrderLines_ItemSpecs FOREIGN KEY (ItemSpecId) REFERENCES dbo.ItemSpecs(ItemSpecId),
    CONSTRAINT FK_SalesOrderLines_TaxCodes FOREIGN KEY (TaxCodeId) REFERENCES dbo.TaxCodes(TaxCodeId),
    CONSTRAINT FK_SalesOrderLines_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId),
    CONSTRAINT FK_SalesOrderLines_PricingSources FOREIGN KEY (PricingSource) REFERENCES dbo.PricingSources(PricingSourceCode),
    CONSTRAINT CK_SalesOrderLines_PricingStatus CHECK (PricingStatus IN ('PENDING', 'RESOLVED', 'MANUAL_OVERRIDE', 'ERROR'))
);

CREATE TABLE dbo.PurchaseOrders (
    PurchaseOrderId INT IDENTITY(1,1) PRIMARY KEY,
    DocumentNo NVARCHAR(50) NOT NULL UNIQUE,
    BranchId INT NULL,
    VendorId INT NOT NULL,
    DocumentDate DATE NOT NULL,
    ExpectedDate DATE NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'draft',
    CurrencyCode CHAR(3) NOT NULL DEFAULT 'THB',
    SubTotalAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    DiscountAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    TaxAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    GrandTotalAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    CreatedBy INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PurchaseOrders_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
    CONSTRAINT FK_PurchaseOrders_Vendors FOREIGN KEY (VendorId) REFERENCES dbo.Vendors(VendorId),
    CONSTRAINT FK_PurchaseOrders_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId)
);

CREATE TABLE dbo.PurchaseOrderLines (
    PurchaseOrderLineId INT IDENTITY(1,1) PRIMARY KEY,
    PurchaseOrderId INT NOT NULL,
    LineNum INT NOT NULL,
    ItemId INT NOT NULL,
    Quantity DECIMAL(18,4) NOT NULL,
    UnitPrice DECIMAL(18,4) NOT NULL DEFAULT 0,
    UnitId INT NOT NULL,
    CONSTRAINT UQ_PurchaseOrderLines UNIQUE (PurchaseOrderId, LineNum),
    CONSTRAINT FK_PurchaseOrderLines_PurchaseOrders FOREIGN KEY (PurchaseOrderId) REFERENCES dbo.PurchaseOrders(PurchaseOrderId),
    CONSTRAINT FK_PurchaseOrderLines_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_PurchaseOrderLines_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId)
);

CREATE TABLE dbo.DeliveryOrders (
    DeliveryOrderId INT IDENTITY(1,1) PRIMARY KEY,
    DocumentNo NVARCHAR(50) NOT NULL UNIQUE,
    BranchId INT NULL,
    SalesOrderId INT NULL,
    CustomerId INT NOT NULL,
    DocumentDate DATE NOT NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'draft',
    ShipToAddress NVARCHAR(1000) NULL,
    CreatedBy INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_DeliveryOrders_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
    CONSTRAINT FK_DeliveryOrders_SalesOrders FOREIGN KEY (SalesOrderId) REFERENCES dbo.SalesOrders(SalesOrderId),
    CONSTRAINT FK_DeliveryOrders_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId),
    CONSTRAINT FK_DeliveryOrders_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId)
);

CREATE TABLE dbo.DeliveryOrderLines (
    DeliveryOrderLineId INT IDENTITY(1,1) PRIMARY KEY,
    DeliveryOrderId INT NOT NULL,
    LineNum INT NOT NULL,
    ItemId INT NOT NULL,
    Quantity DECIMAL(18,4) NOT NULL,
    UnitId INT NOT NULL,
    CONSTRAINT UQ_DeliveryOrderLines UNIQUE (DeliveryOrderId, LineNum),
    CONSTRAINT FK_DeliveryOrderLines_DeliveryOrders FOREIGN KEY (DeliveryOrderId) REFERENCES dbo.DeliveryOrders(DeliveryOrderId),
    CONSTRAINT FK_DeliveryOrderLines_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_DeliveryOrderLines_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId)
);

CREATE TABLE dbo.Quotations (
    QuotationId INT IDENTITY(1,1) PRIMARY KEY,
    DocumentNo NVARCHAR(50) NOT NULL UNIQUE,
    BranchId INT NULL,
    CustomerId INT NOT NULL,
    DocumentDate DATE NOT NULL,
    ValidUntil DATE NULL,
    CustomerPoNo NVARCHAR(100) NULL,
    CustomerPoDate DATE NULL,
    SalesPersonId INT NULL,
    PaymentTermId INT NULL,
    PriceListId INT NULL,
    WarehouseId INT NULL,
    TaxType NVARCHAR(20) NOT NULL DEFAULT 'exclusive',
    Status NVARCHAR(30) NOT NULL DEFAULT 'draft',
    Remarks NVARCHAR(MAX) NULL,
    BillingAddress NVARCHAR(1000) NULL,
    CurrencyCode CHAR(3) NOT NULL DEFAULT 'THB',
    SubTotalAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    DiscountAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    TaxAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    GrandTotalAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    CreatedBy INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    CONSTRAINT FK_Quotations_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
    CONSTRAINT FK_Quotations_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId),
    CONSTRAINT FK_Quotations_SalesPersons FOREIGN KEY (SalesPersonId) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_Quotations_PaymentTerms FOREIGN KEY (PaymentTermId) REFERENCES dbo.PaymentTerms(PaymentTermId),
    CONSTRAINT FK_Quotations_PriceLists FOREIGN KEY (PriceListId) REFERENCES dbo.PriceLists(PriceListId),
    CONSTRAINT FK_Quotations_Warehouses FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId),
    CONSTRAINT FK_Quotations_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId)
);

CREATE TABLE dbo.QuotationLines (
    QuotationLineId INT IDENTITY(1,1) PRIMARY KEY,
    QuotationId INT NOT NULL,
    LineNum INT NOT NULL,
    ItemId INT NOT NULL,
    Quantity DECIMAL(18,4) NOT NULL,
    UnitPrice DECIMAL(18,4) NOT NULL DEFAULT 0,
    DiscountPercent DECIMAL(9,4) NULL,
    DiscountAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    TaxRatePercent DECIMAL(9,4) NOT NULL DEFAULT 0,
    UnitCostSnapshot DECIMAL(18,4) NULL,
    PricingSource NVARCHAR(40) NULL,
    PricingReferenceId INT NULL,
    MarginPercentSnapshot DECIMAL(9,4) NULL,
    MarkupPercentSnapshot DECIMAL(9,4) NULL,
    LineAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    TaxCodeId INT NULL,
    TaxAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    UnitId INT NOT NULL,
    ItemSpecId INT NULL,
    CONSTRAINT UQ_QuotationLines UNIQUE (QuotationId, LineNum),
    CONSTRAINT FK_QuotationLines_Quotations FOREIGN KEY (QuotationId) REFERENCES dbo.Quotations(QuotationId),
    CONSTRAINT FK_QuotationLines_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_QuotationLines_ItemSpecs FOREIGN KEY (ItemSpecId) REFERENCES dbo.ItemSpecs(ItemSpecId),
    CONSTRAINT FK_QuotationLines_TaxCodes FOREIGN KEY (TaxCodeId) REFERENCES dbo.TaxCodes(TaxCodeId),
    CONSTRAINT FK_QuotationLines_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId),
    CONSTRAINT FK_QuotationLines_PricingSources FOREIGN KEY (PricingSource) REFERENCES dbo.PricingSources(PricingSourceCode)
);

CREATE TABLE dbo.SalesInvoices (
    SalesInvoiceId INT IDENTITY(1,1) PRIMARY KEY,
    DocumentNo NVARCHAR(50) NOT NULL UNIQUE,
    BranchId INT NULL,
    CustomerId INT NOT NULL,
    SalesOrderId INT NULL,
    DeliveryOrderId INT NULL,
    DocumentDate DATE NOT NULL,
    DueDate DATE NULL,
    CustomerPoNo NVARCHAR(100) NULL,
    CustomerPoDate DATE NULL,
    SalesPersonId INT NULL,
    PaymentTermId INT NULL,
    PriceListId INT NULL,
    WarehouseId INT NULL,
    TaxType NVARCHAR(20) NOT NULL DEFAULT 'exclusive',
    Status NVARCHAR(30) NOT NULL DEFAULT 'draft',
    Remarks NVARCHAR(MAX) NULL,
    CurrencyCode CHAR(3) NOT NULL DEFAULT 'THB',
    SubTotalAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    DiscountAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    TaxAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    GrandTotalAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    PaidAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    CreatedBy INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_SalesInvoices_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
    CONSTRAINT FK_SalesInvoices_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId),
    CONSTRAINT FK_SalesInvoices_SalesOrders FOREIGN KEY (SalesOrderId) REFERENCES dbo.SalesOrders(SalesOrderId),
    CONSTRAINT FK_SalesInvoices_DeliveryOrders FOREIGN KEY (DeliveryOrderId) REFERENCES dbo.DeliveryOrders(DeliveryOrderId),
    CONSTRAINT FK_SalesInvoices_SalesPersons FOREIGN KEY (SalesPersonId) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_SalesInvoices_PaymentTerms FOREIGN KEY (PaymentTermId) REFERENCES dbo.PaymentTerms(PaymentTermId),
    CONSTRAINT FK_SalesInvoices_PriceLists FOREIGN KEY (PriceListId) REFERENCES dbo.PriceLists(PriceListId),
    CONSTRAINT FK_SalesInvoices_Warehouses FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId),
    CONSTRAINT FK_SalesInvoices_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId)
);

CREATE TABLE dbo.SalesInvoiceLines (
    SalesInvoiceLineId INT IDENTITY(1,1) PRIMARY KEY,
    SalesInvoiceId INT NOT NULL,
    LineNum INT NOT NULL,
    ItemId INT NOT NULL,
    Quantity DECIMAL(18,4) NOT NULL,
    UnitId INT NOT NULL,
    UnitPrice DECIMAL(18,4) NOT NULL DEFAULT 0,
    DiscountAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    TaxRatePercent DECIMAL(9,4) NOT NULL DEFAULT 0,
    LineAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    TaxCodeId INT NULL,
    TaxAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    ItemSpecId INT NULL,
    CONSTRAINT UQ_SalesInvoiceLines UNIQUE (SalesInvoiceId, LineNum),
    CONSTRAINT FK_SalesInvoiceLines_Invoices FOREIGN KEY (SalesInvoiceId) REFERENCES dbo.SalesInvoices(SalesInvoiceId),
    CONSTRAINT FK_SalesInvoiceLines_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_SalesInvoiceLines_ItemSpecs FOREIGN KEY (ItemSpecId) REFERENCES dbo.ItemSpecs(ItemSpecId),
    CONSTRAINT FK_SalesInvoiceLines_TaxCodes FOREIGN KEY (TaxCodeId) REFERENCES dbo.TaxCodes(TaxCodeId),
    CONSTRAINT FK_SalesInvoiceLines_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId)
);

CREATE TABLE dbo.CustomerPayments (
    CustomerPaymentId INT IDENTITY(1,1) PRIMARY KEY,
    PaymentNo NVARCHAR(50) NOT NULL UNIQUE,
    BranchId INT NULL,
    CustomerId INT NOT NULL,
    PaymentDate DATE NOT NULL,
    PaymentMethod NVARCHAR(40) NOT NULL,
    CurrencyCode CHAR(3) NOT NULL DEFAULT 'THB',
    Amount DECIMAL(18,4) NOT NULL,
    ReferenceNo NVARCHAR(100) NULL,
    Notes NVARCHAR(1000) NULL,
    CreatedBy INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_CustomerPayments_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
    CONSTRAINT FK_CustomerPayments_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId),
    CONSTRAINT FK_CustomerPayments_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId)
);

CREATE TABLE dbo.CustomerPaymentAllocations (
    CustomerPaymentAllocationId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerPaymentId INT NOT NULL,
    SalesInvoiceId INT NOT NULL,
    AmountApplied DECIMAL(18,4) NOT NULL,
    CONSTRAINT UQ_CustomerPaymentAllocations UNIQUE (CustomerPaymentId, SalesInvoiceId),
    CONSTRAINT FK_CustomerPaymentAllocations_Payments FOREIGN KEY (CustomerPaymentId) REFERENCES dbo.CustomerPayments(CustomerPaymentId),
    CONSTRAINT FK_CustomerPaymentAllocations_Invoices FOREIGN KEY (SalesInvoiceId) REFERENCES dbo.SalesInvoices(SalesInvoiceId)
);

CREATE TABLE dbo.PurchaseInvoices (
    PurchaseInvoiceId INT IDENTITY(1,1) PRIMARY KEY,
    DocumentNo NVARCHAR(50) NOT NULL UNIQUE,
    BranchId INT NULL,
    VendorId INT NOT NULL,
    PurchaseOrderId INT NULL,
    VendorInvoiceNo NVARCHAR(100) NULL,
    DocumentDate DATE NOT NULL,
    DueDate DATE NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'draft',
    CurrencyCode CHAR(3) NOT NULL DEFAULT 'THB',
    SubTotalAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    DiscountAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    TaxAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    GrandTotalAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    PaidAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    CreatedBy INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PurchaseInvoices_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
    CONSTRAINT FK_PurchaseInvoices_Vendors FOREIGN KEY (VendorId) REFERENCES dbo.Vendors(VendorId),
    CONSTRAINT FK_PurchaseInvoices_PurchaseOrders FOREIGN KEY (PurchaseOrderId) REFERENCES dbo.PurchaseOrders(PurchaseOrderId),
    CONSTRAINT FK_PurchaseInvoices_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId)
);

CREATE TABLE dbo.PurchaseInvoiceLines (
    PurchaseInvoiceLineId INT IDENTITY(1,1) PRIMARY KEY,
    PurchaseInvoiceId INT NOT NULL,
    LineNum INT NOT NULL,
    ItemId INT NOT NULL,
    Quantity DECIMAL(18,4) NOT NULL,
    UnitId INT NOT NULL,
    UnitPrice DECIMAL(18,4) NOT NULL DEFAULT 0,
    DiscountAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    TaxRatePercent DECIMAL(9,4) NOT NULL DEFAULT 0,
    LineAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    TaxAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    CONSTRAINT UQ_PurchaseInvoiceLines UNIQUE (PurchaseInvoiceId, LineNum),
    CONSTRAINT FK_PurchaseInvoiceLines_Invoices FOREIGN KEY (PurchaseInvoiceId) REFERENCES dbo.PurchaseInvoices(PurchaseInvoiceId),
    CONSTRAINT FK_PurchaseInvoiceLines_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_PurchaseInvoiceLines_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId)
);

CREATE TABLE dbo.VendorPayments (
    VendorPaymentId INT IDENTITY(1,1) PRIMARY KEY,
    PaymentNo NVARCHAR(50) NOT NULL UNIQUE,
    BranchId INT NULL,
    VendorId INT NOT NULL,
    PaymentDate DATE NOT NULL,
    PaymentMethod NVARCHAR(40) NOT NULL,
    CurrencyCode CHAR(3) NOT NULL DEFAULT 'THB',
    Amount DECIMAL(18,4) NOT NULL,
    ReferenceNo NVARCHAR(100) NULL,
    Notes NVARCHAR(1000) NULL,
    CreatedBy INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_VendorPayments_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
    CONSTRAINT FK_VendorPayments_Vendors FOREIGN KEY (VendorId) REFERENCES dbo.Vendors(VendorId),
    CONSTRAINT FK_VendorPayments_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId)
);

CREATE TABLE dbo.VendorPaymentAllocations (
    VendorPaymentAllocationId INT IDENTITY(1,1) PRIMARY KEY,
    VendorPaymentId INT NOT NULL,
    PurchaseInvoiceId INT NOT NULL,
    AmountApplied DECIMAL(18,4) NOT NULL,
    CONSTRAINT UQ_VendorPaymentAllocations UNIQUE (VendorPaymentId, PurchaseInvoiceId),
    CONSTRAINT FK_VendorPaymentAllocations_Payments FOREIGN KEY (VendorPaymentId) REFERENCES dbo.VendorPayments(VendorPaymentId),
    CONSTRAINT FK_VendorPaymentAllocations_Invoices FOREIGN KEY (PurchaseInvoiceId) REFERENCES dbo.PurchaseInvoices(PurchaseInvoiceId)
);

CREATE TABLE dbo.StockMovementTypes (
    MovementTypeCode NVARCHAR(40) NOT NULL PRIMARY KEY,
    MovementTypeName NVARCHAR(100) NOT NULL,
    Direction NVARCHAR(20) NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT CK_StockMovementTypes_Direction CHECK (Direction IN ('in', 'out', 'transfer', 'adjustment'))
);

CREATE TABLE dbo.GoodsIssueTypes (
    GoodsIssueTypeId INT IDENTITY(1,1) PRIMARY KEY,
    GoodsIssueTypeCode NVARCHAR(40) NOT NULL UNIQUE,
    GoodsIssueTypeName NVARCHAR(100) NOT NULL,
    MovementTypeCode NVARCHAR(40) NOT NULL DEFAULT 'goods_issue',
    RequiresCustomer BIT NOT NULL DEFAULT 0,
    RequiresApproval BIT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT FK_GoodsIssueTypes_StockMovementTypes FOREIGN KEY (MovementTypeCode) REFERENCES dbo.StockMovementTypes(MovementTypeCode)
);

CREATE TABLE dbo.GoodsReceiptTypes (
    GoodsReceiptTypeId INT IDENTITY(1,1) PRIMARY KEY,
    GoodsReceiptTypeCode NVARCHAR(40) NOT NULL UNIQUE,
    GoodsReceiptTypeName NVARCHAR(100) NOT NULL,
    MovementTypeCode NVARCHAR(40) NOT NULL DEFAULT 'goods_receipt',
    RequiresVendor BIT NOT NULL DEFAULT 0,
    RequiresProductionOrder BIT NOT NULL DEFAULT 0,
    RequiresApproval BIT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT FK_GoodsReceiptTypes_StockMovementTypes FOREIGN KEY (MovementTypeCode) REFERENCES dbo.StockMovementTypes(MovementTypeCode)
);

CREATE TABLE dbo.GoodsIssues (
    GoodsIssueId INT IDENTITY(1,1) PRIMARY KEY,
    DocumentNo NVARCHAR(50) NOT NULL UNIQUE,
    BranchId INT NULL,
    GoodsIssueTypeId INT NOT NULL,
    CustomerId INT NULL,
    WarehouseId INT NOT NULL,
    RequestDate DATE NOT NULL,
    IssueDate DATE NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'draft',
    LimitSheetTotal DECIMAL(18,4) NOT NULL DEFAULT 0,
    RequestedSheetTotal DECIMAL(18,4) NOT NULL DEFAULT 0,
    IssuedSheetTotal DECIMAL(18,4) NOT NULL DEFAULT 0,
    PalletCountTotal DECIMAL(18,4) NOT NULL DEFAULT 0,
    M3Total DECIMAL(18,6) NOT NULL DEFAULT 0,
    Remark NVARCHAR(1000) NULL,
    PostedAt DATETIME2 NULL,
    PostedBy INT NULL,
    CreatedBy INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    CONSTRAINT FK_GoodsIssues_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
    CONSTRAINT FK_GoodsIssues_Types FOREIGN KEY (GoodsIssueTypeId) REFERENCES dbo.GoodsIssueTypes(GoodsIssueTypeId),
    CONSTRAINT FK_GoodsIssues_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId),
    CONSTRAINT FK_GoodsIssues_Warehouses FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId),
    CONSTRAINT FK_GoodsIssues_PostedBy FOREIGN KEY (PostedBy) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_GoodsIssues_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId),
    CONSTRAINT CK_GoodsIssues_Status CHECK (Status IN ('draft', 'requested', 'approved', 'issued', 'cancelled'))
);

CREATE TABLE dbo.GoodsIssueLines (
    GoodsIssueLineId INT IDENTITY(1,1) PRIMARY KEY,
    GoodsIssueId INT NOT NULL,
    LineNum INT NOT NULL,
    ItemId INT NOT NULL,
    ItemSpecId INT NULL,
    LotId BIGINT NULL,
    WarehouseId INT NULL,
    LocationId INT NULL,
    UnitId INT NOT NULL,
    RequestedQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,
    IssuedQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,
    RequestedSheetQty DECIMAL(18,4) NULL,
    IssuedSheetQty DECIMAL(18,4) NULL,
    LimitSheetQty DECIMAL(18,4) NULL,
    PalletCount DECIMAL(18,4) NULL,
    M3Quantity DECIMAL(18,6) NULL,
    ProductTypeId INT NULL,
    ThicknessId INT NULL,
    WidthId INT NULL,
    LengthId INT NULL,
    Remark NVARCHAR(1000) NULL,
    CONSTRAINT UQ_GoodsIssueLines UNIQUE (GoodsIssueId, LineNum),
    CONSTRAINT FK_GoodsIssueLines_GoodsIssues FOREIGN KEY (GoodsIssueId) REFERENCES dbo.GoodsIssues(GoodsIssueId),
    CONSTRAINT FK_GoodsIssueLines_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_GoodsIssueLines_ItemSpecs FOREIGN KEY (ItemSpecId) REFERENCES dbo.ItemSpecs(ItemSpecId),
    CONSTRAINT FK_GoodsIssueLines_Lots FOREIGN KEY (LotId) REFERENCES dbo.Lots(LotId),
    CONSTRAINT FK_GoodsIssueLines_Warehouses FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId),
    CONSTRAINT FK_GoodsIssueLines_Locations FOREIGN KEY (LocationId) REFERENCES dbo.WarehouseLocations(LocationId),
    CONSTRAINT FK_GoodsIssueLines_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId),
    CONSTRAINT FK_GoodsIssueLines_ProductTypes FOREIGN KEY (ProductTypeId) REFERENCES dbo.ProductTypes(ProductTypeId),
    CONSTRAINT FK_GoodsIssueLines_Thicknesses FOREIGN KEY (ThicknessId) REFERENCES dbo.ItemThicknesses(ThicknessId),
    CONSTRAINT FK_GoodsIssueLines_Widths FOREIGN KEY (WidthId) REFERENCES dbo.ItemWidths(WidthId),
    CONSTRAINT FK_GoodsIssueLines_Lengths FOREIGN KEY (LengthId) REFERENCES dbo.ItemLengths(LengthId)
);

CREATE TABLE dbo.GoodsReceipts (
    GoodsReceiptId INT IDENTITY(1,1) PRIMARY KEY,
    DocumentNo NVARCHAR(50) NOT NULL UNIQUE,
    BranchId INT NULL,
    GoodsReceiptTypeId INT NOT NULL,
    VendorId INT NULL,
    CustomerId INT NULL,
    PurchaseOrderId INT NULL,
    ProductionOrderId INT NULL,
    WarehouseId INT NOT NULL,
    ReceiptDate DATE NOT NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'draft',
    ReceivedSheetTotal DECIMAL(18,4) NOT NULL DEFAULT 0,
    PalletCountTotal DECIMAL(18,4) NOT NULL DEFAULT 0,
    M3Total DECIMAL(18,6) NOT NULL DEFAULT 0,
    Remark NVARCHAR(1000) NULL,
    PostedAt DATETIME2 NULL,
    PostedBy INT NULL,
    CreatedBy INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    CONSTRAINT FK_GoodsReceipts_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
    CONSTRAINT FK_GoodsReceipts_Types FOREIGN KEY (GoodsReceiptTypeId) REFERENCES dbo.GoodsReceiptTypes(GoodsReceiptTypeId),
    CONSTRAINT FK_GoodsReceipts_Vendors FOREIGN KEY (VendorId) REFERENCES dbo.Vendors(VendorId),
    CONSTRAINT FK_GoodsReceipts_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId),
    CONSTRAINT FK_GoodsReceipts_PurchaseOrders FOREIGN KEY (PurchaseOrderId) REFERENCES dbo.PurchaseOrders(PurchaseOrderId),
    CONSTRAINT FK_GoodsReceipts_ProductionOrders FOREIGN KEY (ProductionOrderId) REFERENCES dbo.ProductionOrders(ProductionOrderId),
    CONSTRAINT FK_GoodsReceipts_Warehouses FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId),
    CONSTRAINT FK_GoodsReceipts_PostedBy FOREIGN KEY (PostedBy) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_GoodsReceipts_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId),
    CONSTRAINT CK_GoodsReceipts_Status CHECK (Status IN ('draft', 'received', 'posted', 'cancelled'))
);

CREATE TABLE dbo.GoodsReceiptLines (
    GoodsReceiptLineId INT IDENTITY(1,1) PRIMARY KEY,
    GoodsReceiptId INT NOT NULL,
    LineNum INT NOT NULL,
    ItemId INT NOT NULL,
    ItemSpecId INT NULL,
    LotId BIGINT NULL,
    LotNo NVARCHAR(80) NULL,
    WarehouseId INT NULL,
    LocationId INT NULL,
    UnitId INT NOT NULL,
    ReceivedQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,
    ReceivedSheetQty DECIMAL(18,4) NULL,
    PalletCount DECIMAL(18,4) NULL,
    M3Quantity DECIMAL(18,6) NULL,
    ProductTypeId INT NULL,
    ThicknessId INT NULL,
    WidthId INT NULL,
    LengthId INT NULL,
    UnitCostSnapshot DECIMAL(18,4) NULL,
    Remark NVARCHAR(1000) NULL,
    CONSTRAINT UQ_GoodsReceiptLines UNIQUE (GoodsReceiptId, LineNum),
    CONSTRAINT FK_GoodsReceiptLines_GoodsReceipts FOREIGN KEY (GoodsReceiptId) REFERENCES dbo.GoodsReceipts(GoodsReceiptId),
    CONSTRAINT FK_GoodsReceiptLines_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_GoodsReceiptLines_ItemSpecs FOREIGN KEY (ItemSpecId) REFERENCES dbo.ItemSpecs(ItemSpecId),
    CONSTRAINT FK_GoodsReceiptLines_Lots FOREIGN KEY (LotId) REFERENCES dbo.Lots(LotId),
    CONSTRAINT FK_GoodsReceiptLines_Warehouses FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId),
    CONSTRAINT FK_GoodsReceiptLines_Locations FOREIGN KEY (LocationId) REFERENCES dbo.WarehouseLocations(LocationId),
    CONSTRAINT FK_GoodsReceiptLines_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId),
    CONSTRAINT FK_GoodsReceiptLines_ProductTypes FOREIGN KEY (ProductTypeId) REFERENCES dbo.ProductTypes(ProductTypeId),
    CONSTRAINT FK_GoodsReceiptLines_Thicknesses FOREIGN KEY (ThicknessId) REFERENCES dbo.ItemThicknesses(ThicknessId),
    CONSTRAINT FK_GoodsReceiptLines_Widths FOREIGN KEY (WidthId) REFERENCES dbo.ItemWidths(WidthId),
    CONSTRAINT FK_GoodsReceiptLines_Lengths FOREIGN KEY (LengthId) REFERENCES dbo.ItemLengths(LengthId)
);

CREATE TABLE dbo.StockOnHand (
    StockOnHandId INT IDENTITY(1,1) PRIMARY KEY,
    ItemId INT NOT NULL,
    ItemSpecId INT NULL,
    WarehouseId INT NOT NULL,
    LocationId INT NULL,
    LotId BIGINT NULL,
    LotNo NVARCHAR(80) NULL,
    GradeId INT NULL,
    QuantityOnHand DECIMAL(18,4) NOT NULL DEFAULT 0,
    QuantityReserved DECIMAL(18,4) NOT NULL DEFAULT 0,
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_StockOnHand UNIQUE (ItemId, ItemSpecId, WarehouseId, LocationId, LotId, LotNo, GradeId),
    CONSTRAINT FK_StockOnHand_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_StockOnHand_ItemSpecs FOREIGN KEY (ItemSpecId) REFERENCES dbo.ItemSpecs(ItemSpecId),
    CONSTRAINT FK_StockOnHand_Warehouses FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId),
    CONSTRAINT FK_StockOnHand_Locations FOREIGN KEY (LocationId) REFERENCES dbo.WarehouseLocations(LocationId),
    CONSTRAINT FK_StockOnHand_Lots FOREIGN KEY (LotId) REFERENCES dbo.Lots(LotId),
    CONSTRAINT FK_StockOnHand_Grades FOREIGN KEY (GradeId) REFERENCES dbo.Grades(GradeId)
);

CREATE TABLE dbo.StockMovements (
    StockMovementId BIGINT IDENTITY(1,1) PRIMARY KEY,
    MovementType NVARCHAR(40) NOT NULL,
    ReferenceType NVARCHAR(40) NULL,
    ReferenceId INT NULL,
    ItemId INT NOT NULL,
    FromWarehouseId INT NULL,
    FromLocationId INT NULL,
    ToWarehouseId INT NULL,
    ToLocationId INT NULL,
    LotId BIGINT NULL,
    LotNo NVARCHAR(80) NULL,
    Quantity DECIMAL(18,4) NOT NULL,
    UnitId INT NULL,
    UnitCost DECIMAL(18,4) NULL,
    TotalCost DECIMAL(18,4) NULL,
    CreatedBy INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_StockMovements_MovementTypes FOREIGN KEY (MovementType) REFERENCES dbo.StockMovementTypes(MovementTypeCode),
    CONSTRAINT FK_StockMovements_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_StockMovements_FromWarehouses FOREIGN KEY (FromWarehouseId) REFERENCES dbo.Warehouses(WarehouseId),
    CONSTRAINT FK_StockMovements_FromLocations FOREIGN KEY (FromLocationId) REFERENCES dbo.WarehouseLocations(LocationId),
    CONSTRAINT FK_StockMovements_ToWarehouses FOREIGN KEY (ToWarehouseId) REFERENCES dbo.Warehouses(WarehouseId),
    CONSTRAINT FK_StockMovements_ToLocations FOREIGN KEY (ToLocationId) REFERENCES dbo.WarehouseLocations(LocationId),
    CONSTRAINT FK_StockMovements_Lots FOREIGN KEY (LotId) REFERENCES dbo.Lots(LotId),
    CONSTRAINT FK_StockMovements_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId),
    CONSTRAINT FK_StockMovements_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId)
);

CREATE TABLE dbo.InventoryCostLayers (
    InventoryCostLayerId BIGINT IDENTITY(1,1) PRIMARY KEY,
    ItemId INT NOT NULL,
    LotId BIGINT NULL,
    WarehouseId INT NULL,
    SourceMovementId BIGINT NULL,
    QuantityOriginal DECIMAL(18,4) NOT NULL,
    QuantityRemaining DECIMAL(18,4) NOT NULL,
    UnitCost DECIMAL(18,4) NOT NULL,
    CurrencyCode CHAR(3) NOT NULL DEFAULT 'THB',
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_InventoryCostLayers_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_InventoryCostLayers_Lots FOREIGN KEY (LotId) REFERENCES dbo.Lots(LotId),
    CONSTRAINT FK_InventoryCostLayers_Warehouses FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId),
    CONSTRAINT FK_InventoryCostLayers_StockMovements FOREIGN KEY (SourceMovementId) REFERENCES dbo.StockMovements(StockMovementId)
);

CREATE TABLE dbo.InventoryValuationMovements (
    InventoryValuationMovementId BIGINT IDENTITY(1,1) PRIMARY KEY,
    StockMovementId BIGINT NOT NULL,
    ItemId INT NOT NULL,
    LotId BIGINT NULL,
    Quantity DECIMAL(18,4) NOT NULL,
    UnitCost DECIMAL(18,4) NOT NULL,
    TotalCost DECIMAL(18,4) NOT NULL,
    ValuationMethod NVARCHAR(30) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_InventoryValuationMovements_StockMovements FOREIGN KEY (StockMovementId) REFERENCES dbo.StockMovements(StockMovementId),
    CONSTRAINT FK_InventoryValuationMovements_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_InventoryValuationMovements_Lots FOREIGN KEY (LotId) REFERENCES dbo.Lots(LotId),
    CONSTRAINT CK_InventoryValuationMovements_Method CHECK (ValuationMethod IN ('average', 'fifo', 'standard', 'manual'))
);

CREATE TABLE dbo.WmsTaskTypes (
    TaskTypeCode NVARCHAR(40) NOT NULL PRIMARY KEY,
    TaskTypeName NVARCHAR(100) NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1
);
CREATE TABLE dbo.WmsWaves (
    WmsWaveId INT IDENTITY(1,1) PRIMARY KEY,
    WaveNo NVARCHAR(50) NOT NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'open',
    CreatedBy INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ActionBy INT NULL,
    ActionAt DATETIME2 NULL,
    CompletedAt DATETIME2 NULL,
    CONSTRAINT FK_WmsWaves_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_WmsWaves_ActionBy FOREIGN KEY (ActionBy) REFERENCES dbo.Users(UserId)
);

CREATE TABLE dbo.WmsTasks (
    WmsTaskId BIGINT IDENTITY(1,1) PRIMARY KEY,
    TaskType NVARCHAR(40) NOT NULL,
    ReferenceType NVARCHAR(40) NULL,
    ReferenceId INT NULL,
    WarehouseId INT NOT NULL,
    AssignedTo INT NULL,
    ActionBy INT NULL,
    ActionAt DATETIME2 NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'open',
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CompletedAt DATETIME2 NULL,
    CompletedBy INT NULL,
    WaveId INT NULL,
    CONSTRAINT FK_WmsTasks_TaskTypes FOREIGN KEY (TaskType) REFERENCES dbo.WmsTaskTypes(TaskTypeCode),
    CONSTRAINT FK_WmsTasks_Warehouses FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId),
    CONSTRAINT FK_WmsTasks_Users FOREIGN KEY (AssignedTo) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_WmsTasks_ActionBy FOREIGN KEY (ActionBy) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_WmsTasks_CompletedBy FOREIGN KEY (CompletedBy) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_WmsTasks_WmsWaves FOREIGN KEY (WaveId) REFERENCES dbo.WmsWaves(WmsWaveId)
);

CREATE TABLE dbo.WmsTaskLines (
    WmsTaskLineId BIGINT IDENTITY(1,1) PRIMARY KEY,
    WmsTaskId BIGINT NOT NULL,
    ItemId INT NOT NULL,
    ItemSpecId INT NULL,
    UnitId INT NOT NULL,
    LotId BIGINT NULL,
    InventoryReservationId BIGINT NULL,
    InventoryUnitId BIGINT NULL,
    FromLocationId INT NULL,
    ToLocationId INT NULL,
    QuantityRequired DECIMAL(18,4) NOT NULL,
    QuantityCompleted DECIMAL(18,4) NOT NULL DEFAULT 0,
    RequestedQuantity DECIMAL(18,4) NULL,
    RequestedUnitId INT NULL,
    UnitConversionFactor DECIMAL(18,8) NULL,
    Remark NVARCHAR(1000) NULL,
    PalletNo NVARCHAR(100) NULL,
    CONSTRAINT FK_WmsTaskLines_WmsTasks FOREIGN KEY (WmsTaskId) REFERENCES dbo.WmsTasks(WmsTaskId),
    CONSTRAINT FK_WmsTaskLines_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_WmsTaskLines_ItemSpecs FOREIGN KEY (ItemSpecId) REFERENCES dbo.ItemSpecs(ItemSpecId),
    CONSTRAINT FK_WmsTaskLines_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId),
    CONSTRAINT FK_WmsTaskLines_RequestedUnits FOREIGN KEY (RequestedUnitId) REFERENCES dbo.Units(UnitId),
    CONSTRAINT FK_WmsTaskLines_Lots FOREIGN KEY (LotId) REFERENCES dbo.Lots(LotId),
    CONSTRAINT FK_WmsTaskLines_Reservations FOREIGN KEY (InventoryReservationId) REFERENCES dbo.InventoryReservations(InventoryReservationId),
    CONSTRAINT FK_WmsTaskLines_InventoryUnits FOREIGN KEY (InventoryUnitId) REFERENCES dbo.InventoryUnits(InventoryUnitId),
    CONSTRAINT FK_WmsTaskLines_FromLocations FOREIGN KEY (FromLocationId) REFERENCES dbo.WarehouseLocations(LocationId),
    CONSTRAINT FK_WmsTaskLines_ToLocations FOREIGN KEY (ToLocationId) REFERENCES dbo.WarehouseLocations(LocationId)
);

-- Helpful indexes for common WMS queries (waves, task lists, wave completion checks)
CREATE INDEX IX_WmsTasks_WaveId_Status ON dbo.WmsTasks (WaveId, Status);
CREATE INDEX IX_WmsTasks_WarehouseId_Status ON dbo.WmsTasks (WarehouseId, Status);
CREATE INDEX IX_WmsWaves_Status ON dbo.WmsWaves (Status);

CREATE TABLE dbo.WarehouseIncidents (
    IncidentId BIGINT IDENTITY(1,1) PRIMARY KEY,
    IncidentType NVARCHAR(30) NOT NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'pending',
    WmsTaskId BIGINT NOT NULL,
    SourceType NVARCHAR(30) NOT NULL,
    SourceId INT NULL,
    ItemId INT NOT NULL,
    ItemSpecId INT NULL,
    QtyRequired DECIMAL(18, 4) NOT NULL,
    QtyCompleted DECIMAL(18, 4) NOT NULL,
    QtyShortage DECIMAL(18, 4) NOT NULL,
    Condition NVARCHAR(30) NULL,
    CreatedBy INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ResolvedBy INT NULL,
    ResolvedAt DATETIME2 NULL,
    ResolutionAction NVARCHAR(30) NULL,
    ResolutionDetails NVARCHAR(1000) NULL,
    CONSTRAINT FK_WarehouseIncidents_WmsTasks FOREIGN KEY (WmsTaskId) REFERENCES dbo.WmsTasks(WmsTaskId),
    CONSTRAINT FK_WarehouseIncidents_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_WarehouseIncidents_ItemSpecs FOREIGN KEY (ItemSpecId) REFERENCES dbo.ItemSpecs(ItemSpecId),
    CONSTRAINT FK_WarehouseIncidents_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_WarehouseIncidents_ResolvedBy FOREIGN KEY (ResolvedBy) REFERENCES dbo.Users(UserId)
);

CREATE TABLE dbo.DocumentStatusHistory (
    DocumentStatusHistoryId BIGINT IDENTITY(1,1) PRIMARY KEY,
    DocumentType NVARCHAR(40) NOT NULL,
    DocumentId INT NOT NULL,
    FromStatus NVARCHAR(30) NULL,
    ToStatus NVARCHAR(30) NOT NULL,
    ChangedBy INT NOT NULL,
    ChangedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    Notes NVARCHAR(1000) NULL,
    CONSTRAINT FK_DocumentStatusHistory_Users FOREIGN KEY (ChangedBy) REFERENCES dbo.Users(UserId)
);

CREATE TABLE dbo.ApprovalRequests (
    ApprovalRequestId BIGINT IDENTITY(1,1) PRIMARY KEY,
    DocumentType NVARCHAR(40) NOT NULL,
    DocumentId INT NOT NULL,
    RequestedBy INT NOT NULL,
    RequestedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    Status NVARCHAR(30) NOT NULL DEFAULT 'pending',
    CurrentStepNo INT NOT NULL DEFAULT 1,
    Notes NVARCHAR(1000) NULL,
    CONSTRAINT FK_ApprovalRequests_Users FOREIGN KEY (RequestedBy) REFERENCES dbo.Users(UserId),
    CONSTRAINT CK_ApprovalRequests_Status CHECK (Status IN ('pending', 'approved', 'rejected', 'cancelled'))
);

CREATE TABLE dbo.WorkflowDefinitions (
    WorkflowDefinitionId INT IDENTITY(1,1) PRIMARY KEY,
    WorkflowCode NVARCHAR(60) NOT NULL UNIQUE,
    WorkflowName NVARCHAR(255) NOT NULL,
    DocumentType NVARCHAR(40) NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.WorkflowSteps (
    WorkflowStepId INT IDENTITY(1,1) PRIMARY KEY,
    WorkflowDefinitionId INT NOT NULL,
    StepNo INT NOT NULL,
    ApprovalType NVARCHAR(20) NOT NULL DEFAULT 'sequential',
    ApproverRoleId INT NULL,
    ApproverUserId INT NULL,
    IsRequired BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_WorkflowSteps UNIQUE (WorkflowDefinitionId, StepNo),
    CONSTRAINT FK_WorkflowSteps_Def FOREIGN KEY (WorkflowDefinitionId) REFERENCES dbo.WorkflowDefinitions(WorkflowDefinitionId),
    CONSTRAINT FK_WorkflowSteps_Role FOREIGN KEY (ApproverRoleId) REFERENCES dbo.Roles(RoleId),
    CONSTRAINT FK_WorkflowSteps_User FOREIGN KEY (ApproverUserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT CK_WorkflowSteps_ApprovalType CHECK (ApprovalType IN ('sequential'))
);

CREATE TABLE dbo.ApprovalSteps (
    ApprovalStepId BIGINT IDENTITY(1,1) PRIMARY KEY,
    ApprovalRequestId BIGINT NOT NULL,
    StepNo INT NOT NULL,
    ApproverUserId INT NULL,
    ApproverRoleId INT NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'pending',
    ActionAt DATETIME2 NULL,
    Comments NVARCHAR(1000) NULL,
    CONSTRAINT UQ_ApprovalSteps UNIQUE (ApprovalRequestId, StepNo),
    CONSTRAINT FK_ApprovalSteps_Requests FOREIGN KEY (ApprovalRequestId) REFERENCES dbo.ApprovalRequests(ApprovalRequestId),
    CONSTRAINT FK_ApprovalSteps_Users FOREIGN KEY (ApproverUserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_ApprovalSteps_Roles FOREIGN KEY (ApproverRoleId) REFERENCES dbo.Roles(RoleId),
    CONSTRAINT CK_ApprovalSteps_Status CHECK (Status IN ('pending', 'approved', 'rejected', 'skipped'))
);

CREATE TABLE dbo.ApprovalActions (
    ApprovalActionId BIGINT IDENTITY(1,1) PRIMARY KEY,
    ApprovalRequestId BIGINT NOT NULL,
    StepNo INT NOT NULL,
    ActionBy INT NOT NULL,
    Action NVARCHAR(30) NOT NULL,
    ActionAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    Comments NVARCHAR(1000) NULL,
    CONSTRAINT FK_ApprovalActions_Requests FOREIGN KEY (ApprovalRequestId) REFERENCES dbo.ApprovalRequests(ApprovalRequestId),
    CONSTRAINT FK_ApprovalActions_Users FOREIGN KEY (ActionBy) REFERENCES dbo.Users(UserId),
    CONSTRAINT CK_ApprovalActions_Action CHECK (Action IN ('submitted', 'approved', 'rejected', 'cancelled'))
);

CREATE TABLE dbo.SalesOrderPricingLogs (
    SalesOrderPricingLogId BIGINT IDENTITY(1,1) PRIMARY KEY,

    SalesOrderId INT NOT NULL,
    SalesOrderLineId INT NOT NULL,

    PricingSequenceId INT NULL,

    PricingSourceCode NVARCHAR(40) NULL,

    PricingReferenceTable NVARCHAR(100) NULL,
    PricingReferenceId INT NULL,

    PricingMethod NVARCHAR(40) NULL,

    BaseAmount DECIMAL(18,4) NULL,
    AdjustmentAmount DECIMAL(18,4) NULL,
    ResultAmount DECIMAL(18,4) NULL,

    Description NVARCHAR(500) NULL,

    CreatedAt DATETIME2 NOT NULL
        CONSTRAINT DF_SalesOrderPricingLogs_CreatedAt
        DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_SalesOrderPricingLogs_SalesOrders FOREIGN KEY (SalesOrderId) REFERENCES dbo.SalesOrders(SalesOrderId),
    CONSTRAINT FK_SalesOrderPricingLogs_SalesOrderLines FOREIGN KEY (SalesOrderLineId) REFERENCES dbo.SalesOrderLines(SalesOrderLineId),
    CONSTRAINT FK_SalesOrderPricingLogs_PricingSources FOREIGN KEY (PricingSourceCode) REFERENCES dbo.PricingSources(PricingSourceCode)
);

CREATE NONCLUSTERED INDEX IX_SalesOrderPricingLogs_Line
ON dbo.SalesOrderPricingLogs
(
    SalesOrderLineId,
    CreatedAt
);

CREATE INDEX IX_SalesOrders_Customer_Status ON dbo.SalesOrders(CustomerId, Status);
CREATE INDEX IX_SalesOrderLines_Item ON dbo.SalesOrderLines(ItemId);
CREATE INDEX IX_PurchaseOrders_Vendor_Status ON dbo.PurchaseOrders(VendorId, Status);
CREATE INDEX IX_DeliveryOrders_Status ON dbo.DeliveryOrders(Status);
CREATE INDEX IX_StockMovements_Item_CreatedAt ON dbo.StockMovements(ItemId, CreatedAt);
CREATE INDEX IX_WmsTasks_Status_AssignedTo ON dbo.WmsTasks(Status, AssignedTo);
CREATE INDEX IX_CustomerAddresses_Customer_Type ON dbo.CustomerAddresses(CustomerId, AddressType, IsDefault);
CREATE INDEX IX_CustomerContacts_Customer ON dbo.CustomerContacts(CustomerId, IsPrimary);
CREATE INDEX IX_VendorContacts_Vendor ON dbo.VendorContacts(VendorId, IsPrimary);
CREATE INDEX IX_Items_ProductDimensions ON dbo.Items(ProductTypeId, ThicknessId, WidthId, LengthId);
CREATE INDEX IX_ItemUnitConversions_Item ON dbo.ItemUnitConversions(ItemId, FromUnitId, ToUnitId, EffectiveFrom, EffectiveTo);
CREATE INDEX IX_ItemPricingPolicies_Item_Date ON dbo.ItemPricingPolicies(ItemId, EffectiveFrom, EffectiveTo, IsActive);
CREATE INDEX IX_ItemCosts_Item_Method_Date ON dbo.ItemCosts(ItemId, CostMethod, EffectiveFrom, EffectiveTo);
CREATE INDEX IX_PriceListItems_List_Item_Date ON dbo.PriceListItems(PriceListId, ItemId, EffectiveFrom, EffectiveTo, IsActive);
CREATE INDEX IX_CustomerPriceContracts_Customer_Date ON dbo.CustomerPriceContracts(CustomerId, EffectiveFrom, EffectiveTo, Status);
CREATE INDEX IX_CustomerPriceContractLines_Item ON dbo.CustomerPriceContractLines(CustomerPriceContractId, ItemId, UnitId);
CREATE INDEX IX_Lots_Item_LotNo ON dbo.Lots(ItemId, LotNo);
CREATE INDEX IX_ProductionOrders_Item_Status ON dbo.ProductionOrders(FinishedGoodItemId, Status);
CREATE INDEX IX_QualityInspections_Item_Lot_Status ON dbo.QualityInspections(ItemId, LotId, Status);
CREATE INDEX IX_SalesInvoices_Customer_Status ON dbo.SalesInvoices(CustomerId, Status);
CREATE INDEX IX_PurchaseInvoices_Vendor_Status ON dbo.PurchaseInvoices(VendorId, Status);
CREATE INDEX IX_GoodsIssues_Search ON dbo.GoodsIssues(Status, RequestDate, GoodsIssueTypeId, CustomerId);
CREATE INDEX IX_GoodsIssueLines_Item ON dbo.GoodsIssueLines(ItemId, ProductTypeId, ThicknessId);
CREATE INDEX IX_GoodsReceipts_Search ON dbo.GoodsReceipts(Status, ReceiptDate, GoodsReceiptTypeId, VendorId, ProductionOrderId);
CREATE INDEX IX_GoodsReceiptLines_Item ON dbo.GoodsReceiptLines(ItemId, ProductTypeId, ThicknessId);
CREATE INDEX IX_InventoryCostLayers_Item_Remaining ON dbo.InventoryCostLayers(ItemId, WarehouseId, QuantityRemaining);
CREATE INDEX IX_DocumentStatusHistory_Document ON dbo.DocumentStatusHistory(DocumentType, DocumentId, ChangedAt);
CREATE INDEX IX_ApprovalRequests_Document ON dbo.ApprovalRequests(DocumentType, DocumentId, Status);
CREATE INDEX IX_ApprovalSteps_Request_Status ON dbo.ApprovalSteps(ApprovalRequestId, Status);
CREATE NONCLUSTERED INDEX IX_PriceListItems_Lookup ON dbo.PriceListItems
(
    PriceListId,
    ItemId,
    UnitId,
    MinQuantity,
    EffectiveFrom,
    EffectiveTo
);
CREATE NONCLUSTERED INDEX IX_ContractLines_Lookup ON dbo.CustomerPriceContractLines
(
    CustomerPriceContractId,
    ItemId,
    UnitId,
    MinQuantity
);
CREATE NONCLUSTERED INDEX IX_DiscountRules_Apply ON dbo.DiscountRules
(
    ApplyLevel,
    Priority,
    IsActive
);

INSERT INTO dbo.Roles (RoleCode, RoleName)
VALUES
    ('admin', 'Administrator'),
    ('accounting', 'Accounting'),
    ('user', 'User'),
    ('audit', 'Audit'),
    ('warehouse', 'Warehouse Operator'),
    ('warehouse_manager', 'Warehouse Manager'),
    ('inventory', 'Inventory'),
    ('manager', 'Manager'),
    ('sales', 'Sales'),
    ('qc', 'Quality Control'),
    ('wms', 'WMS Operator');

INSERT INTO dbo.Companies (CompanyCode, CompanyName)
VALUES ('AGROFIBER', N'Agrofiber');

INSERT INTO dbo.Branches (CompanyId, BranchCode, BranchName, IsHeadOffice)
SELECT CompanyId, 'HO', N'สำนักงานใหญ่', 1
FROM dbo.Companies
WHERE CompanyCode = 'AGROFIBER';

INSERT INTO dbo.DocumentStatuses (DocumentType, StatusCode, StatusName, IsTerminal, SortOrder)
VALUES
    ('QT', 'draft', N'ร่าง', 0, 10),
    ('QT', 'requested', N'รออนุมัติ', 0, 20),
    ('QT', 'approved', N'อนุมัติ', 0, 30),
    ('QT', 'rejected', N'ไม่อนุมัติ', 1, 40),
    ('QT', 'closed', N'ปิดเอกสาร', 1, 50),

    ('SO', 'draft', N'ร่าง', 0, 10),
    ('SO', 'requested', N'รออนุมัติ', 0, 20),
    ('SO', 'approved', N'อนุมัติ', 0, 30),
    ('SO', 'rejected', N'ไม่อนุมัติ', 1, 35),
    ('SO', 'confirmed', N'ยืนยัน', 0, 40),
    ('SO', 'partial_delivered', N'ส่งบางส่วน', 0, 50),
    ('SO', 'closed', N'ปิดเอกสาร', 1, 60),

    ('PO', 'draft', N'ร่าง', 0, 10),
    ('PO', 'requested', N'รออนุมัติ', 0, 20),
    ('PO', 'approved', N'อนุมัติ', 0, 30),
    ('PO', 'closed', N'ปิดเอกสาร', 1, 40),

    ('DO', 'draft', N'ร่าง', 0, 10),
    ('DO', 'shipped', N'ส่งสินค้าแล้ว', 0, 20),
    ('DO', 'closed', N'ปิดเอกสาร', 1, 30),

    ('GI', 'draft', N'ร่าง', 0, 10),
    ('GI', 'requested', N'รออนุมัติ', 0, 20),
    ('GI', 'approved', N'อนุมัติ', 0, 30),
    ('GI', 'issued', N'เบิกแล้ว', 1, 40),
    ('GI', 'cancelled', N'ยกเลิก', 1, 50),

    ('GR', 'draft', N'ร่าง', 0, 10),
    ('GR', 'received', N'รับแล้ว', 0, 20),
    ('GR', 'posted', N'ลงคลังแล้ว', 1, 30),
    ('GR', 'cancelled', N'ยกเลิก', 1, 40),

    ('MO', 'draft', N'ร่าง', 0, 10),
    ('MO', 'requested', N'รออนุมัติ', 0, 20),
    ('MO', 'approved', N'อนุมัติ', 0, 30),
    ('MO', 'released', N'ปล่อยผลิต', 0, 40),
    ('MO', 'in_process', N'กำลังผลิต', 0, 50),
    ('MO', 'completed', N'ผลิตเสร็จ', 1, 60),

    ('INV', 'draft', N'ร่าง', 0, 10),
    ('INV', 'posted', N'ลงบัญชีแล้ว', 0, 20),
    ('INV', 'paid', N'ชำระแล้ว', 1, 30),
    ('INV', 'cancelled', N'ยกเลิก', 1, 40),

    ('PINV', 'draft', N'ร่าง', 0, 10),
    ('PINV', 'posted', N'ลงบัญชีแล้ว', 0, 20),
    ('PINV', 'paid', N'ชำระแล้ว', 1, 30),
    ('PINV', 'cancelled', N'ยกเลิก', 1, 40),

    ('RCPT', 'draft', N'ร่าง', 0, 10),
    ('RCPT', 'posted', N'ลงบัญชีแล้ว', 0, 20),
    ('RCPT', 'cancelled', N'ยกเลิก', 1, 30),

    ('VPAY', 'draft', N'ร่าง', 0, 10),
    ('VPAY', 'posted', N'ลงบัญชีแล้ว', 0, 20),
    ('VPAY', 'cancelled', N'ยกเลิก', 1, 30),

    ('ITEM_PRICING_POLICY', 'draft', N'ร่าง', 0, 10),
    ('ITEM_PRICING_POLICY', 'requested', N'รออนุมัติ', 0, 20),
    ('ITEM_PRICING_POLICY', 'approved', N'อนุมัติ', 0, 30),
    ('ITEM_PRICING_POLICY', 'rejected', N'ไม่อนุมัติ', 1, 40);

INSERT INTO dbo.DocumentSeries (DocumentType, SeriesCode, BranchId, PrefixFormat, PaddingLength, ResetFrequency)
SELECT v.DocumentType, v.SeriesCode, b.BranchId, v.PrefixFormat, 4, 'yearly'
FROM dbo.Branches b
CROSS JOIN (
    VALUES
        ('QT', 'QT', 'QT-{yyyy}-'),
        ('SO', 'SO', 'SO-{yyyy}-'),
        ('PO', 'PO', 'PO-{yyyy}-'),
        ('DO', 'DO', 'DO-{yyyy}-'),
        ('GI', 'GI', 'GI-{yyyy}-'),
        ('GR', 'GR', 'GR-{yyyy}-'),
        ('MO', 'MO', 'MO-{yyyy}-'),
        ('INV', 'INV', 'INV-{yyyy}-'),
        ('PINV', 'PINV', 'PINV-{yyyy}-'),
        ('RCPT', 'RCPT', 'RCPT-{yyyy}-'),
        ('VPAY', 'VPAY', 'VPAY-{yyyy}-')
) v(DocumentType, SeriesCode, PrefixFormat)
WHERE b.BranchCode = 'HO';

INSERT INTO dbo.SmtpSettings (SmtpHost, SmtpPort, SmtpUser, SmtpPassword, SmtpSender, IsActive)
VALUES (
    'smtp.gmail.com',
    587,
    'your-email@gmail.com',
    'your-app-password',
    'noreply@agrofiber.com',
    1
);

INSERT INTO dbo.WorkflowDefinitions (WorkflowCode, WorkflowName, DocumentType, IsActive)
VALUES
    ('WF_ITEM_PRICING_POLICY', N'Workflow: Item Pricing Policy Approval', 'ITEM_PRICING_POLICY', 1);

INSERT INTO dbo.WorkflowSteps (WorkflowDefinitionId, StepNo, ApprovalType, ApproverRoleId, ApproverUserId, IsRequired)
SELECT
    wd.WorkflowDefinitionId,
    v.StepNo,
    'sequential',
    r.RoleId,
    NULL,
    1
FROM dbo.WorkflowDefinitions wd
JOIN dbo.Roles r ON r.RoleCode = v.RoleCode
CROSS JOIN (
    VALUES
        (1, 'accounting'),
        (2, 'admin')
) v(StepNo, RoleCode)
WHERE wd.WorkflowCode = 'WF_ITEM_PRICING_POLICY';

INSERT INTO dbo.StockMovementTypes (MovementTypeCode, MovementTypeName, Direction)
VALUES
    ('goods_receipt', N'รับสินค้าเข้า', 'in'),
    ('goods_issue', N'เบิกสินค้าออก', 'out'),
    ('purchase_receipt', N'รับเข้าจากการซื้อ', 'in'),
    ('production_issue', N'เบิกวัตถุดิบเข้าผลิต', 'out'),
    ('production_receipt', N'รับเข้าสินค้าจากการผลิต', 'in'),
    ('sales_shipment', N'ตัดออกจากการขาย/ส่งสินค้า', 'out'),
    ('transfer', N'โอนย้ายคลัง/ตำแหน่งจัดเก็บ', 'transfer'),
    ('adjustment_in', N'ปรับปรุงรับเข้า', 'adjustment'),
    ('adjustment_out', N'ปรับปรุงตัดออก', 'adjustment');

INSERT INTO dbo.GoodsIssueTypes (GoodsIssueTypeCode, GoodsIssueTypeName, MovementTypeCode, RequiresCustomer, RequiresApproval)
VALUES
    ('FOR_SALE', N'เพื่อขาย', 'goods_issue', 1, 0),
    ('EXPORT_SALE', N'เพื่อขาย EX', 'goods_issue', 1, 0),
    ('CNC_PICK', N'เบิกเซาะ CNC', 'goods_issue', 0, 0),
    ('CUTTING_PICK', N'เบิกตัด', 'goods_issue', 0, 0),
    ('REPAIR_PICK', N'เบิกซ่อม', 'goods_issue', 0, 1),
    ('OLD_STOCK_PICK', N'เบิกทึบเก่า', 'goods_issue', 0, 1),
    ('OTHER_PICK', N'เบิกอื่นๆ', 'goods_issue', 0, 1),
    ('CLAIM', N'เบิกชดเชยลูกค้า', 'goods_issue', 1, 1),
    ('SAMPLE', N'เบิกตัวอย่าง', 'goods_issue', 0, 1);

INSERT INTO dbo.GoodsReceiptTypes (GoodsReceiptTypeCode, GoodsReceiptTypeName, MovementTypeCode, RequiresVendor, RequiresProductionOrder, RequiresApproval)
VALUES
    ('PURCHASE_RECEIVE', N'รับจากการซื้อ', 'goods_receipt', 1, 0, 0),
    ('PRODUCTION_RECEIVE', N'รับจากการผลิต', 'goods_receipt', 0, 1, 0),
    ('GENERAL_RECEIVE', N'รับเข้าทั่วไป', 'goods_receipt', 0, 0, 0),
    ('RETURN_RECEIVE', N'รับคืนจากลูกค้า', 'goods_receipt', 0, 0, 1),
    ('ADJUSTMENT_RECEIVE', N'รับเข้าปรับปรุง', 'goods_receipt', 0, 0, 1),
    ('TRANSFER_RECEIVE', N'รับจากการโอนย้าย', 'goods_receipt', 0, 0, 0);

INSERT INTO dbo.WmsTaskTypes (TaskTypeCode, TaskTypeName)
VALUES
    ('receiving', N'รับสินค้าเข้าคลัง'),
    ('putaway', N'จัดเก็บสินค้า'),
    ('picking', N'หยิบสินค้า'),
    ('packing', N'แพ็คสินค้า'),
    ('shipping', N'ส่งสินค้า'),
    ('transfer', N'โอนย้ายสินค้า'),
    ('cycle_count', N'ตรวจนับสินค้า');

INSERT INTO dbo.Units (UnitCode, UnitName)
VALUES ('PACK', N'แพ็ค'), ('PALLET', N'พาเลท'), ('PCS', N'ชิ้น'), ('SHEET', N'แผ่น');

INSERT INTO dbo.UnitConversions (FromUnitId, ToUnitId, ConversionFactor)
SELECT fu.UnitId, tu.UnitId, 1.00000000
FROM dbo.Units fu
JOIN dbo.Units tu ON tu.UnitCode = fu.UnitCode;

INSERT INTO dbo.TaxCodes (TaxCode, TaxName, TaxRatePercent, IsDefault)
VALUES ('VAT7', N'ภาษีมูลค่าเพิ่ม 7%', 7.0000, 1), ('VAT0', N'ไม่มีภาษี', 0.0000, 0);

INSERT INTO dbo.PricingMethods (PricingMethodCode, PricingMethodName, Description)
VALUES
    ('FIXED_PRICE', N'Fixed Price', N'ใช้ราคาขายมาตรฐานของสินค้า หรือราคาที่กำหนดไว้ใน price list/สัญญา'),
    ('MARKUP', N'Cost Plus', N'คำนวณราคาขายจากต้นทุนสินค้า บวก markup ตามเปอร์เซ็นต์ที่กำหนด'),
    ('MARGIN', N'Margin Based', N'คำนวณราคาขายจากต้นทุนสินค้า เพื่อให้ได้ margin ตามเปอร์เซ็นต์เป้าหมาย'),
    ('LOT_BASED', N'Lot-Based', N'กำหนดราคาตาม lot/batch โดยอ้างอิงต้นทุนหรือราคาของ lot นั้น'),
    ('DISCOUNT_PERCENT', N'Discount Percent', N'คำนวณราคาขายโดยลดจากราคามาตรฐานตามเปอร์เซ็นต์ที่กำหนด'),
    ('DISCOUNT_AMOUNT', N'Discount Amount', N'คำนวณราคาขายโดยลดจากราคามาตรฐานตามจำนวนที่กำหนด')
    ;

INSERT INTO dbo.ProductTypes (ProductTypeCode, ProductTypeName)
VALUES ('MDF', N'MDF'), ('HMR', N'HMR'), ('PB', N'Particle Board'), ('PLYWOOD', N'Plywood');

INSERT INTO dbo.ItemTypes (
    ItemTypeCode,
    ItemTypeName,
    Description,
    IsStockItem,
    IsSellable,
    IsPurchasable,
    IsManufacturable,
    IsBomComponent
)
VALUES
    ('FG', N'Finished Good', N'สินค้าสำเร็จรูปพร้อมขาย เช่น แผ่น MDF/HMR ที่ผลิตเสร็จแล้ว', 1, 1, 0, 1, 0),
    ('SFG', N'Semi-Finished Good', N'สินค้ากึ่งสำเร็จรูปหรือ WIP ที่ใช้ต่อในกระบวนการผลิต', 1, 0, 0, 1, 1),
    ('RM', N'Raw Material', N'วัตถุดิบหลักที่ใช้ผลิต เช่น wood fiber, resin, wax, additive', 1, 0, 1, 0, 1),
    ('PKG', N'Packaging Material', N'วัสดุบรรจุภัณฑ์ เช่น pallet, strap, wrap, label', 1, 0, 1, 0, 1),
    ('CONSUMABLE', N'Consumable', N'วัสดุสิ้นเปลืองในการผลิตหรือคลังสินค้า', 1, 0, 1, 0, 0),
    ('SCRAP', N'Scrap / By-product', N'เศษวัสดุหรือผลพลอยได้จากการผลิต', 1, 1, 0, 0, 0),
    ('SERVICE', N'Service', N'รายการบริการหรือค่าใช้จ่ายที่ไม่เก็บ stock', 0, 1, 1, 0, 0);

INSERT INTO dbo.ItemWidths (WidthM, WidthLabel)
VALUES (1.220, N'1.220 m'), (1.230, N'1.230 m'), (1.525, N'1.525 m');

INSERT INTO dbo.ItemLengths (LengthM, LengthLabel)
VALUES (2.440, N'2.440 m'), (2.460, N'2.460 m'), (3.050, N'3.050 m');

INSERT INTO dbo.ItemThicknesses (ThicknessMm, ThicknessLabel)
VALUES (3.000, N'3 mm'), (6.000, N'6 mm'), (9.000, N'9 mm'), (12.000, N'12 mm'), (15.000, N'15 mm'), (18.000, N'18 mm'), (25.000, N'25 mm');
GO

CREATE VIEW dbo.vw_ItemsWithDimensions AS
SELECT
    i.ItemId,
    i.ItemCode,
    i.ItemName,
    it.ItemTypeCode,
    it.ItemTypeName,
    pt.ProductTypeCode,
    pt.ProductTypeName,
    th.ThicknessMm,
    w.WidthM,
    l.LengthM,
    CAST(w.WidthM * l.LengthM AS DECIMAL(18,6)) AS CalculatedAreaSqm,
    i.AreaSqm AS StoredAreaSqm,
    u.UnitCode,
    u.UnitName,
    tc.TaxCode,
    tc.TaxRatePercent,
    i.IsLotControlled,
    i.IsActive
FROM dbo.Items i
JOIN dbo.ItemTypes it ON it.ItemTypeId = i.ItemTypeId
JOIN dbo.Units u ON u.UnitId = i.UnitId
LEFT JOIN dbo.ProductTypes pt ON pt.ProductTypeId = i.ProductTypeId
LEFT JOIN dbo.ItemThicknesses th ON th.ThicknessId = i.ThicknessId
LEFT JOIN dbo.ItemWidths w ON w.WidthId = i.WidthId
LEFT JOIN dbo.ItemLengths l ON l.LengthId = i.LengthId
LEFT JOIN dbo.TaxCodes tc ON tc.TaxCodeId = i.TaxCodeId;
GO

CREATE VIEW dbo.vw_CurrentItemPricing AS
SELECT
    ipp.ItemPricingPolicyId,
    ipp.ItemId,
    i.ItemCode,
    i.ItemName,
    pm.PricingMethodCode,
    ipp.StandardPrice,
    ipp.StandardCost,
    ipp.MinMarginPercent,
    ipp.TargetMarginPercent,
    ipp.MinMarkupPercent,
    ipp.TargetMarkupPercent,
    ipp.CurrencyCode,
    ipp.EffectiveFrom,
    ipp.EffectiveTo
FROM dbo.ItemPricingPolicies ipp
JOIN dbo.Items i ON i.ItemId = ipp.ItemId
JOIN dbo.PricingMethods pm ON pm.PricingMethodId = ipp.PricingMethodId
WHERE ipp.IsActive = 1
  AND CAST(SYSUTCDATETIME() AS DATE) >= ipp.EffectiveFrom
  AND (ipp.EffectiveTo IS NULL OR CAST(SYSUTCDATETIME() AS DATE) <= ipp.EffectiveTo);
GO

CREATE VIEW dbo.vw_GoodsIssueList AS
SELECT
    gi.GoodsIssueId,
    gi.DocumentNo AS IssueNumber,
    gi.Status,
    gi.RequestDate,
    git.GoodsIssueTypeCode,
    git.GoodsIssueTypeName,
    c.CustomerCode,
    c.CustomerName,
    gil.LineNum,
    i.ItemCode AS MatCode,
    i.ItemName,
    pt.ProductTypeCode,
    pt.ProductTypeName,
    th.ThicknessMm,
    gil.PalletCount,
    gil.LimitSheetQty,
    gil.RequestedSheetQty,
    gil.IssuedSheetQty,
    gil.M3Quantity,
    gil.Remark
FROM dbo.GoodsIssues gi
JOIN dbo.GoodsIssueTypes git ON git.GoodsIssueTypeId = gi.GoodsIssueTypeId
JOIN dbo.GoodsIssueLines gil ON gil.GoodsIssueId = gi.GoodsIssueId
JOIN dbo.Items i ON i.ItemId = gil.ItemId
LEFT JOIN dbo.Customers c ON c.CustomerId = gi.CustomerId
LEFT JOIN dbo.ProductTypes pt ON pt.ProductTypeId = COALESCE(gil.ProductTypeId, i.ProductTypeId)
LEFT JOIN dbo.ItemThicknesses th ON th.ThicknessId = COALESCE(gil.ThicknessId, i.ThicknessId);
GO

CREATE VIEW dbo.vw_GoodsReceiptList AS
SELECT
    gr.GoodsReceiptId,
    gr.DocumentNo AS ReceiptNumber,
    gr.Status,
    gr.ReceiptDate,
    grt.GoodsReceiptTypeCode,
    grt.GoodsReceiptTypeName,
    v.VendorCode,
    v.VendorName,
    c.CustomerCode,
    c.CustomerName,
    grl.LineNum,
    i.ItemCode AS MatCode,
    i.ItemName,
    pt.ProductTypeCode,
    pt.ProductTypeName,
    th.ThicknessMm,
    grl.PalletCount,
    grl.ReceivedSheetQty,
    grl.M3Quantity,
    grl.LotNo,
    grl.Remark
FROM dbo.GoodsReceipts gr
JOIN dbo.GoodsReceiptTypes grt ON grt.GoodsReceiptTypeId = gr.GoodsReceiptTypeId
JOIN dbo.GoodsReceiptLines grl ON grl.GoodsReceiptId = gr.GoodsReceiptId
JOIN dbo.Items i ON i.ItemId = grl.ItemId
LEFT JOIN dbo.Vendors v ON v.VendorId = gr.VendorId
LEFT JOIN dbo.Customers c ON c.CustomerId = gr.CustomerId
LEFT JOIN dbo.ProductTypes pt ON pt.ProductTypeId = COALESCE(grl.ProductTypeId, i.ProductTypeId)
LEFT JOIN dbo.ItemThicknesses th ON th.ThicknessId = COALESCE(grl.ThicknessId, i.ThicknessId);
GO

CREATE TABLE dbo.QuotationAttachments (
    QuotationAttachmentId INT IDENTITY(1,1) PRIMARY KEY,
    QuotationId INT NOT NULL,
    FileName NVARCHAR(255) NOT NULL,
    FilePath NVARCHAR(500) NOT NULL,
    FileSize INT NULL,
    UploadedBy INT NOT NULL,
    UploadedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_QuotationAttachments_Quotations FOREIGN KEY (QuotationId) REFERENCES dbo.Quotations(QuotationId),
    CONSTRAINT FK_QuotationAttachments_UploadedBy FOREIGN KEY (UploadedBy) REFERENCES dbo.Users(UserId)
);
GO
