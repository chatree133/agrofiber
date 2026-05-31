import { Router } from 'express';
import { getMssqlPool, mssqlQuery, sql } from '../lib/mssql.js';
import { authenticate } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(authenticate);

const readRoles = allowRoles('admin', 'accounting', 'user', 'audit');
const writeRoles = allowRoles('admin', 'accounting', 'user');
const adminRoles = allowRoles('admin');

function parseId(value, name = 'id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error(`${name} must be a positive integer`);
    error.status = 400;
    throw error;
  }
  return id;
}

function mapContract(row) {
  return {
    id: row.CustomerPriceContractId,
    contractNo: row.ContractNo,
    customerId: row.CustomerId,
    customerCode: row.CustomerCode,
    customerName: row.CustomerName,
    contractName: row.ContractName,
    currencyCode: row.CurrencyCode,
    effectiveFrom: row.EffectiveFrom,
    effectiveTo: row.EffectiveTo,
    status: row.Status,
    createdAt: row.CreatedAt,
  };
}

function mapLine(row) {
  return {
    id: row.CustomerPriceContractLineId,
    contractId: row.CustomerPriceContractId,
    lineNum: row.LineNum,
    itemId: row.ItemId,
    itemCode: row.ItemCode,
    itemName: row.ItemName,
    unitId: row.UnitId,
    unitCode: row.UnitCode,
    unitPrice: row.UnitPrice,
    minQuantity: row.MinQuantity,
    maxQuantity: row.MaxQuantity,
  };
}

async function getContract(contractId) {
  const rows = await mssqlQuery('DEFAULT', `
    SELECT
      cpc.CustomerPriceContractId,
      cpc.ContractNo,
      cpc.CustomerId,
      c.CustomerCode,
      c.CustomerName,
      cpc.ContractName,
      cpc.CurrencyCode,
      cpc.EffectiveFrom,
      cpc.EffectiveTo,
      cpc.Status,
      cpc.CreatedAt
    FROM dbo.CustomerPriceContracts cpc
    JOIN dbo.Customers c ON c.CustomerId = cpc.CustomerId
    WHERE cpc.CustomerPriceContractId = @contractId
  `, {
    inputs: { contractId: { type: sql.Int, value: contractId } },
  });

  return rows[0] ? mapContract(rows[0]) : null;
}

router.get(
  '/',
  readRoles,
  asyncHandler(async (req, res) => {
    const page = Math.max(Number(req.query.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize || 20), 1), 100);
    const offset = (page - 1) * pageSize;
    const conditions = [];
    const inputs = {
      offset: { type: sql.Int, value: offset },
      pageSize: { type: sql.Int, value: pageSize },
    };

    if (req.query.customerId) {
      conditions.push('cpc.CustomerId = @customerId');
      inputs.customerId = { type: sql.Int, value: parseId(req.query.customerId, 'customerId') };
    }

    if (req.query.status) {
      conditions.push('cpc.Status = @status');
      inputs.status = { type: sql.NVarChar(30), value: req.query.status };
    }

    if (req.query.search) {
      conditions.push(`(
        cpc.ContractNo LIKE @search OR
        cpc.ContractName LIKE @search OR
        c.CustomerCode LIKE @search OR
        c.CustomerName LIKE @search
      )`);
      inputs.search = { type: sql.NVarChar(255), value: `%${req.query.search}%` };
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await mssqlQuery('DEFAULT', `
      WITH FilteredContracts AS (
        SELECT cpc.CustomerPriceContractId
        FROM dbo.CustomerPriceContracts cpc
        JOIN dbo.Customers c ON c.CustomerId = cpc.CustomerId
        ${whereSql}
      )
      SELECT
        cpc.CustomerPriceContractId,
        cpc.ContractNo,
        cpc.CustomerId,
        c.CustomerCode,
        c.CustomerName,
        cpc.ContractName,
        cpc.CurrencyCode,
        cpc.EffectiveFrom,
        cpc.EffectiveTo,
        cpc.Status,
        cpc.CreatedAt,
        (SELECT COUNT(1) FROM FilteredContracts) AS TotalCount
      FROM FilteredContracts fc
      JOIN dbo.CustomerPriceContracts cpc ON cpc.CustomerPriceContractId = fc.CustomerPriceContractId
      JOIN dbo.Customers c ON c.CustomerId = cpc.CustomerId
      ORDER BY cpc.EffectiveFrom DESC, cpc.ContractNo
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `, { inputs });

    res.json({
      data: rows.map(mapContract),
      pagination: {
        page,
        pageSize,
        total: rows[0]?.TotalCount || 0,
      },
    });
  }),
);

router.get(
  '/:id',
  readRoles,
  asyncHandler(async (req, res) => {
    const contractId = parseId(req.params.id, 'contractId');
    const contract = await getContract(contractId);

    if (!contract) {
      res.status(404).json({ message: 'Customer price contract not found' });
      return;
    }

    const lines = await mssqlQuery('DEFAULT', `
      SELECT
        cpcl.CustomerPriceContractLineId,
        cpcl.CustomerPriceContractId,
        cpcl.LineNum,
        cpcl.ItemId,
        i.ItemCode,
        i.ItemName,
        cpcl.UnitId,
        u.UnitCode,
        cpcl.UnitPrice,
        cpcl.MinQuantity,
        cpcl.MaxQuantity
      FROM dbo.CustomerPriceContractLines cpcl
      JOIN dbo.Items i ON i.ItemId = cpcl.ItemId
      JOIN dbo.Units u ON u.UnitId = cpcl.UnitId
      WHERE cpcl.CustomerPriceContractId = @contractId
      ORDER BY cpcl.LineNum
    `, {
      inputs: { contractId: { type: sql.Int, value: contractId } },
    });

    res.json({ data: { ...contract, lines: lines.map(mapLine) } });
  }),
);

router.post(
  '/',
  writeRoles,
  asyncHandler(async (req, res) => {
    const {
      contractNo,
      customerId,
      contractName = null,
      currencyCode = 'THB',
      effectiveFrom,
      effectiveTo,
      status = 'active',
      lines = [],
    } = req.body;

    if (!contractNo || !customerId || !effectiveFrom || !effectiveTo) {
      res.status(400).json({ message: 'contractNo, customerId, effectiveFrom and effectiveTo are required' });
      return;
    }

    const pool = await getMssqlPool('DEFAULT');
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const result = await transaction
        .request()
        .input('contractNo', sql.NVarChar(80), contractNo)
        .input('customerId', sql.Int, parseId(customerId, 'customerId'))
        .input('contractName', sql.NVarChar(255), contractName)
        .input('currencyCode', sql.Char(3), currencyCode)
        .input('effectiveFrom', sql.Date, effectiveFrom)
        .input('effectiveTo', sql.Date, effectiveTo)
        .input('status', sql.NVarChar(30), status).query(`
          INSERT INTO dbo.CustomerPriceContracts (
            ContractNo,
            CustomerId,
            ContractName,
            CurrencyCode,
            EffectiveFrom,
            EffectiveTo,
            Status
          )
          OUTPUT inserted.CustomerPriceContractId
          VALUES (
            @contractNo,
            @customerId,
            @contractName,
            @currencyCode,
            @effectiveFrom,
            @effectiveTo,
            @status
          )
        `);

      const contractId = result.recordset[0].CustomerPriceContractId;
      for (const [index, line] of lines.entries()) {
        await transaction
          .request()
          .input('contractId', sql.Int, contractId)
          .input('lineNum', sql.Int, line.lineNum || index + 1)
          .input('itemId', sql.Int, parseId(line.itemId, 'itemId'))
          .input('unitId', sql.Int, parseId(line.unitId, 'unitId'))
          .input('unitPrice', sql.Decimal(18, 4), line.unitPrice)
          .input('minQuantity', sql.Decimal(18, 4), line.minQuantity ?? null)
          .input('maxQuantity', sql.Decimal(18, 4), line.maxQuantity ?? null).query(`
            INSERT INTO dbo.CustomerPriceContractLines (
              CustomerPriceContractId,
              LineNum,
              ItemId,
              UnitId,
              UnitPrice,
              MinQuantity,
              MaxQuantity
            )
            VALUES (
              @contractId,
              @lineNum,
              @itemId,
              @unitId,
              @unitPrice,
              @minQuantity,
              @maxQuantity
            )
          `);
      }

      await transaction.commit();
      res.status(201).json({ data: await getContract(contractId) });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }),
);

router.put(
  '/:id',
  writeRoles,
  asyncHandler(async (req, res) => {
    const contractId = parseId(req.params.id, 'contractId');
    const fieldMap = [
      ['contractNo', 'ContractNo', sql.NVarChar(80)],
      ['customerId', 'CustomerId', sql.Int],
      ['contractName', 'ContractName', sql.NVarChar(255)],
      ['currencyCode', 'CurrencyCode', sql.Char(3)],
      ['effectiveFrom', 'EffectiveFrom', sql.Date],
      ['effectiveTo', 'EffectiveTo', sql.Date],
      ['status', 'Status', sql.NVarChar(30)],
    ];

    const updates = [];
    const inputs = { contractId: { type: sql.Int, value: contractId } };

    fieldMap.forEach(([bodyKey, column, type]) => {
      if (req.body[bodyKey] === undefined) return;
      updates.push(`${column} = @${bodyKey}`);
      inputs[bodyKey] = {
        type,
        value: bodyKey === 'customerId' ? parseId(req.body[bodyKey], 'customerId') : req.body[bodyKey],
      };
    });

    if (!updates.length) {
      res.status(400).json({ message: 'No fields to update' });
      return;
    }

    const rows = await mssqlQuery('DEFAULT', `
      UPDATE dbo.CustomerPriceContracts
      SET ${updates.join(', ')}
      WHERE CustomerPriceContractId = @contractId
      SELECT @@ROWCOUNT AS affected
    `, { inputs });

    if (!rows[0]?.affected) {
      res.status(404).json({ message: 'Customer price contract not found' });
      return;
    }

    res.json({ data: await getContract(contractId) });
  }),
);

router.patch(
  '/:id/status',
  writeRoles,
  asyncHandler(async (req, res) => {
    const contractId = parseId(req.params.id, 'contractId');
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ message: 'status is required' });
      return;
    }

    const rows = await mssqlQuery('DEFAULT', `
      UPDATE dbo.CustomerPriceContracts
      SET Status = @status
      WHERE CustomerPriceContractId = @contractId
      SELECT @@ROWCOUNT AS affected
    `, {
      inputs: {
        contractId: { type: sql.Int, value: contractId },
        status: { type: sql.NVarChar(30), value: status },
      },
    });

    if (!rows[0]?.affected) {
      res.status(404).json({ message: 'Customer price contract not found' });
      return;
    }

    res.json({ data: await getContract(contractId) });
  }),
);

router.delete(
  '/:id',
  adminRoles,
  asyncHandler(async (req, res) => {
    const contractId = parseId(req.params.id, 'contractId');
    const rows = await mssqlQuery('DEFAULT', `
      UPDATE dbo.CustomerPriceContracts
      SET Status = 'cancelled'
      WHERE CustomerPriceContractId = @contractId
      SELECT @@ROWCOUNT AS affected
    `, {
      inputs: { contractId: { type: sql.Int, value: contractId } },
    });

    if (!rows[0]?.affected) {
      res.status(404).json({ message: 'Customer price contract not found' });
      return;
    }

    res.status(204).send();
  }),
);

router.get(
  '/:id/lines',
  readRoles,
  asyncHandler(async (req, res) => {
    const contractId = parseId(req.params.id, 'contractId');
    const rows = await mssqlQuery('DEFAULT', `
      SELECT
        cpcl.CustomerPriceContractLineId,
        cpcl.CustomerPriceContractId,
        cpcl.LineNum,
        cpcl.ItemId,
        i.ItemCode,
        i.ItemName,
        cpcl.UnitId,
        u.UnitCode,
        cpcl.UnitPrice,
        cpcl.MinQuantity,
        cpcl.MaxQuantity
      FROM dbo.CustomerPriceContractLines cpcl
      JOIN dbo.Items i ON i.ItemId = cpcl.ItemId
      JOIN dbo.Units u ON u.UnitId = cpcl.UnitId
      WHERE cpcl.CustomerPriceContractId = @contractId
      ORDER BY cpcl.LineNum
    `, {
      inputs: { contractId: { type: sql.Int, value: contractId } },
    });

    res.json({ data: rows.map(mapLine) });
  }),
);

router.post(
  '/:id/lines',
  writeRoles,
  asyncHandler(async (req, res) => {
    const contractId = parseId(req.params.id, 'contractId');
    const {
      lineNum,
      itemId,
      unitId,
      unitPrice,
      minQuantity = null,
      maxQuantity = null,
    } = req.body;

    if (!itemId || !unitId || unitPrice === undefined) {
      res.status(400).json({ message: 'itemId, unitId and unitPrice are required' });
      return;
    }

    const result = await mssqlQuery('DEFAULT', `
      INSERT INTO dbo.CustomerPriceContractLines (
        CustomerPriceContractId,
        LineNum,
        ItemId,
        UnitId,
        UnitPrice,
        MinQuantity,
        MaxQuantity
      )
      OUTPUT inserted.CustomerPriceContractLineId
      VALUES (
        @contractId,
        COALESCE(@lineNum, (
          SELECT ISNULL(MAX(LineNum), 0) + 1
          FROM dbo.CustomerPriceContractLines
          WHERE CustomerPriceContractId = @contractId
        )),
        @itemId,
        @unitId,
        @unitPrice,
        @minQuantity,
        @maxQuantity
      )
    `, {
      inputs: {
        contractId: { type: sql.Int, value: contractId },
        lineNum: { type: sql.Int, value: lineNum ?? null },
        itemId: { type: sql.Int, value: parseId(itemId, 'itemId') },
        unitId: { type: sql.Int, value: parseId(unitId, 'unitId') },
        unitPrice: { type: sql.Decimal(18, 4), value: unitPrice },
        minQuantity: { type: sql.Decimal(18, 4), value: minQuantity },
        maxQuantity: { type: sql.Decimal(18, 4), value: maxQuantity },
      },
    });

    const rows = await mssqlQuery('DEFAULT', `
      SELECT
        cpcl.CustomerPriceContractLineId,
        cpcl.CustomerPriceContractId,
        cpcl.LineNum,
        cpcl.ItemId,
        i.ItemCode,
        i.ItemName,
        cpcl.UnitId,
        u.UnitCode,
        cpcl.UnitPrice,
        cpcl.MinQuantity,
        cpcl.MaxQuantity
      FROM dbo.CustomerPriceContractLines cpcl
      JOIN dbo.Items i ON i.ItemId = cpcl.ItemId
      JOIN dbo.Units u ON u.UnitId = cpcl.UnitId
      WHERE cpcl.CustomerPriceContractLineId = @lineId
    `, {
      inputs: { lineId: { type: sql.Int, value: result[0].CustomerPriceContractLineId } },
    });

    res.status(201).json({ data: mapLine(rows[0]) });
  }),
);

router.put(
  '/:id/lines/:lineId',
  writeRoles,
  asyncHandler(async (req, res) => {
    const contractId = parseId(req.params.id, 'contractId');
    const lineId = parseId(req.params.lineId, 'lineId');
    const fieldMap = [
      ['lineNum', 'LineNum', sql.Int],
      ['itemId', 'ItemId', sql.Int],
      ['unitId', 'UnitId', sql.Int],
      ['unitPrice', 'UnitPrice', sql.Decimal(18, 4)],
      ['minQuantity', 'MinQuantity', sql.Decimal(18, 4)],
      ['maxQuantity', 'MaxQuantity', sql.Decimal(18, 4)],
    ];

    const updates = [];
    const inputs = {
      contractId: { type: sql.Int, value: contractId },
      lineId: { type: sql.Int, value: lineId },
    };

    fieldMap.forEach(([bodyKey, column, type]) => {
      if (req.body[bodyKey] === undefined) return;
      updates.push(`${column} = @${bodyKey}`);
      inputs[bodyKey] = { type, value: req.body[bodyKey] };
    });

    if (!updates.length) {
      res.status(400).json({ message: 'No fields to update' });
      return;
    }

    const rows = await mssqlQuery('DEFAULT', `
      UPDATE dbo.CustomerPriceContractLines
      SET ${updates.join(', ')}
      WHERE CustomerPriceContractId = @contractId
        AND CustomerPriceContractLineId = @lineId
      SELECT @@ROWCOUNT AS affected
    `, { inputs });

    if (!rows[0]?.affected) {
      res.status(404).json({ message: 'Customer price contract line not found' });
      return;
    }

    const lineRows = await mssqlQuery('DEFAULT', `
      SELECT
        cpcl.CustomerPriceContractLineId,
        cpcl.CustomerPriceContractId,
        cpcl.LineNum,
        cpcl.ItemId,
        i.ItemCode,
        i.ItemName,
        cpcl.UnitId,
        u.UnitCode,
        cpcl.UnitPrice,
        cpcl.MinQuantity,
        cpcl.MaxQuantity
      FROM dbo.CustomerPriceContractLines cpcl
      JOIN dbo.Items i ON i.ItemId = cpcl.ItemId
      JOIN dbo.Units u ON u.UnitId = cpcl.UnitId
      WHERE cpcl.CustomerPriceContractLineId = @lineId
    `, {
      inputs: { lineId: { type: sql.Int, value: lineId } },
    });

    res.json({ data: mapLine(lineRows[0]) });
  }),
);

router.delete(
  '/:id/lines/:lineId',
  writeRoles,
  asyncHandler(async (req, res) => {
    const contractId = parseId(req.params.id, 'contractId');
    const lineId = parseId(req.params.lineId, 'lineId');
    const rows = await mssqlQuery('DEFAULT', `
      DELETE FROM dbo.CustomerPriceContractLines
      WHERE CustomerPriceContractId = @contractId
        AND CustomerPriceContractLineId = @lineId
      SELECT @@ROWCOUNT AS affected
    `, {
      inputs: {
        contractId: { type: sql.Int, value: contractId },
        lineId: { type: sql.Int, value: lineId },
      },
    });

    if (!rows[0]?.affected) {
      res.status(404).json({ message: 'Customer price contract line not found' });
      return;
    }

    res.status(204).send();
  }),
);

export default router;
