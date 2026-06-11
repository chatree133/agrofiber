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

    console.log('Adding WorkingHours to dbo.Vehicles...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Vehicles') AND name = 'WorkingHours')
      BEGIN
          ALTER TABLE dbo.Vehicles ADD WorkingHours NVARCHAR(100) NULL;
          PRINT 'WorkingHours column successfully added to dbo.Vehicles.';
      END
      ELSE
      BEGIN
          PRINT 'WorkingHours column already exists in dbo.Vehicles.';
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
