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

CREATE TABLE dbo.PricingMethods (
    PricingMethodId INT IDENTITY(1,1) PRIMARY KEY,
    PricingMethodCode NVARCHAR(30) NOT NULL UNIQUE,
    PricingMethodName NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500) NULL,
    IsActive BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.PriceLists (
    PriceListId INT IDENTITY(1,1) PRIMARY KEY,
    PriceListCode NVARCHAR(50) NOT NULL UNIQUE,
    PriceListName NVARCHAR(255) NOT NULL,
    CustomerSegment NVARCHAR(80) NULL,
    CurrencyCode CHAR(3) NOT NULL DEFAULT 'THB',
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.DiscountRules (
    DiscountRuleId INT IDENTITY(1,1) PRIMARY KEY,
    DiscountRuleCode NVARCHAR(50) NOT NULL UNIQUE,
    DiscountRuleName NVARCHAR(255) NOT NULL,
    DiscountType NVARCHAR(30) NOT NULL DEFAULT 'percent',
    DiscountPercent DECIMAL(9,4) NULL,
    DiscountAmount DECIMAL(18,4) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT CK_DiscountRules_Type CHECK (DiscountType IN ('percent', 'amount'))
);

CREATE TABLE dbo.Customers (
    CustomerId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerCode NVARCHAR(50) NOT NULL UNIQUE,
    CustomerName NVARCHAR(255) NOT NULL,
    TaxId NVARCHAR(50) NULL,
    PriceListId INT NULL,
    DiscountRuleId INT NULL,
    BillingAddress NVARCHAR(1000) NULL,
    ShippingAddress NVARCHAR(1000) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT FK_Customers_PriceLists FOREIGN KEY (PriceListId) REFERENCES dbo.PriceLists(PriceListId),
    CONSTRAINT FK_Customers_DiscountRules FOREIGN KEY (DiscountRuleId) REFERENCES dbo.DiscountRules(DiscountRuleId)
);

CREATE TABLE dbo.CustomerAddresses (
    CustomerAddressId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NOT NULL,
    AddressCode NVARCHAR(50) NOT NULL,
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
    CONSTRAINT CK_CustomerAddresses_Type CHECK (AddressType IN ('billing', 'shipping', 'billing_shipping'))
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
    IsLotControlled BIT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT FK_Items_ItemTypes FOREIGN KEY (ItemTypeId) REFERENCES dbo.ItemTypes(ItemTypeId),
    CONSTRAINT FK_Items_ProductTypes FOREIGN KEY (ProductTypeId) REFERENCES dbo.ProductTypes(ProductTypeId),
    CONSTRAINT FK_Items_Thicknesses FOREIGN KEY (ThicknessId) REFERENCES dbo.ItemThicknesses(ThicknessId),
    CONSTRAINT FK_Items_Widths FOREIGN KEY (WidthId) REFERENCES dbo.ItemWidths(WidthId),
    CONSTRAINT FK_Items_Lengths FOREIGN KEY (LengthId) REFERENCES dbo.ItemLengths(LengthId),
    CONSTRAINT FK_Items_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId),
    CONSTRAINT FK_Items_TaxCodes FOREIGN KEY (TaxCodeId) REFERENCES dbo.TaxCodes(TaxCodeId)
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
    FromUnitId INT NOT NULL,
    ToUnitId INT NOT NULL,
    ConversionFactor DECIMAL(18,8) NOT NULL,
    EffectiveFrom DATE NOT NULL DEFAULT (CAST(SYSUTCDATETIME() AS DATE)),
    EffectiveTo DATE NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT UQ_ItemUnitConversions UNIQUE (ItemId, FromUnitId, ToUnitId, EffectiveFrom),
    CONSTRAINT FK_ItemUnitConversions_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_ItemUnitConversions_FromUnits FOREIGN KEY (FromUnitId) REFERENCES dbo.Units(UnitId),
    CONSTRAINT FK_ItemUnitConversions_ToUnits FOREIGN KEY (ToUnitId) REFERENCES dbo.Units(UnitId),
    CONSTRAINT CK_ItemUnitConversions_DateRange CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
);

CREATE TABLE dbo.ItemPricingPolicies (
    ItemPricingPolicyId INT IDENTITY(1,1) PRIMARY KEY,
    ItemId INT NOT NULL,
    PricingMethodId INT NOT NULL,
    StandardPrice DECIMAL(18,4) NOT NULL DEFAULT 0,
    StandardCost DECIMAL(18,4) NOT NULL DEFAULT 0,
    MinMarginPercent DECIMAL(9,4) NULL,
    TargetMarginPercent DECIMAL(9,4) NULL,
    MinMarkupPercent DECIMAL(9,4) NULL,
    TargetMarkupPercent DECIMAL(9,4) NULL,
    CurrencyCode CHAR(3) NOT NULL DEFAULT 'THB',
    EffectiveFrom DATE NOT NULL DEFAULT (CAST(SYSUTCDATETIME() AS DATE)),
    EffectiveTo DATE NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ItemPricingPolicies_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_ItemPricingPolicies_PricingMethods FOREIGN KEY (PricingMethodId) REFERENCES dbo.PricingMethods(PricingMethodId),
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
    UnitId INT NOT NULL,
    UnitPrice DECIMAL(18,4) NOT NULL,
    CurrencyCode CHAR(3) NOT NULL DEFAULT 'THB',
    EffectiveFrom DATE NOT NULL DEFAULT (CAST(SYSUTCDATETIME() AS DATE)),
    EffectiveTo DATE NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT UQ_PriceListItems UNIQUE (PriceListId, ItemId, UnitId, EffectiveFrom),
    CONSTRAINT FK_PriceListItems_PriceLists FOREIGN KEY (PriceListId) REFERENCES dbo.PriceLists(PriceListId),
    CONSTRAINT FK_PriceListItems_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_PriceListItems_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId),
    CONSTRAINT CK_PriceListItems_DateRange CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
);

CREATE TABLE dbo.CustomerPriceContracts (
    CustomerPriceContractId INT IDENTITY(1,1) PRIMARY KEY,
    ContractNo NVARCHAR(80) NOT NULL UNIQUE,
    CustomerId INT NOT NULL,
    ContractName NVARCHAR(255) NULL,
    CurrencyCode CHAR(3) NOT NULL DEFAULT 'THB',
    EffectiveFrom DATE NOT NULL,
    EffectiveTo DATE NOT NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'active',
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_CustomerPriceContracts_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId),
    CONSTRAINT CK_CustomerPriceContracts_DateRange CHECK (EffectiveTo >= EffectiveFrom)
);

CREATE TABLE dbo.CustomerPriceContractLines (
    CustomerPriceContractLineId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerPriceContractId INT NOT NULL,
    LineNum INT NOT NULL,
    ItemId INT NOT NULL,
    UnitId INT NOT NULL,
    UnitPrice DECIMAL(18,4) NOT NULL,
    MinQuantity DECIMAL(18,4) NULL,
    MaxQuantity DECIMAL(18,4) NULL,
    CONSTRAINT UQ_CustomerPriceContractLines UNIQUE (CustomerPriceContractId, LineNum),
    CONSTRAINT FK_CustomerPriceContractLines_Contracts FOREIGN KEY (CustomerPriceContractId) REFERENCES dbo.CustomerPriceContracts(CustomerPriceContractId),
    CONSTRAINT FK_CustomerPriceContractLines_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_CustomerPriceContractLines_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId),
    CONSTRAINT CK_CustomerPriceContractLines_QuantityRange CHECK (MaxQuantity IS NULL OR MinQuantity IS NULL OR MaxQuantity >= MinQuantity)
);

CREATE TABLE dbo.Warehouses (
    WarehouseId INT IDENTITY(1,1) PRIMARY KEY,
    WarehouseCode NVARCHAR(50) NOT NULL UNIQUE,
    WarehouseName NVARCHAR(255) NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1
);

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

CREATE TABLE dbo.SalesOrders (
    SalesOrderId INT IDENTITY(1,1) PRIMARY KEY,
    DocumentNo NVARCHAR(50) NOT NULL UNIQUE,
    BranchId INT NULL,
    CustomerId INT NOT NULL,
    DocumentDate DATE NOT NULL,
    RequiredDate DATE NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'draft',
    ShippingAddress NVARCHAR(1000) NULL,
    CurrencyCode CHAR(3) NOT NULL DEFAULT 'THB',
    SubTotalAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    DiscountAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    TaxAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    GrandTotalAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    CreatedBy INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    CONSTRAINT FK_SalesOrders_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
    CONSTRAINT FK_SalesOrders_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId),
    CONSTRAINT FK_SalesOrders_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId)
);

CREATE TABLE dbo.SalesOrderLines (
    SalesOrderLineId INT IDENTITY(1,1) PRIMARY KEY,
    SalesOrderId INT NOT NULL,
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
    TaxAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    UnitId INT NOT NULL,
    CONSTRAINT UQ_SalesOrderLines UNIQUE (SalesOrderId, LineNum),
    CONSTRAINT FK_SalesOrderLines_SalesOrders FOREIGN KEY (SalesOrderId) REFERENCES dbo.SalesOrders(SalesOrderId),
    CONSTRAINT FK_SalesOrderLines_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_SalesOrderLines_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId),
    CONSTRAINT CK_SalesOrderLines_PricingSource CHECK (
        PricingSource IS NULL OR PricingSource IN ('contract', 'customer_price_list', 'item_default', 'manual')
    )
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
    Status NVARCHAR(30) NOT NULL DEFAULT 'draft',
    CurrencyCode CHAR(3) NOT NULL DEFAULT 'THB',
    SubTotalAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    DiscountAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    TaxAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    GrandTotalAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    CreatedBy INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Quotations_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
    CONSTRAINT FK_Quotations_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId),
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
    TaxAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    UnitId INT NOT NULL,
    CONSTRAINT UQ_QuotationLines UNIQUE (QuotationId, LineNum),
    CONSTRAINT FK_QuotationLines_Quotations FOREIGN KEY (QuotationId) REFERENCES dbo.Quotations(QuotationId),
    CONSTRAINT FK_QuotationLines_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_QuotationLines_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId),
    CONSTRAINT CK_QuotationLines_PricingSource CHECK (
        PricingSource IS NULL OR PricingSource IN ('contract', 'customer_price_list', 'item_default', 'manual')
    )
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
    Status NVARCHAR(30) NOT NULL DEFAULT 'draft',
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
    TaxAmount DECIMAL(18,4) NOT NULL DEFAULT 0,
    CONSTRAINT UQ_SalesInvoiceLines UNIQUE (SalesInvoiceId, LineNum),
    CONSTRAINT FK_SalesInvoiceLines_Invoices FOREIGN KEY (SalesInvoiceId) REFERENCES dbo.SalesInvoices(SalesInvoiceId),
    CONSTRAINT FK_SalesInvoiceLines_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
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

CREATE TABLE dbo.StockOnHand (
    StockOnHandId INT IDENTITY(1,1) PRIMARY KEY,
    ItemId INT NOT NULL,
    WarehouseId INT NOT NULL,
    LocationId INT NULL,
    LotId BIGINT NULL,
    LotNo NVARCHAR(80) NULL,
    QuantityOnHand DECIMAL(18,4) NOT NULL DEFAULT 0,
    QuantityReserved DECIMAL(18,4) NOT NULL DEFAULT 0,
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_StockOnHand UNIQUE (ItemId, WarehouseId, LocationId, LotId, LotNo),
    CONSTRAINT FK_StockOnHand_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_StockOnHand_Warehouses FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId),
    CONSTRAINT FK_StockOnHand_Locations FOREIGN KEY (LocationId) REFERENCES dbo.WarehouseLocations(LocationId),
    CONSTRAINT FK_StockOnHand_Lots FOREIGN KEY (LotId) REFERENCES dbo.Lots(LotId)
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

CREATE TABLE dbo.WmsTasks (
    WmsTaskId BIGINT IDENTITY(1,1) PRIMARY KEY,
    TaskType NVARCHAR(40) NOT NULL,
    ReferenceType NVARCHAR(40) NULL,
    ReferenceId INT NULL,
    WarehouseId INT NOT NULL,
    AssignedTo INT NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'open',
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CompletedAt DATETIME2 NULL,
    CONSTRAINT FK_WmsTasks_TaskTypes FOREIGN KEY (TaskType) REFERENCES dbo.WmsTaskTypes(TaskTypeCode),
    CONSTRAINT FK_WmsTasks_Warehouses FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouses(WarehouseId),
    CONSTRAINT FK_WmsTasks_Users FOREIGN KEY (AssignedTo) REFERENCES dbo.Users(UserId)
);

CREATE TABLE dbo.WmsTaskLines (
    WmsTaskLineId BIGINT IDENTITY(1,1) PRIMARY KEY,
    WmsTaskId BIGINT NOT NULL,
    ItemId INT NOT NULL,
    FromLocationId INT NULL,
    ToLocationId INT NULL,
    QuantityRequired DECIMAL(18,4) NOT NULL,
    QuantityCompleted DECIMAL(18,4) NOT NULL DEFAULT 0,
    CONSTRAINT FK_WmsTaskLines_WmsTasks FOREIGN KEY (WmsTaskId) REFERENCES dbo.WmsTasks(WmsTaskId),
    CONSTRAINT FK_WmsTaskLines_Items FOREIGN KEY (ItemId) REFERENCES dbo.Items(ItemId),
    CONSTRAINT FK_WmsTaskLines_FromLocations FOREIGN KEY (FromLocationId) REFERENCES dbo.WarehouseLocations(LocationId),
    CONSTRAINT FK_WmsTaskLines_ToLocations FOREIGN KEY (ToLocationId) REFERENCES dbo.WarehouseLocations(LocationId)
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
CREATE INDEX IX_InventoryCostLayers_Item_Remaining ON dbo.InventoryCostLayers(ItemId, WarehouseId, QuantityRemaining);
CREATE INDEX IX_DocumentStatusHistory_Document ON dbo.DocumentStatusHistory(DocumentType, DocumentId, ChangedAt);
CREATE INDEX IX_ApprovalRequests_Document ON dbo.ApprovalRequests(DocumentType, DocumentId, Status);
CREATE INDEX IX_ApprovalSteps_Request_Status ON dbo.ApprovalSteps(ApprovalRequestId, Status);

INSERT INTO dbo.Roles (RoleCode, RoleName)
VALUES ('admin', 'Administrator'), ('accounting', 'Accounting'), ('user', 'User'), ('audit', 'Audit');

INSERT INTO dbo.Companies (CompanyCode, CompanyName)
VALUES ('AGROFIBER', N'Agrofiber');

INSERT INTO dbo.Branches (CompanyId, BranchCode, BranchName, IsHeadOffice)
SELECT CompanyId, 'HO', N'สำนักงานใหญ่', 1
FROM dbo.Companies
WHERE CompanyCode = 'AGROFIBER';

INSERT INTO dbo.DocumentStatuses (DocumentType, StatusCode, StatusName, IsTerminal, SortOrder)
VALUES
    ('quotation', 'draft', N'ร่าง', 0, 10),
    ('quotation', 'approved', N'อนุมัติ', 0, 20),
    ('quotation', 'rejected', N'ไม่อนุมัติ', 1, 30),
    ('quotation', 'closed', N'ปิดเอกสาร', 1, 40),
    ('sales_order', 'draft', N'ร่าง', 0, 10),
    ('sales_order', 'confirmed', N'ยืนยัน', 0, 20),
    ('sales_order', 'partial_delivered', N'ส่งบางส่วน', 0, 30),
    ('sales_order', 'closed', N'ปิดเอกสาร', 1, 40),
    ('purchase_order', 'draft', N'ร่าง', 0, 10),
    ('purchase_order', 'approved', N'อนุมัติ', 0, 20),
    ('purchase_order', 'closed', N'ปิดเอกสาร', 1, 30),
    ('delivery_order', 'draft', N'ร่าง', 0, 10),
    ('delivery_order', 'shipped', N'ส่งสินค้าแล้ว', 0, 20),
    ('delivery_order', 'closed', N'ปิดเอกสาร', 1, 30),
    ('production_order', 'draft', N'ร่าง', 0, 10),
    ('production_order', 'released', N'ปล่อยผลิต', 0, 20),
    ('production_order', 'in_process', N'กำลังผลิต', 0, 30),
    ('production_order', 'completed', N'ผลิตเสร็จ', 1, 40),
    ('invoice', 'draft', N'ร่าง', 0, 10),
    ('invoice', 'posted', N'ลงบัญชีแล้ว', 0, 20),
    ('invoice', 'paid', N'ชำระแล้ว', 1, 30),
    ('invoice', 'cancelled', N'ยกเลิก', 1, 40);

INSERT INTO dbo.DocumentSeries (DocumentType, SeriesCode, BranchId, PrefixFormat, PaddingLength, ResetFrequency)
SELECT v.DocumentType, v.SeriesCode, b.BranchId, v.PrefixFormat, 4, 'yearly'
FROM dbo.Branches b
CROSS JOIN (
    VALUES
        ('quotation', 'QT', 'QT-{yyyy}-'),
        ('sales_order', 'SO', 'SO-{yyyy}-'),
        ('purchase_order', 'PO', 'PO-{yyyy}-'),
        ('delivery_order', 'DO', 'DO-{yyyy}-'),
        ('production_order', 'MO', 'MO-{yyyy}-'),
        ('sales_invoice', 'INV', 'INV-{yyyy}-'),
        ('purchase_invoice', 'PINV', 'PINV-{yyyy}-'),
        ('customer_payment', 'RCPT', 'RCPT-{yyyy}-'),
        ('vendor_payment', 'VPAY', 'VPAY-{yyyy}-')
) v(DocumentType, SeriesCode, PrefixFormat)
WHERE b.BranchCode = 'HO';

INSERT INTO dbo.StockMovementTypes (MovementTypeCode, MovementTypeName, Direction)
VALUES
    ('purchase_receipt', N'รับเข้าจากการซื้อ', 'in'),
    ('production_issue', N'เบิกวัตถุดิบเข้าผลิต', 'out'),
    ('production_receipt', N'รับเข้าสินค้าจากการผลิต', 'in'),
    ('sales_shipment', N'ตัดออกจากการขาย/ส่งสินค้า', 'out'),
    ('transfer', N'โอนย้ายคลัง/ตำแหน่งจัดเก็บ', 'transfer'),
    ('adjustment_in', N'ปรับปรุงรับเข้า', 'adjustment'),
    ('adjustment_out', N'ปรับปรุงตัดออก', 'adjustment');

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
VALUES ('REAM', N'รีม'), ('PALLET', N'พาเลท'), ('PCS', N'ชิ้น'), ('SHEET', N'แผ่น'), ('SQM', N'ตารางเมตร'), ('M3', N'ลูกบาศก์เมตร');

INSERT INTO dbo.UnitConversions (FromUnitId, ToUnitId, ConversionFactor)
SELECT fu.UnitId, tu.UnitId, 1.00000000
FROM dbo.Units fu
JOIN dbo.Units tu ON tu.UnitCode = fu.UnitCode;

INSERT INTO dbo.TaxCodes (TaxCode, TaxName, TaxRatePercent, IsDefault)
VALUES ('VAT7', N'ภาษีมูลค่าเพิ่ม 7%', 7.0000, 1), ('VAT0', N'ไม่มีภาษี', 0.0000, 0);

INSERT INTO dbo.PricingMethods (PricingMethodCode, PricingMethodName, Description)
VALUES
    ('FIXED_PRICE', N'Fixed Price', N'ใช้ราคาขายมาตรฐานของสินค้า หรือราคาที่กำหนดไว้ใน price list/สัญญา'),
    ('COST_PLUS', N'Cost Plus', N'คำนวณราคาขายจากต้นทุนสินค้า บวก markup ตามเปอร์เซ็นต์ที่กำหนด'),
    ('MARGIN_BASED', N'Margin Based', N'คำนวณราคาขายจากต้นทุนสินค้า เพื่อให้ได้ margin ตามเปอร์เซ็นต์เป้าหมาย'),
    ('LOT_BASED', N'Lot-Based', N'กำหนดราคาตาม lot/batch โดยอ้างอิงต้นทุนหรือราคาของ lot นั้น');

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
