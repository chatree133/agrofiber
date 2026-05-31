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

function parseBool(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

function mapCustomer(row) {
  if (!row) return null;
  return {
    id: row.CustomerId,
    code: row.CustomerCode,
    name: row.CustomerName,
    taxId: row.TaxId,
    priceListId: row.PriceListId,
    priceListCode: row.PriceListCode,
    priceListName: row.PriceListName,
    discountRuleId: row.DiscountRuleId,
    discountRuleCode: row.DiscountRuleCode,
    discountRuleName: row.DiscountRuleName,
    customerSegmentId: row.CustomerSegmentId,
    customerSegmentCode: row.CustomerSegmentCode,
    customerSegmentName: row.CustomerSegmentName,
    isActive: Boolean(row.IsActive),
  };
}

function mapAddress(row) {
  return {
    id: row.CustomerAddressId,
    customerId: row.CustomerId,
    code: row.AddressCode,
    branchCode: row.BranchCode,
    type: row.AddressType,
    contactName: row.ContactName,
    phone: row.Phone,
    addressLine1: row.AddressLine1,
    addressLine2: row.AddressLine2,
    district: row.District,
    province: row.Province,
    postalCode: row.PostalCode,
    countryCode: row.CountryCode,
    isDefault: Boolean(row.IsDefault),
    isActive: Boolean(row.IsActive),
  };
}

function mapContact(row) {
  return {
    id: row.CustomerContactId,
    customerId: row.CustomerId,
    name: row.ContactName,
    jobTitle: row.JobTitle,
    phone: row.Phone,
    email: row.Email,
    isPrimary: Boolean(row.IsPrimary),
    isActive: Boolean(row.IsActive),
  };
}

async function getCustomer(customerId) {
  const rows = await mssqlQuery('DEFAULT', `
    SELECT
      c.CustomerId,
      c.CustomerCode,
      c.CustomerName,
      c.TaxId,
      c.PriceListId,
      pl.PriceListCode,
      pl.PriceListName,
      c.DiscountRuleId,
      dr.DiscountRuleCode,
      dr.DiscountRuleName,
      c.CustomerSegmentId,
      cs.SegmentCode AS CustomerSegmentCode,
      cs.SegmentName AS CustomerSegmentName,
      c.IsActive
    FROM dbo.Customers c
    LEFT JOIN dbo.PriceLists pl ON pl.PriceListId = c.PriceListId
    LEFT JOIN dbo.DiscountRules dr ON dr.DiscountRuleId = c.DiscountRuleId
    LEFT JOIN dbo.CustomerSegments cs ON cs.CustomerSegmentId = c.CustomerSegmentId
    WHERE c.CustomerId = @customerId
  `, {
    inputs: { customerId: { type: sql.Int, value: customerId } },
  });

  return mapCustomer(rows[0]);
}

async function ensureCustomer(customerId) {
  const rows = await mssqlQuery('DEFAULT', `
    SELECT CustomerId
    FROM dbo.Customers
    WHERE CustomerId = @customerId
  `, {
    inputs: { customerId: { type: sql.Int, value: customerId } },
  });

  if (!rows.length) {
    const error = new Error('Customer not found');
    error.status = 404;
    throw error;
  }
}

function buildCustomerFilters(query) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const conditions = [];
  const inputs = {};

  if (query.search) {
    conditions.push(`(
      c.CustomerCode LIKE @search OR
      c.CustomerName LIKE @search OR
      c.TaxId LIKE @search OR
      EXISTS (
        SELECT 1 FROM dbo.CustomerContacts cc
        WHERE cc.CustomerId = c.CustomerId AND cc.Phone LIKE @search
      ) OR
      EXISTS (
        SELECT 1 FROM dbo.CustomerAddresses ca
        WHERE ca.CustomerId = c.CustomerId AND ca.Phone LIKE @search
      )
    )`);
    inputs.search = { type: sql.NVarChar(255), value: `%${query.search}%` };
  }

  if (query.isActive !== undefined && query.isActive !== '') {
    conditions.push('c.IsActive = @isActive');
    inputs.isActive = { type: sql.Bit, value: parseBool(query.isActive) };
  }

  return {
    page,
    pageSize,
    whereSql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    inputs,
  };
}

router.get(
  '/',
  readRoles,
  asyncHandler(async (req, res) => {
    const { page, pageSize, whereSql, inputs } = buildCustomerFilters(req.query);
    const offset = (page - 1) * pageSize;
    const rows = await mssqlQuery('DEFAULT', `
      WITH FilteredCustomers AS (
        SELECT c.CustomerId
        FROM dbo.Customers c
        ${whereSql}
      )
      SELECT
        c.CustomerId,
        c.CustomerCode,
        c.CustomerName,
        c.TaxId,
        c.PriceListId,
        pl.PriceListCode,
        pl.PriceListName,
        c.DiscountRuleId,
        dr.DiscountRuleCode,
        dr.DiscountRuleName,
        c.CustomerSegmentId,
        cs.SegmentCode AS CustomerSegmentCode,
        cs.SegmentName AS CustomerSegmentName,
        c.IsActive,
        (SELECT COUNT(1) FROM FilteredCustomers) AS TotalCount
      FROM FilteredCustomers fc
      JOIN dbo.Customers c ON c.CustomerId = fc.CustomerId
      LEFT JOIN dbo.PriceLists pl ON pl.PriceListId = c.PriceListId
      LEFT JOIN dbo.DiscountRules dr ON dr.DiscountRuleId = c.DiscountRuleId
      LEFT JOIN dbo.CustomerSegments cs ON cs.CustomerSegmentId = c.CustomerSegmentId
      ORDER BY c.CustomerCode
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `, {
      inputs: {
        ...inputs,
        offset: { type: sql.Int, value: offset },
        pageSize: { type: sql.Int, value: pageSize },
      },
    });

    res.json({
      data: rows.map(mapCustomer),
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
    const customerId = parseId(req.params.id, 'customerId');
    const customer = await getCustomer(customerId);

    if (!customer) {
      res.status(404).json({ message: 'Customer not found' });
      return;
    }

    const [addresses, contacts] = await Promise.all([
      mssqlQuery('DEFAULT', `
        SELECT *
        FROM dbo.CustomerAddresses
        WHERE CustomerId = @customerId
        ORDER BY IsDefault DESC, AddressCode
      `, { inputs: { customerId: { type: sql.Int, value: customerId } } }),
      mssqlQuery('DEFAULT', `
        SELECT *
        FROM dbo.CustomerContacts
        WHERE CustomerId = @customerId
        ORDER BY IsPrimary DESC, ContactName
      `, { inputs: { customerId: { type: sql.Int, value: customerId } } }),
    ]);

    res.json({
      data: {
        ...customer,
        addresses: addresses.map(mapAddress),
        contacts: contacts.map(mapContact),
      },
    });
  }),
);

router.post(
  '/',
  writeRoles,
  asyncHandler(async (req, res) => {
    const {
      customerName,
      name = customerName,
      taxId = null,
      priceListId = null,
      discountRuleId = null,
      customerSegmentId = null,
      isActive = true,
    } = req.body;

    if (!name) {
      res.status(400).json({ message: 'customerName is required' });
      return;
    }

    const pool = await getMssqlPool('DEFAULT');
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const seqRes = await transaction.request().query(`
        SELECT ISNULL(MAX(CAST(SUBSTRING(CustomerCode, 2, LEN(CustomerCode)) AS INT)), 0) + 1 AS NextSeq
        FROM dbo.Customers WITH (UPDLOCK, HOLDLOCK)
        WHERE CustomerCode LIKE 'C[0-9][0-9][0-9][0-9][0-9]'
      `);
      const nextSeq = seqRes.recordset[0].NextSeq;
      const generatedCode = 'C' + String(nextSeq).padStart(5, '0');

      const insertRes = await transaction.request()
        .input('customerCode', sql.NVarChar(50), generatedCode)
        .input('customerName', sql.NVarChar(255), name)
        .input('taxId', sql.NVarChar(50), taxId)
        .input('priceListId', sql.Int, priceListId === '' ? null : priceListId)
        .input('discountRuleId', sql.Int, discountRuleId === '' ? null : discountRuleId)
        .input('customerSegmentId', sql.Int, customerSegmentId === '' ? null : customerSegmentId)
        .input('isActive', sql.Bit, parseBool(isActive))
        .query(`
          INSERT INTO dbo.Customers (
            CustomerCode,
            CustomerName,
            TaxId,
            PriceListId,
            DiscountRuleId,
            CustomerSegmentId,
            IsActive
          )
          OUTPUT inserted.CustomerId
          VALUES (
            @customerCode,
            @customerName,
            @taxId,
            @priceListId,
            @discountRuleId,
            @customerSegmentId,
            @isActive
          )
        `);

      await transaction.commit();
      res.status(201).json({ data: await getCustomer(insertRes.recordset[0].CustomerId) });
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
    const customerId = parseId(req.params.id, 'customerId');
    const fieldMap = [
      ['customerCode', 'CustomerCode', sql.NVarChar(50)],
      ['code', 'CustomerCode', sql.NVarChar(50)],
      ['customerName', 'CustomerName', sql.NVarChar(255)],
      ['name', 'CustomerName', sql.NVarChar(255)],
      ['taxId', 'TaxId', sql.NVarChar(50)],
      ['priceListId', 'PriceListId', sql.Int],
      ['discountRuleId', 'DiscountRuleId', sql.Int],
      ['customerSegmentId', 'CustomerSegmentId', sql.Int],
      ['isActive', 'IsActive', sql.Bit],
    ];

    const updates = [];
    const inputs = { customerId: { type: sql.Int, value: customerId } };
    const seenColumns = new Set();

    fieldMap.forEach(([bodyKey, column, type]) => {
      if (req.body[bodyKey] === undefined || seenColumns.has(column)) return;
      const inputKey = bodyKey;
      seenColumns.add(column);
      updates.push(`${column} = @${inputKey}`);

      let val = req.body[bodyKey];
      if (val === '' && type === sql.Int) val = null;
      if (column === 'IsActive') val = parseBool(val);

      inputs[inputKey] = {
        type,
        value: val,
      };
    });

    if (!updates.length) {
      res.status(400).json({ message: 'No fields to update' });
      return;
    }

    const rows = await mssqlQuery('DEFAULT', `
      UPDATE dbo.Customers
      SET ${updates.join(', ')}
      WHERE CustomerId = @customerId
      SELECT @@ROWCOUNT AS affected
    `, { inputs });

    if (!rows[0]?.affected) {
      res.status(404).json({ message: 'Customer not found' });
      return;
    }

    res.json({ data: await getCustomer(customerId) });
  }),
);

router.patch(
  '/:id/status',
  writeRoles,
  asyncHandler(async (req, res) => {
    const customerId = parseId(req.params.id, 'customerId');
    if (req.body.isActive === undefined) {
      res.status(400).json({ message: 'isActive is required' });
      return;
    }

    const rows = await mssqlQuery('DEFAULT', `
      UPDATE dbo.Customers
      SET IsActive = @isActive
      WHERE CustomerId = @customerId
      SELECT @@ROWCOUNT AS affected
    `, {
      inputs: {
        customerId: { type: sql.Int, value: customerId },
        isActive: { type: sql.Bit, value: parseBool(req.body.isActive) },
      },
    });

    if (!rows[0]?.affected) {
      res.status(404).json({ message: 'Customer not found' });
      return;
    }

    res.json({ data: await getCustomer(customerId) });
  }),
);

router.delete(
  '/:id',
  adminRoles,
  asyncHandler(async (req, res) => {
    const customerId = parseId(req.params.id, 'customerId');
    const rows = await mssqlQuery('DEFAULT', `
      UPDATE dbo.Customers
      SET IsActive = 0
      WHERE CustomerId = @customerId
      SELECT @@ROWCOUNT AS affected
    `, {
      inputs: { customerId: { type: sql.Int, value: customerId } },
    });

    if (!rows[0]?.affected) {
      res.status(404).json({ message: 'Customer not found' });
      return;
    }

    res.status(204).send();
  }),
);

router.get(
  '/:id/addresses',
  readRoles,
  asyncHandler(async (req, res) => {
    const customerId = parseId(req.params.id, 'customerId');
    await ensureCustomer(customerId);

    const rows = await mssqlQuery('DEFAULT', `
      SELECT *
      FROM dbo.CustomerAddresses
      WHERE CustomerId = @customerId
      ORDER BY IsDefault DESC, AddressCode
    `, { inputs: { customerId: { type: sql.Int, value: customerId } } });

    res.json({ data: rows.map(mapAddress) });
  }),
);

router.post(
  '/:id/addresses',
  writeRoles,
  asyncHandler(async (req, res) => {
    const customerId = parseId(req.params.id, 'customerId');
    const {
      addressCode,
      code = addressCode,
      branchCode,
      addressType,
      type = addressType,
      contactName = null,
      phone = null,
      addressLine1,
      addressLine2 = null,
      district = null,
      province = null,
      postalCode = null,
      countryCode = 'TH',
      isDefault = false,
      isActive = true,
    } = req.body;

    if (!code || !type || !addressLine1) {
      res.status(400).json({ message: 'addressCode, addressType and addressLine1 are required' });
      return;
    }

    const pool = await getMssqlPool('DEFAULT');
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const existingCustomer = await transaction.request().input('customerId', sql.Int, customerId).query(`
        SELECT CustomerId
        FROM dbo.Customers
        WHERE CustomerId = @customerId
      `);

      if (!existingCustomer.recordset.length) {
        await transaction.rollback();
        res.status(404).json({ message: 'Customer not found' });
        return;
      }

      if (parseBool(isDefault)) {
        await transaction
          .request()
          .input('customerId', sql.Int, customerId)
          .input('addressType', sql.NVarChar(30), type)
          .query(`
            UPDATE dbo.CustomerAddresses
            SET IsDefault = 0
            WHERE CustomerId = @customerId
              AND AddressType = @addressType
          `);
      }

      const result = await transaction
        .request()
        .input('customerId', sql.Int, customerId)
        .input('addressCode', sql.NVarChar(50), code)
        .input('branchCode', sql.NVarChar(50), branchCode)
        .input('addressType', sql.NVarChar(30), type)
        .input('contactName', sql.NVarChar(255), contactName)
        .input('phone', sql.NVarChar(50), phone)
        .input('addressLine1', sql.NVarChar(500), addressLine1)
        .input('addressLine2', sql.NVarChar(500), addressLine2)
        .input('district', sql.NVarChar(100), district)
        .input('province', sql.NVarChar(100), province)
        .input('postalCode', sql.NVarChar(20), postalCode)
        .input('countryCode', sql.Char(2), countryCode)
        .input('isDefault', sql.Bit, parseBool(isDefault))
        .input('isActive', sql.Bit, parseBool(isActive)).query(`
          INSERT INTO dbo.CustomerAddresses (
            CustomerId,
            AddressCode,
            BranchCode,
            AddressType,
            ContactName,
            Phone,
            AddressLine1,
            AddressLine2,
            District,
            Province,
            PostalCode,
            CountryCode,
            IsDefault,
            IsActive
          )
          OUTPUT inserted.CustomerAddressId
          VALUES (
            @customerId,
            @addressCode,
            @branchCode,
            @addressType,
            @contactName,
            @phone,
            @addressLine1,
            @addressLine2,
            @district,
            @province,
            @postalCode,
            @countryCode,
            @isDefault,
            @isActive
          )
        `);

      await transaction.commit();
      const rows = await mssqlQuery('DEFAULT', `
        SELECT *
        FROM dbo.CustomerAddresses
        WHERE CustomerAddressId = @addressId
      `, { inputs: { addressId: { type: sql.Int, value: result.recordset[0].CustomerAddressId } } });

      res.status(201).json({ data: mapAddress(rows[0]) });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }),
);

router.put(
  '/:id/addresses/:addressId',
  writeRoles,
  asyncHandler(async (req, res) => {
    const customerId = parseId(req.params.id, 'customerId');
    const addressId = parseId(req.params.addressId, 'addressId');
    const fieldMap = [
      ['addressCode', 'AddressCode', sql.NVarChar(50)],
      ['code', 'AddressCode', sql.NVarChar(50)],
      ['branchCode', 'BranchCode', sql.NVarChar(5)],
      ['addressType', 'AddressType', sql.NVarChar(30)],
      ['type', 'AddressType', sql.NVarChar(30)],
      ['contactName', 'ContactName', sql.NVarChar(255)],
      ['phone', 'Phone', sql.NVarChar(50)],
      ['addressLine1', 'AddressLine1', sql.NVarChar(500)],
      ['addressLine2', 'AddressLine2', sql.NVarChar(500)],
      ['district', 'District', sql.NVarChar(100)],
      ['province', 'Province', sql.NVarChar(100)],
      ['postalCode', 'PostalCode', sql.NVarChar(20)],
      ['countryCode', 'CountryCode', sql.Char(2)],
      ['isDefault', 'IsDefault', sql.Bit],
      ['isActive', 'IsActive', sql.Bit],
    ];

    const updates = [];
    const inputs = {
      customerId: { type: sql.Int, value: customerId },
      addressId: { type: sql.Int, value: addressId },
    };
    const seenColumns = new Set();

    fieldMap.forEach(([bodyKey, column, type]) => {
      if (req.body[bodyKey] === undefined || seenColumns.has(column)) return;
      seenColumns.add(column);
      updates.push(`${column} = @${bodyKey}`);
      inputs[bodyKey] = {
        type,
        value: column === 'IsDefault' || column === 'IsActive' ? parseBool(req.body[bodyKey]) : req.body[bodyKey],
      };
    });

    if (!updates.length) {
      res.status(400).json({ message: 'No fields to update' });
      return;
    }

    const pool = await getMssqlPool('DEFAULT');
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const existing = await transaction
        .request()
        .input('customerId', sql.Int, customerId)
        .input('addressId', sql.Int, addressId)
        .query(`
          SELECT CustomerAddressId, AddressType
          FROM dbo.CustomerAddresses
          WHERE CustomerId = @customerId
            AND CustomerAddressId = @addressId
        `);

      if (!existing.recordset.length) {
        await transaction.rollback();
        res.status(404).json({ message: 'Address not found' });
        return;
      }

      const nextType = req.body.addressType ?? req.body.type ?? existing.recordset[0].AddressType;
      if (req.body.isDefault === true || req.body.isDefault === 'true' || req.body.isDefault === 1 || req.body.isDefault === '1') {
        await transaction
          .request()
          .input('customerId', sql.Int, customerId)
          .input('addressId', sql.Int, addressId)
          .input('addressType', sql.NVarChar(30), nextType)
          .query(`
            UPDATE dbo.CustomerAddresses
            SET IsDefault = 0
            WHERE CustomerId = @customerId
              AND CustomerAddressId <> @addressId
              AND AddressType = @addressType
          `);
      }

      const request = transaction.request();
      Object.entries(inputs).forEach(([key, input]) => request.input(key, input.type, input.value));
      await request.query(`
        UPDATE dbo.CustomerAddresses
        SET ${updates.join(', ')}
        WHERE CustomerId = @customerId
          AND CustomerAddressId = @addressId
      `);

      await transaction.commit();
      const rows = await mssqlQuery('DEFAULT', `
        SELECT *
        FROM dbo.CustomerAddresses
        WHERE CustomerAddressId = @addressId
      `, { inputs: { addressId: { type: sql.Int, value: addressId } } });

      res.json({ data: mapAddress(rows[0]) });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }),
);

router.patch(
  '/:id/addresses/:addressId/default',
  writeRoles,
  asyncHandler(async (req, res) => {
    const customerId = parseId(req.params.id, 'customerId');
    const addressId = parseId(req.params.addressId, 'addressId');
    const pool = await getMssqlPool('DEFAULT');
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const existing = await transaction
        .request()
        .input('customerId', sql.Int, customerId)
        .input('addressId', sql.Int, addressId)
        .query(`
          SELECT CustomerAddressId, AddressType
          FROM dbo.CustomerAddresses
          WHERE CustomerId = @customerId
            AND CustomerAddressId = @addressId
            AND IsActive = 1
        `);

      if (!existing.recordset.length) {
        await transaction.rollback();
        res.status(404).json({ message: 'Address not found' });
        return;
      }

      await transaction
        .request()
        .input('customerId', sql.Int, customerId)
        .input('addressId', sql.Int, addressId)
        .input('addressType', sql.NVarChar(30), existing.recordset[0].AddressType)
        .query(`
          UPDATE dbo.CustomerAddresses
          SET IsDefault = CASE WHEN CustomerAddressId = @addressId THEN 1 ELSE 0 END
          WHERE CustomerId = @customerId
            AND AddressType = @addressType
        `);

      await transaction.commit();
      const rows = await mssqlQuery('DEFAULT', `
        SELECT *
        FROM dbo.CustomerAddresses
        WHERE CustomerAddressId = @addressId
      `, { inputs: { addressId: { type: sql.Int, value: addressId } } });

      res.json({ data: mapAddress(rows[0]) });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }),
);

router.delete(
  '/:id/addresses/:addressId',
  writeRoles,
  asyncHandler(async (req, res) => {
    const customerId = parseId(req.params.id, 'customerId');
    const addressId = parseId(req.params.addressId, 'addressId');
    const rows = await mssqlQuery('DEFAULT', `
      UPDATE dbo.CustomerAddresses
      SET IsActive = 0,
          IsDefault = 0
      WHERE CustomerId = @customerId
        AND CustomerAddressId = @addressId
      SELECT @@ROWCOUNT AS affected
    `, {
      inputs: {
        customerId: { type: sql.Int, value: customerId },
        addressId: { type: sql.Int, value: addressId },
      },
    });

    if (!rows[0]?.affected) {
      res.status(404).json({ message: 'Address not found' });
      return;
    }

    res.status(204).send();
  }),
);

router.get(
  '/:id/contacts',
  readRoles,
  asyncHandler(async (req, res) => {
    const customerId = parseId(req.params.id, 'customerId');
    await ensureCustomer(customerId);

    const rows = await mssqlQuery('DEFAULT', `
      SELECT *
      FROM dbo.CustomerContacts
      WHERE CustomerId = @customerId
      ORDER BY IsPrimary DESC, ContactName
    `, { inputs: { customerId: { type: sql.Int, value: customerId } } });

    res.json({ data: rows.map(mapContact) });
  }),
);

router.post(
  '/:id/contacts',
  writeRoles,
  asyncHandler(async (req, res) => {
    const customerId = parseId(req.params.id, 'customerId');
    const {
      contactName,
      name = contactName,
      jobTitle = null,
      phone = null,
      email = null,
      isPrimary = false,
      isActive = true,
    } = req.body;

    if (!name) {
      res.status(400).json({ message: 'contactName is required' });
      return;
    }

    const pool = await getMssqlPool('DEFAULT');
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const existingCustomer = await transaction.request().input('customerId', sql.Int, customerId).query(`
        SELECT CustomerId
        FROM dbo.Customers
        WHERE CustomerId = @customerId
      `);

      if (!existingCustomer.recordset.length) {
        await transaction.rollback();
        res.status(404).json({ message: 'Customer not found' });
        return;
      }

      if (parseBool(isPrimary)) {
        await transaction
          .request()
          .input('customerId', sql.Int, customerId)
          .query('UPDATE dbo.CustomerContacts SET IsPrimary = 0 WHERE CustomerId = @customerId');
      }

      const result = await transaction
        .request()
        .input('customerId', sql.Int, customerId)
        .input('contactName', sql.NVarChar(255), name)
        .input('jobTitle', sql.NVarChar(100), jobTitle)
        .input('phone', sql.NVarChar(50), phone)
        .input('email', sql.NVarChar(255), email)
        .input('isPrimary', sql.Bit, parseBool(isPrimary))
        .input('isActive', sql.Bit, parseBool(isActive)).query(`
          INSERT INTO dbo.CustomerContacts (
            CustomerId,
            ContactName,
            JobTitle,
            Phone,
            Email,
            IsPrimary,
            IsActive
          )
          OUTPUT inserted.CustomerContactId
          VALUES (
            @customerId,
            @contactName,
            @jobTitle,
            @phone,
            @email,
            @isPrimary,
            @isActive
          )
        `);

      await transaction.commit();
      const rows = await mssqlQuery('DEFAULT', `
        SELECT *
        FROM dbo.CustomerContacts
        WHERE CustomerContactId = @contactId
      `, { inputs: { contactId: { type: sql.Int, value: result.recordset[0].CustomerContactId } } });

      res.status(201).json({ data: mapContact(rows[0]) });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }),
);

router.put(
  '/:id/contacts/:contactId',
  writeRoles,
  asyncHandler(async (req, res) => {
    const customerId = parseId(req.params.id, 'customerId');
    const contactId = parseId(req.params.contactId, 'contactId');
    const fieldMap = [
      ['contactName', 'ContactName', sql.NVarChar(255)],
      ['name', 'ContactName', sql.NVarChar(255)],
      ['jobTitle', 'JobTitle', sql.NVarChar(100)],
      ['phone', 'Phone', sql.NVarChar(50)],
      ['email', 'Email', sql.NVarChar(255)],
      ['isPrimary', 'IsPrimary', sql.Bit],
      ['isActive', 'IsActive', sql.Bit],
    ];

    const updates = [];
    const inputs = {
      customerId: { type: sql.Int, value: customerId },
      contactId: { type: sql.Int, value: contactId },
    };
    const seenColumns = new Set();

    fieldMap.forEach(([bodyKey, column, type]) => {
      if (req.body[bodyKey] === undefined || seenColumns.has(column)) return;
      seenColumns.add(column);
      updates.push(`${column} = @${bodyKey}`);
      inputs[bodyKey] = {
        type,
        value: column === 'IsPrimary' || column === 'IsActive' ? parseBool(req.body[bodyKey]) : req.body[bodyKey],
      };
    });

    if (!updates.length) {
      res.status(400).json({ message: 'No fields to update' });
      return;
    }

    const pool = await getMssqlPool('DEFAULT');
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const existing = await transaction
        .request()
        .input('customerId', sql.Int, customerId)
        .input('contactId', sql.Int, contactId)
        .query(`
          SELECT CustomerContactId
          FROM dbo.CustomerContacts
          WHERE CustomerId = @customerId
            AND CustomerContactId = @contactId
        `);

      if (!existing.recordset.length) {
        await transaction.rollback();
        res.status(404).json({ message: 'Contact not found' });
        return;
      }

      if (req.body.isPrimary === true || req.body.isPrimary === 'true' || req.body.isPrimary === 1 || req.body.isPrimary === '1') {
        await transaction
          .request()
          .input('customerId', sql.Int, customerId)
          .input('contactId', sql.Int, contactId)
          .query(`
            UPDATE dbo.CustomerContacts
            SET IsPrimary = 0
            WHERE CustomerId = @customerId
              AND CustomerContactId <> @contactId
          `);
      }

      const request = transaction.request();
      Object.entries(inputs).forEach(([key, input]) => request.input(key, input.type, input.value));
      await request.query(`
        UPDATE dbo.CustomerContacts
        SET ${updates.join(', ')}
        WHERE CustomerId = @customerId
          AND CustomerContactId = @contactId
      `);

      await transaction.commit();
      const rows = await mssqlQuery('DEFAULT', `
        SELECT *
        FROM dbo.CustomerContacts
        WHERE CustomerContactId = @contactId
      `, { inputs: { contactId: { type: sql.Int, value: contactId } } });

      res.json({ data: mapContact(rows[0]) });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }),
);

router.patch(
  '/:id/contacts/:contactId/primary',
  writeRoles,
  asyncHandler(async (req, res) => {
    const customerId = parseId(req.params.id, 'customerId');
    const contactId = parseId(req.params.contactId, 'contactId');
    const pool = await getMssqlPool('DEFAULT');
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const existing = await transaction
        .request()
        .input('customerId', sql.Int, customerId)
        .input('contactId', sql.Int, contactId)
        .query(`
          SELECT CustomerContactId
          FROM dbo.CustomerContacts
          WHERE CustomerId = @customerId
            AND CustomerContactId = @contactId
            AND IsActive = 1
        `);

      if (!existing.recordset.length) {
        await transaction.rollback();
        res.status(404).json({ message: 'Contact not found' });
        return;
      }

      await transaction
        .request()
        .input('customerId', sql.Int, customerId)
        .input('contactId', sql.Int, contactId)
        .query(`
          UPDATE dbo.CustomerContacts
          SET IsPrimary = CASE WHEN CustomerContactId = @contactId THEN 1 ELSE 0 END
          WHERE CustomerId = @customerId
        `);

      await transaction.commit();
      const rows = await mssqlQuery('DEFAULT', `
        SELECT *
        FROM dbo.CustomerContacts
        WHERE CustomerContactId = @contactId
      `, { inputs: { contactId: { type: sql.Int, value: contactId } } });

      res.json({ data: mapContact(rows[0]) });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }),
);

router.delete(
  '/:id/contacts/:contactId',
  writeRoles,
  asyncHandler(async (req, res) => {
    const customerId = parseId(req.params.id, 'customerId');
    const contactId = parseId(req.params.contactId, 'contactId');
    const rows = await mssqlQuery('DEFAULT', `
      UPDATE dbo.CustomerContacts
      SET IsActive = 0,
          IsPrimary = 0
      WHERE CustomerId = @customerId
        AND CustomerContactId = @contactId
      SELECT @@ROWCOUNT AS affected
    `, {
      inputs: {
        customerId: { type: sql.Int, value: customerId },
        contactId: { type: sql.Int, value: contactId },
      },
    });

    if (!rows[0]?.affected) {
      res.status(404).json({ message: 'Contact not found' });
      return;
    }

    res.status(204).send();
  }),
);

export default router;
