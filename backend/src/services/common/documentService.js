import { sql, mssqlTransaction } from '../../lib/mssql.js';

export const documentService = {
  /**
   * สร้างเลขที่เอกสารอัตโนมัติ ภายใต้ Transaction เพื่อป้องกันเลขซ้ำ (Concurrency Safe)
   * @param {Object} tx - Database Transaction
   * @param {String} documentType - 'SO', 'PO', 'GI', etc.
   * @param {Number|null} branchId - Optional BranchId
   * @param {Date} date - Document Date to determine the period
   * @returns {Promise<String>} Generated Document Number
   */
  async generateDocumentNumber(tx, documentType, branchId = null, date = new Date()) {
    // 1. หา DocumentSeries ที่ตรงกับ DocumentType (และ Branch)
    const seriesReq = new sql.Request(tx);
    seriesReq.input('docType', sql.NVarChar(40), documentType);
    seriesReq.input('branchId', sql.Int, branchId);

    // หา Series ที่ตรงกับ BranchId ก่อน ถ้าไม่เจอ เอาตัวที่เป็น Default (BranchId IS NULL)
    const seriesRes = await seriesReq.query(`
      SELECT TOP 1 DocumentSeriesId, PrefixFormat, PaddingLength, ResetFrequency
      FROM dbo.DocumentSeries
      WHERE DocumentType = @docType AND IsActive = 1
        AND (BranchId = @branchId OR BranchId IS NULL)
      ORDER BY 
        CASE WHEN BranchId = @branchId THEN 1 ELSE 2 END ASC
    `);

    if (seriesRes.recordset.length === 0) {
      throw new Error(`No active Document Series found for type: ${documentType}`);
    }

    const series = seriesRes.recordset[0];
    const seriesId = series.DocumentSeriesId;

    // 2. คำนวณ PeriodKey ตาม ResetFrequency
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const shortYear = String(year).slice(-2);

    let periodKey = 'ALL';
    if (series.ResetFrequency === 'yearly') periodKey = `${year}`;
    else if (series.ResetFrequency === 'monthly') periodKey = `${year}${month}`;
    else if (series.ResetFrequency === 'daily') periodKey = `${year}${month}${day}`;

    // 3. จัดการ Counter อย่างปลอดภัยด้วย MERGE & OUTPUT (Atomic Operation)
    const counterReq = new sql.Request(tx);
    counterReq.input('seriesId', sql.Int, seriesId);
    counterReq.input('periodKey', sql.NVarChar(20), periodKey);

    const counterRes = await counterReq.query(`
      MERGE INTO dbo.DocumentNumberCounters WITH (UPDLOCK, SERIALIZABLE) AS target
      USING (SELECT @seriesId AS SeriesId, @periodKey AS PeriodKey) AS source
      ON target.DocumentSeriesId = source.SeriesId AND target.PeriodKey = source.PeriodKey
      WHEN MATCHED THEN
        UPDATE SET LastNumber = target.LastNumber + 1, UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (DocumentSeriesId, PeriodKey, LastNumber)
        VALUES (source.SeriesId, source.PeriodKey, 1)
      OUTPUT INSERTED.LastNumber;
    `);

    const lastNumber = counterRes.recordset[0].LastNumber;

    // 4. สร้าง Document Number
    // ตัวอย่าง PrefixFormat: 'SO-{YY}{MM}-' -> 'SO-2605-'
    let prefix = series.PrefixFormat;
    prefix = prefix.replace(/\{YYYY\}/ig, year);
    prefix = prefix.replace(/\{YY\}/ig, shortYear);
    prefix = prefix.replace(/\{MM\}/ig, month);
    prefix = prefix.replace(/\{DD\}/ig, day);

    const paddedNumber = String(lastNumber).padStart(series.PaddingLength, '0');

    return `${prefix}${paddedNumber}`;
  }
};
