import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { mssqlQuery, sql } from "../lib/mssql.js";

const router = Router();

router.use(authenticate);

const readRoles = allowRoles("admin", "accounting", "user", "audit");
const writeRoles = allowRoles("admin");

function badRequest(message) {
    const error = new Error(message);
    error.status = 400;
    return error;
}

function parseId(value, name = "id") {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0)
        throw badRequest(`${name} must be a positive integer`);
    return id;
}

router.get(
    "/definitions",
    readRoles,
    asyncHandler(async (req, res) => {
        const documentType = req.query.documentType
            ? String(req.query.documentType).trim()
            : null;
        const isActive =
            req.query.isActive === undefined ? null : req.query.isActive;

        const where = [];
        const inputs = {};
        if (documentType) {
            where.push("DocumentType = @documentType");
            inputs.documentType = { type: sql.NVarChar(40), value: documentType };
        }
        if (isActive !== null) {
            where.push("IsActive = @isActive");
            inputs.isActive = {
                type: sql.Bit,
                value:
                    isActive === true ||
                    isActive === "true" ||
                    isActive === "1" ||
                    isActive === 1,
            };
        }
        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

        const rows = await mssqlQuery(
            "DEFAULT",
            `
        SELECT WorkflowDefinitionId, WorkflowCode, WorkflowName, DocumentType, IsActive, CreatedAt
        FROM dbo.WorkflowDefinitions
        ${whereSql}
        ORDER BY CreatedAt DESC, WorkflowDefinitionId DESC
      `,
            { inputs },
        );

        res.json({
            data: rows.map((r) => ({
                id: r.WorkflowDefinitionId,
                workflowCode: r.WorkflowCode,
                workflowName: r.WorkflowName,
                documentType: r.DocumentType,
                isActive: Boolean(r.IsActive),
                createdAt: r.CreatedAt,
            })),
        });
    }),
);

router.post(
    "/definitions",
    writeRoles,
    asyncHandler(async (req, res) => {
        const workflowCode = String(req.body.workflowCode || "").trim();
        const workflowName = String(req.body.workflowName || "").trim();
        const documentType = String(req.body.documentType || "").trim();
        const isActive =
            req.body.isActive === undefined ? true : Boolean(req.body.isActive);

        if (!workflowCode) throw badRequest("workflowCode is required");
        if (!workflowName) throw badRequest("workflowName is required");
        if (!documentType) throw badRequest("documentType is required");

        const rows = await mssqlQuery(
            "DEFAULT",
            `
        INSERT INTO dbo.WorkflowDefinitions (WorkflowCode, WorkflowName, DocumentType, IsActive)
        OUTPUT INSERTED.WorkflowDefinitionId
        VALUES (@workflowCode, @workflowName, @documentType, @isActive)
      `,
            {
                inputs: {
                    workflowCode: { type: sql.NVarChar(60), value: workflowCode },
                    workflowName: { type: sql.NVarChar(255), value: workflowName },
                    documentType: { type: sql.NVarChar(40), value: documentType },
                    isActive: { type: sql.Bit, value: isActive },
                },
            },
        );

        res.status(201).json({ data: { id: rows[0]?.WorkflowDefinitionId } });
    }),
);

router.put(
    "/definitions/:id",
    writeRoles,
    asyncHandler(async (req, res) => {
        const id = parseId(req.params.id, "workflowDefinitionId");
        const workflowName = req.body.workflowName
            ? String(req.body.workflowName).trim()
            : null;
        const isActive =
            req.body.isActive === undefined ? null : Boolean(req.body.isActive);

        if (workflowName === null && isActive === null) {
            throw badRequest("workflowName or isActive is required");
        }

        await mssqlQuery(
            "DEFAULT",
            `
        UPDATE dbo.WorkflowDefinitions
        SET
          WorkflowName = COALESCE(@workflowName, WorkflowName),
          IsActive = COALESCE(@isActive, IsActive)
        WHERE WorkflowDefinitionId = @id
      `,
            {
                inputs: {
                    id: { type: sql.Int, value: id },
                    workflowName: { type: sql.NVarChar(255), value: workflowName },
                    isActive: isActive === null ? { type: sql.Bit, value: null } : { type: sql.Bit, value: isActive },
                },
            },
        );

        res.json({ data: { success: true } });
    }),
);

router.get(
    "/definitions/:id/steps",
    readRoles,
    asyncHandler(async (req, res) => {
        const id = parseId(req.params.id, "workflowDefinitionId");
        const rows = await mssqlQuery(
            "DEFAULT",
            `
        SELECT
          ws.WorkflowStepId,
          ws.StepNo,
          ws.ApprovalType,
          ws.ApproverRoleId,
          r.RoleName AS ApproverRoleName,
          ws.ApproverUserId,
          u.DisplayName AS ApproverUserName,
          ws.IsRequired,
          ws.CreatedAt
        FROM dbo.WorkflowSteps ws
        LEFT JOIN dbo.Roles r ON r.RoleId = ws.ApproverRoleId
        LEFT JOIN dbo.Users u ON u.UserId = ws.ApproverUserId
        WHERE ws.WorkflowDefinitionId = @id
        ORDER BY ws.StepNo ASC
      `,
            { inputs: { id: { type: sql.Int, value: id } } },
        );

        res.json({
            data: rows.map((r) => ({
                id: r.WorkflowStepId,
                stepNo: r.StepNo,
                approvalType: r.ApprovalType,
                approverRoleId: r.ApproverRoleId,
                roleName: r.ApproverRoleName,
                approverUserId: r.ApproverUserId,
                userName: r.ApproverUserName,
                isRequired: Boolean(r.IsRequired),
                createdAt: r.CreatedAt,
            })),
        });
    }),
);

router.post(
    "/definitions/:id/steps",
    writeRoles,
    asyncHandler(async (req, res) => {
        const id = parseId(req.params.id, "workflowDefinitionId");
        const stepNo = parseId(req.body.stepNo, "stepNo");
        const approverRoleId = req.body.approverRoleId
            ? parseId(req.body.approverRoleId, "approverRoleId")
            : null;
        const approverUserId = req.body.approverUserId
            ? parseId(req.body.approverUserId, "approverUserId")
            : null;
        const isRequired =
            req.body.isRequired === undefined ? true : Boolean(req.body.isRequired);

        if (!approverRoleId && !approverUserId) {
            throw badRequest("approverRoleId or approverUserId is required");
        }

        const rows = await mssqlQuery(
            "DEFAULT",
            `
        INSERT INTO dbo.WorkflowSteps (WorkflowDefinitionId, StepNo, ApprovalType, ApproverRoleId, ApproverUserId, IsRequired)
        OUTPUT INSERTED.WorkflowStepId
        VALUES (@defId, @stepNo, 'sequential', @roleId, @userId, @isRequired)
      `,
            {
                inputs: {
                    defId: { type: sql.Int, value: id },
                    stepNo: { type: sql.Int, value: stepNo },
                    roleId: { type: sql.Int, value: approverRoleId },
                    userId: { type: sql.Int, value: approverUserId },
                    isRequired: { type: sql.Bit, value: isRequired },
                },
            },
        );

        res.status(201).json({ data: { id: rows[0]?.WorkflowStepId } });
    }),
);

router.delete(
    "/definitions/:id/steps/:stepId",
    writeRoles,
    asyncHandler(async (req, res) => {
        const id = parseId(req.params.id, "workflowDefinitionId");
        const stepId = parseId(req.params.stepId, "workflowStepId");

        await mssqlQuery(
            "DEFAULT",
            `
        DELETE FROM dbo.WorkflowSteps
        WHERE WorkflowStepId = @stepId AND WorkflowDefinitionId = @defId
      `,
            {
                inputs: {
                    stepId: { type: sql.Int, value: stepId },
                    defId: { type: sql.Int, value: id },
                },
            },
        );

        res.json({ data: { success: true } });
    }),
);

export default router;
