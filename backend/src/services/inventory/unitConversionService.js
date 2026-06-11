import { sql } from "../../lib/mssql.js";

function badRequest(message) {
    const error = new Error(message);
    error.status = 400;
    return error;
}

function toNumber(value, name) {
    const n = Number(value);
    if (!Number.isFinite(n)) throw badRequest(`${name} must be a number`);
    return n;
}

export const unitConversionService = {
    async getItemBaseUnit(tx, itemId) {
        const res = await tx
            .request()
            .input("itemId", sql.Int, itemId)
            .query(`
                SELECT i.UnitId, u.UnitCode, u.UnitName
                FROM dbo.Items i
                JOIN dbo.Units u ON u.UnitId = i.UnitId
                WHERE i.ItemId = @itemId
            `);

        const row = res.recordset[0];
        if (!row) throw badRequest(`Item ${itemId} not found`);

        return {
            unitId: row.UnitId,
            unitCode: row.UnitCode,
            unitName: row.UnitName,
        };
    },

    async convertToItemBase(tx, {
        itemId,
        itemSpecId = null,
        fromUnitId,
        quantity,
        asOf = new Date(),
    }) {
        const sourceQuantity = toNumber(quantity, "quantity");
        const sourceUnitId = Number(fromUnitId);
        if (!Number.isInteger(sourceUnitId) || sourceUnitId <= 0) {
            throw badRequest("fromUnitId is required");
        }

        const baseUnit = await this.getItemBaseUnit(tx, itemId);
        if (sourceUnitId === baseUnit.unitId) {
            return {
                sourceQuantity,
                sourceUnitId,
                baseQuantity: sourceQuantity,
                baseUnitId: baseUnit.unitId,
                baseUnitCode: baseUnit.unitCode,
                conversionFactor: 1,
            };
        }

        const res = await tx
            .request()
            .input("itemId", sql.Int, itemId)
            .input("itemSpecId", sql.Int, itemSpecId)
            .input("fromUnitId", sql.Int, sourceUnitId)
            .input("toUnitId", sql.Int, baseUnit.unitId)
            .input("asOf", sql.Date, asOf)
            .query(`
                SELECT TOP 1
                    iuc.ItemUnitConversionId,
                    iuc.ItemSpecId,
                    iuc.ConversionFactor
                FROM dbo.ItemUnitConversions iuc
                WHERE iuc.ItemId = @itemId
                  AND (iuc.ItemSpecId = @itemSpecId OR iuc.ItemSpecId IS NULL)
                  AND iuc.FromUnitId = @fromUnitId
                  AND iuc.ToUnitId = @toUnitId
                  AND iuc.IsActive = 1
                  AND iuc.EffectiveFrom <= @asOf
                  AND (iuc.EffectiveTo IS NULL OR iuc.EffectiveTo >= @asOf)
                ORDER BY
                    CASE WHEN iuc.ItemSpecId = @itemSpecId THEN 0 ELSE 1 END,
                    iuc.EffectiveFrom DESC,
                    iuc.ItemUnitConversionId DESC
            `);

        const conversion = res.recordset[0];
        if (!conversion) {
            throw badRequest(
                `Missing unit conversion for item ${itemId} from unit ${sourceUnitId} to base unit ${baseUnit.unitId}`,
            );
        }

        const conversionFactor = Number(conversion.ConversionFactor);
        return {
            sourceQuantity,
            sourceUnitId,
            baseQuantity: sourceQuantity * conversionFactor,
            baseUnitId: baseUnit.unitId,
            baseUnitCode: baseUnit.unitCode,
            conversionFactor,
        };
    },
};
