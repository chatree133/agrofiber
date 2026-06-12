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

    console.log('Creating dbo.SystemSettings table if not exists...');
    await request.query(`
      IF OBJECT_ID('dbo.SystemSettings', 'U') IS NULL
      BEGIN
          CREATE TABLE dbo.SystemSettings (
              SettingKey VARCHAR(100) NOT NULL PRIMARY KEY,
              SettingValue NVARCHAR(MAX) NULL,
              SettingGroup VARCHAR(50) NOT NULL,
              Description NVARCHAR(500) NULL,
              UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
              UpdatedBy NVARCHAR(100) NULL
          );
          PRINT 'Table dbo.SystemSettings created successfully.';
      END
      ELSE
      BEGIN
          PRINT 'Table dbo.SystemSettings already exists.';
      END
    `);

    console.log('Seeding initial GOOGLE_MAPS_KEY record if not exists...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.SystemSettings WHERE SettingKey = 'GOOGLE_MAPS_KEY')
      BEGIN
          INSERT INTO dbo.SystemSettings (SettingKey, SettingValue, SettingGroup, Description)
          VALUES ('GOOGLE_MAPS_KEY', '', 'GoogleMaps', 'Google Maps API Key for address auto-completion and map rendering');
          PRINT 'Seeded GOOGLE_MAPS_KEY successfully.';
      END
      ELSE
      BEGIN
          PRINT 'GOOGLE_MAPS_KEY record already exists.';
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
