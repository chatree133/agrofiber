import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

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

const waveIdInput = process.argv[2];
if (!waveIdInput) {
  console.error('Error: Please provide a Wave ID to reset.');
  console.log('Usage: node reset_wave.js <WaveId>');
  process.exit(1);
}

const waveId = parseInt(waveIdInput, 10);
if (isNaN(waveId)) {
  console.error('Error: Wave ID must be a number.');
  process.exit(1);
}

async function run() {
  console.log(`Connecting to database to reset Wave #${waveId}...`);
  const pool = await sql.connect(config);
  console.log('Connected.');

  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    // 1. Verify wave exists and is not completed
    const waveRes = await transaction.request()
      .input('waveId', sql.Int, waveId)
      .query('SELECT WaveNo, Status FROM dbo.WmsWaves WHERE WmsWaveId = @waveId');
    
    if (waveRes.recordset.length === 0) {
      throw new Error(`Wave #${waveId} not found.`);
    }
    const wave = waveRes.recordset[0];
    if (wave.Status === 'completed') {
      throw new Error(`Wave #${waveId} is already completed. Resetting a completed wave is unsafe.`);
    }

    // 2. Verify no tasks in this wave are completed
    const completedTasksRes = await transaction.request()
      .input('waveId', sql.Int, waveId)
      .query("SELECT COUNT(*) AS Cnt FROM dbo.WmsTasks WHERE WaveId = @waveId AND Status = 'completed'");
    if (completedTasksRes.recordset[0].Cnt > 0) {
      throw new Error(`Wave #${waveId} has completed tasks. Cannot reset.`);
    }

    // 3. Verify no lines in this wave have been picked (QuantityCompleted > 0)
    const completedQtyRes = await transaction.request()
      .input('waveId', sql.Int, waveId)
      .query(`
        SELECT COUNT(*) AS Cnt 
        FROM dbo.WmsTaskLines tl
        JOIN dbo.WmsTasks t ON t.WmsTaskId = tl.WmsTaskId
        WHERE t.WaveId = @waveId AND tl.QuantityCompleted > 0
      `);
    if (completedQtyRes.recordset[0].Cnt > 0) {
      throw new Error(`Wave #${waveId} has task lines with picked quantities. Cannot reset.`);
    }

    console.log(`Resetting Wave: ${wave.WaveNo} (Status: ${wave.Status})...`);

    // 4. Revert the reservation statuses back to 'open' if they are 'allocated'
    console.log('Reverting reservation statuses...');
    await transaction.request()
      .input('waveId', sql.Int, waveId)
      .query(`
        UPDATE dbo.InventoryReservations
        SET Status = 'open'
        WHERE InventoryReservationId IN (
            SELECT tl.InventoryReservationId
            FROM dbo.WmsTaskLines tl
            JOIN dbo.WmsTasks t ON t.WmsTaskId = tl.WmsTaskId
            WHERE t.WaveId = @waveId AND tl.InventoryReservationId IS NOT NULL
        ) AND Status = 'allocated'
      `);

    // 5. Merge split lines and clear FIFO allocations
    console.log('Merging split lines and clearing FIFO allocations...');
    await transaction.request()
      .input('waveId', sql.Int, waveId)
      .query(`
        WITH TaskLineGroups AS (
            SELECT 
                MIN(tl.WmsTaskLineId) as KeepLineId,
                SUM(tl.QuantityRequired) as TotalQtyRequired
            FROM dbo.WmsTaskLines tl
            JOIN dbo.WmsTasks t ON t.WmsTaskId = tl.WmsTaskId
            WHERE t.WaveId = @waveId
            GROUP BY tl.WmsTaskId, tl.ItemId, ISNULL(tl.ItemSpecId, 0), ISNULL(tl.InventoryReservationId, 0)
        )
        UPDATE tl
        SET 
            tl.QuantityRequired = g.TotalQtyRequired,
            tl.RequestedQuantity = g.TotalQtyRequired / NULLIF(ISNULL(tl.UnitConversionFactor, 1), 0),
            tl.FromLocationId = NULL,
            tl.LotId = NULL,
            tl.InventoryUnitId = NULL,
            tl.PalletNo = NULL
        FROM dbo.WmsTaskLines tl
        JOIN TaskLineGroups g ON tl.WmsTaskLineId = g.KeepLineId
      `);

    // 6. Delete the duplicate split lines
    console.log('Deleting split line records...');
    await transaction.request()
      .input('waveId', sql.Int, waveId)
      .query(`
        WITH TaskLineGroups AS (
            SELECT MIN(tl.WmsTaskLineId) as KeepLineId
            FROM dbo.WmsTaskLines tl
            JOIN dbo.WmsTasks t ON t.WmsTaskId = tl.WmsTaskId
            WHERE t.WaveId = @waveId
            GROUP BY tl.WmsTaskId, tl.ItemId, ISNULL(tl.ItemSpecId, 0), ISNULL(tl.InventoryReservationId, 0)
        )
        DELETE tl
        FROM dbo.WmsTaskLines tl
        JOIN dbo.WmsTasks t ON t.WmsTaskId = tl.WmsTaskId
        WHERE t.WaveId = @waveId
          AND tl.WmsTaskLineId NOT IN (SELECT KeepLineId FROM TaskLineGroups)
      `);

    // 7. Clean remaining task lines in this wave
    console.log('Clearing allocation from remaining task lines...');
    await transaction.request()
      .input('waveId', sql.Int, waveId)
      .query(`
        UPDATE tl
        SET 
            tl.FromLocationId = NULL,
            tl.LotId = NULL,
            tl.InventoryUnitId = NULL,
            tl.PalletNo = NULL
        FROM dbo.WmsTaskLines tl
        JOIN dbo.WmsTasks t ON t.WmsTaskId = tl.WmsTaskId
        WHERE t.WaveId = @waveId
      `);

    // 8. Dissociate tasks from the wave
    console.log('Dissociating tasks from the wave...');
    await transaction.request()
      .input('waveId', sql.Int, waveId)
      .query('UPDATE dbo.WmsTasks SET WaveId = NULL, ActionBy = NULL, ActionAt = NULL WHERE WaveId = @waveId');

    // 9. Delete the wave record
    console.log('Deleting wave header...');
    await transaction.request()
      .input('waveId', sql.Int, waveId)
      .query('DELETE FROM dbo.WmsWaves WHERE WmsWaveId = @waveId');

    await transaction.commit();
    console.log(`\nSUCCESS: Wave #${waveId} (${wave.WaveNo}) has been safely rolled back!`);
    console.log('Tasks are now unassociated and waiting in the queue to be wave-picked again.');

  } catch (err) {
    await transaction.rollback();
    console.error('\nERROR: Rollback failed. No changes were saved.', err.message);
  } finally {
    await pool.close();
  }
}

run();
