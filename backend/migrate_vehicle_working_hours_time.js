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

    // 1. Drop the old NVARCHAR WorkingHours column if it exists
    console.log('Checking for old WorkingHours column...');
    await request.query(`
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Vehicles') AND name = 'WorkingHours')
      BEGIN
          ALTER TABLE dbo.Vehicles DROP COLUMN WorkingHours;
          PRINT 'Old WorkingHours column dropped.';
      END
      ELSE
      BEGIN
          PRINT 'Old WorkingHours column did not exist.';
      END
    `);

    // 2. Add WorkingStart column
    console.log('Checking for WorkingStart column...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Vehicles') AND name = 'WorkingStart')
      BEGIN
          ALTER TABLE dbo.Vehicles ADD WorkingStart TIME(0) NULL;
          PRINT 'WorkingStart column successfully added to dbo.Vehicles.';
      END
      ELSE
      BEGIN
          PRINT 'WorkingStart column already exists in dbo.Vehicles.';
      END
    `);

    // 3. Add WorkingEnd column
    console.log('Checking for WorkingEnd column...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Vehicles') AND name = 'WorkingEnd')
      BEGIN
          ALTER TABLE dbo.Vehicles ADD WorkingEnd TIME(0) NULL;
          PRINT 'WorkingEnd column successfully added to dbo.Vehicles.';
      END
      ELSE
      BEGIN
          PRINT 'WorkingEnd column already exists in dbo.Vehicles.';
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
