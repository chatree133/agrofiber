import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config({ path: '/Users/chatreekueakachai/Job/Web dev/agrofiber/backend/.env' });

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
  },
};

console.log('Connecting to database...');

async function run() {
  const pool = await sql.connect(config);
  console.log('Connected to MS SQL Server.');

  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    const request = new sql.Request(tx);

    // 1. Vehicles table
    console.log('Creating dbo.Vehicles table...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.Vehicles') AND type in (N'U'))
      BEGIN
          CREATE TABLE dbo.Vehicles (
              VehicleId INT IDENTITY(1,1) PRIMARY KEY,
              LicensePlate NVARCHAR(30) NOT NULL UNIQUE,
              VehicleType NVARCHAR(50) NOT NULL,
              MaxWeightKg DECIMAL(18,4) NOT NULL,
              MaxVolumeCbm DECIMAL(18,4) NOT NULL,
              WorkingStart TIME(0) NULL,
              WorkingEnd TIME(0) NULL,
              IsActive BIT NOT NULL DEFAULT 1
          );
          PRINT 'dbo.Vehicles table created.';
      END
    `);

    // 2. Drivers table
    console.log('Creating dbo.Drivers table...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.Drivers') AND type in (N'U'))
      BEGIN
          CREATE TABLE dbo.Drivers (
              DriverId INT IDENTITY(1,1) PRIMARY KEY,
              UserId INT NOT NULL,
              DriverName NVARCHAR(200) NOT NULL,
              Phone NVARCHAR(30) NULL,
              PreferredProvince NVARCHAR(100) NULL,
              IsActive BIT NOT NULL DEFAULT 1,
              CONSTRAINT FK_Drivers_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId)
          );
          PRINT 'dbo.Drivers table created.';
      END
    `);

    // 3. WmsLoadPlans table
    console.log('Creating dbo.WmsLoadPlans table...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.WmsLoadPlans') AND type in (N'U'))
      BEGIN
          CREATE TABLE dbo.WmsLoadPlans (
              LoadPlanId INT IDENTITY(1,1) PRIMARY KEY,
              LoadPlanNo NVARCHAR(50) NOT NULL UNIQUE,
              PlanDate DATE NOT NULL,
              VehicleId INT NOT NULL,
              DriverId INT NOT NULL,
              Status NVARCHAR(30) NOT NULL DEFAULT 'draft',
              TotalWeightKg DECIMAL(18,4) NOT NULL DEFAULT 0,
              TotalVolumeCbm DECIMAL(18,4) NOT NULL DEFAULT 0,
              Remarks NVARCHAR(1000) NULL,
              CreatedBy INT NOT NULL,
              CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
              CONSTRAINT FK_WmsLoadPlans_Vehicles FOREIGN KEY (VehicleId) REFERENCES dbo.Vehicles(VehicleId),
              CONSTRAINT FK_WmsLoadPlans_Drivers FOREIGN KEY (DriverId) REFERENCES dbo.Drivers(DriverId),
              CONSTRAINT FK_WmsLoadPlans_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId)
          );
          PRINT 'dbo.WmsLoadPlans table created.';
      END
    `);

    // 4. WmsLoadPlanLines table
    console.log('Creating dbo.WmsLoadPlanLines table...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.WmsLoadPlanLines') AND type in (N'U'))
      BEGIN
          CREATE TABLE dbo.WmsLoadPlanLines (
              LoadPlanLineId BIGINT IDENTITY(1,1) PRIMARY KEY,
              LoadPlanId INT NOT NULL,
              DeliveryOrderId INT NOT NULL,
              StopSequence INT NOT NULL,
              DeliveryStatus NVARCHAR(30) NOT NULL DEFAULT 'pending',
              CONSTRAINT FK_WmsLoadPlanLines_WmsLoadPlans FOREIGN KEY (LoadPlanId) REFERENCES dbo.WmsLoadPlans(LoadPlanId) ON DELETE CASCADE,
              CONSTRAINT FK_WmsLoadPlanLines_DeliveryOrders FOREIGN KEY (DeliveryOrderId) REFERENCES dbo.DeliveryOrders(DeliveryOrderId)
          );
          PRINT 'dbo.WmsLoadPlanLines table created.';
      END
    `);

    // 5. Add DeliveryType to SalesOrders
    console.log('Checking DeliveryType on SalesOrders...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.SalesOrders') AND name = 'DeliveryType')
      BEGIN
          ALTER TABLE dbo.SalesOrders ADD DeliveryType NVARCHAR(30) NULL DEFAULT 'delivery';
          PRINT 'DeliveryType column added to dbo.SalesOrders.';
      END
    `);

    // 6. Add DeliveryType to DeliveryOrders
    console.log('Checking DeliveryType on DeliveryOrders...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.DeliveryOrders') AND name = 'DeliveryType')
      BEGIN
          ALTER TABLE dbo.DeliveryOrders ADD DeliveryType NVARCHAR(30) NULL DEFAULT 'delivery';
          PRINT 'DeliveryType column added to dbo.DeliveryOrders.';
      END
    `);

    // Seed mock data for Vehicles if empty
    const vCheck = await request.query(`SELECT COUNT(1) AS cnt FROM dbo.Vehicles`);
    if (vCheck.recordset[0].cnt === 0) {
      console.log('Seeding vehicles...');
      await request.query(`
        INSERT INTO dbo.Vehicles (LicensePlate, VehicleType, MaxWeightKg, MaxVolumeCbm, IsActive) VALUES
        (N'1กข-1234', N'4-Wheel Pick Up', 1500.0, 10.0, 1),
        (N'2คฆ-5678', N'6-Wheel Medium Truck', 4500.0, 25.0, 1),
        (N'3งจ-9012', N'10-Wheel Heavy Truck', 15000.0, 50.0, 1)
      `);
      console.log('Vehicles seeded.');
    }

    // Seed drivers if empty
    const dCheck = await request.query(`SELECT COUNT(1) AS cnt FROM dbo.Drivers`);
    if (dCheck.recordset[0].cnt === 0) {
      console.log('Seeding drivers based on existing users...');
      const usersRes = await request.query(`SELECT TOP 5 UserId, DisplayName FROM dbo.Users ORDER BY UserId`);
      if (usersRes.recordset.length > 0) {
        for (const u of usersRes.recordset) {
          const checkDrv = await request.query(`SELECT 1 FROM dbo.Drivers WHERE UserId = ${u.UserId}`);
          if (checkDrv.recordset.length === 0) {
            await request.query(`
              INSERT INTO dbo.Drivers (UserId, DriverName, Phone, PreferredProvince, IsActive)
              VALUES (${u.UserId}, N'Driver ${u.DisplayName}', '081-234-5678', N'กรุงเทพมหานคร', 1)
            `);
          }
        }
        console.log('Drivers seeded.');
      } else {
        console.log('No users found in database to map as drivers.');
      }
    }

    await tx.commit();
    console.log('Database migration successfully committed!');
  } catch (err) {
    await tx.rollback();
    console.error('Migration failed, rolled back:', err);
    process.exit(1);
  } finally {
    await pool.close();
  }
}

run().catch((err) => {
  console.error('Migration execution failed:', err);
  process.exit(1);
});
