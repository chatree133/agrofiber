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

    console.log('Creating dbo.WarehouseIncidents table if not exists...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.WarehouseIncidents') AND type in (N'U'))
      BEGIN
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
          PRINT 'dbo.WarehouseIncidents table created successfully.';
      END
      ELSE
      BEGIN
          PRINT 'dbo.WarehouseIncidents table already exists.';
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
