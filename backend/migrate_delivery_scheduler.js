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

    // 1. Create DeliveryReservations table
    console.log('Creating dbo.DeliveryReservations table if not exists...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.DeliveryReservations') AND type in (N'U'))
      BEGIN
          CREATE TABLE dbo.DeliveryReservations (
              ReservationId INT IDENTITY(1,1) PRIMARY KEY,
              VehicleId INT NOT NULL,
              ReservationDate DATE NOT NULL,
              SlotNumber INT NOT NULL,
              Status NVARCHAR(30) NOT NULL,
              ReservedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
              DeliveryStartDateTime DATETIME2 NOT NULL,
              SalesOrderId INT NULL,
              CONSTRAINT FK_DeliveryReservations_Vehicles FOREIGN KEY (VehicleId) REFERENCES dbo.Vehicles(VehicleId),
              CONSTRAINT UQ_DeliveryReservations_Slot UNIQUE (VehicleId, ReservationDate, SlotNumber)
          );
          PRINT 'dbo.DeliveryReservations table created.';
      END
      ELSE
      BEGIN
          PRINT 'dbo.DeliveryReservations table already exists.';
      END
    `);

    // 2. Add DeliveryReservationId to SalesOrders table
    console.log('Adding DeliveryReservationId column to dbo.SalesOrders if not exists...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.SalesOrders') AND name = 'DeliveryReservationId')
      BEGIN
          ALTER TABLE dbo.SalesOrders ADD DeliveryReservationId INT NULL;
          PRINT 'DeliveryReservationId column successfully added to dbo.SalesOrders.';
      END
      ELSE
      BEGIN
          PRINT 'DeliveryReservationId column already exists in dbo.SalesOrders.';
      END
    `);

    // 3. Add FK constraint from SalesOrders to DeliveryReservations
    console.log('Checking for FK_SalesOrders_DeliveryReservations constraint...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_SalesOrders_DeliveryReservations')
      BEGIN
          ALTER TABLE dbo.SalesOrders ADD CONSTRAINT FK_SalesOrders_DeliveryReservations FOREIGN KEY (DeliveryReservationId) REFERENCES dbo.DeliveryReservations(ReservationId);
          PRINT 'FK_SalesOrders_DeliveryReservations constraint successfully added.';
      END
      ELSE
      BEGIN
          PRINT 'FK_SalesOrders_DeliveryReservations constraint already exists.';
      END
    `);

    // 4. Add FK constraint from DeliveryReservations to SalesOrders
    console.log('Checking for FK_DeliveryReservations_SalesOrders constraint...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_DeliveryReservations_SalesOrders')
      BEGIN
          ALTER TABLE dbo.DeliveryReservations ADD CONSTRAINT FK_DeliveryReservations_SalesOrders FOREIGN KEY (SalesOrderId) REFERENCES dbo.SalesOrders(SalesOrderId) ON DELETE SET NULL;
          PRINT 'FK_DeliveryReservations_SalesOrders constraint successfully added.';
      END
      ELSE
      BEGIN
          PRINT 'FK_DeliveryReservations_SalesOrders constraint already exists.';
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
