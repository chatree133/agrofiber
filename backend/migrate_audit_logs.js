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

    console.log('Checking for dbo.AuditLogs table...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE object_id = OBJECT_ID('dbo.AuditLogs'))
      BEGIN
          CREATE TABLE dbo.AuditLogs (
              AuditLogId BIGINT IDENTITY(1,1) PRIMARY KEY,
              Timestamp DATETIME2 DEFAULT GETDATE(),
              UserId INT NULL,
              Username NVARCHAR(100) NULL,
              Module NVARCHAR(50) NOT NULL,
              ActionType NVARCHAR(30) NOT NULL,
              TargetId NVARCHAR(100) NULL,
              Description NVARCHAR(1000) NOT NULL,
              OldValues NVARCHAR(MAX) NULL,
              NewValues NVARCHAR(MAX) NULL,
              IpAddress NVARCHAR(45) NULL,
              CONSTRAINT FK_AuditLogs_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId)
          );

          CREATE NONCLUSTERED INDEX IX_AuditLogs_Timestamp ON dbo.AuditLogs(Timestamp DESC);
          CREATE NONCLUSTERED INDEX IX_AuditLogs_Module ON dbo.AuditLogs(Module);
          PRINT 'dbo.AuditLogs table and indexes successfully created.';
      END
      ELSE
      BEGIN
          PRINT 'dbo.AuditLogs table already exists.';
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
