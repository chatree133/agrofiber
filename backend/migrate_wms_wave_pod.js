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

    // 1. Create WmsWaves table
    console.log('Creating dbo.WmsWaves table if not exists...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.WmsWaves') AND type in (N'U'))
      BEGIN
          CREATE TABLE dbo.WmsWaves (
              WmsWaveId INT IDENTITY(1,1) PRIMARY KEY,
              WaveNo NVARCHAR(50) NOT NULL UNIQUE,
              Status NVARCHAR(30) NOT NULL DEFAULT 'open',
              CreatedBy INT NOT NULL,
              CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
              CompletedAt DATETIME2 NULL,
              CONSTRAINT FK_WmsWaves_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId)
          );
          PRINT 'dbo.WmsWaves table created successfully.';
      END
      ELSE
      BEGIN
          PRINT 'dbo.WmsWaves table already exists.';
      END
    `);

    // 2. Add WaveId to WmsTasks
    console.log('Adding WaveId column to dbo.WmsTasks...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.WmsTasks') AND name = 'WaveId')
      BEGIN
          ALTER TABLE dbo.WmsTasks ADD WaveId INT NULL;
          ALTER TABLE dbo.WmsTasks ADD CONSTRAINT FK_WmsTasks_WmsWaves FOREIGN KEY (WaveId) REFERENCES dbo.WmsWaves(WmsWaveId);
          PRINT 'WaveId column and foreign key added to dbo.WmsTasks.';
      END
      ELSE
      BEGIN
          PRINT 'WaveId column already exists in dbo.WmsTasks.';
      END
    `);

    // 3. Create ProofOfDeliveries table
    console.log('Creating dbo.ProofOfDeliveries table if not exists...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.ProofOfDeliveries') AND type in (N'U'))
      BEGIN
          CREATE TABLE dbo.ProofOfDeliveries (
              PodId INT IDENTITY(1,1) PRIMARY KEY,
              DeliveryOrderId INT NOT NULL UNIQUE,
              PodNo NVARCHAR(50) NOT NULL UNIQUE,
              DeliveryStatus NVARCHAR(30) NOT NULL,
              ActualDeliveryDate DATETIME2 NOT NULL,
              RecipientName NVARCHAR(255) NULL,
              SignatureUrl NVARCHAR(500) NULL,
              PhotoUrl NVARCHAR(500) NULL,
              Remarks NVARCHAR(1000) NULL,
              CreatedBy INT NOT NULL,
              CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
              CONSTRAINT FK_POD_DeliveryOrders FOREIGN KEY (DeliveryOrderId) REFERENCES dbo.DeliveryOrders(DeliveryOrderId),
              CONSTRAINT FK_POD_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId)
          );
          PRINT 'dbo.ProofOfDeliveries table created successfully.';
      END
      ELSE
      BEGIN
          PRINT 'dbo.ProofOfDeliveries table already exists.';
      END
    `);

    // 4. Insert Document Statuses for DO and INV
    console.log('Updating DocumentStatuses for DO...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.DocumentStatuses WHERE DocumentType = 'DO' AND StatusCode = 'delivered')
      BEGIN
          INSERT INTO dbo.DocumentStatuses (DocumentType, StatusCode, StatusName, IsTerminal, SortOrder)
          VALUES ('DO', 'delivered', N'ส่งมอบแล้ว', 0, 25);
          PRINT 'Status "delivered" added for DO.';
      END
      IF NOT EXISTS (SELECT 1 FROM dbo.DocumentStatuses WHERE DocumentType = 'DO' AND StatusCode = 'partial_delivered')
      BEGIN
          INSERT INTO dbo.DocumentStatuses (DocumentType, StatusCode, StatusName, IsTerminal, SortOrder)
          VALUES ('DO', 'partial_delivered', N'ส่งมอบบางส่วน', 0, 27);
          PRINT 'Status "partial_delivered" added for DO.';
      END
    `);

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
