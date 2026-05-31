BEGIN TRANSACTION;

DECLARE @UserId INT;
DECLARE @RoleId INT;

SELECT @RoleId = RoleId
FROM dbo.Roles
WHERE RoleCode = 'admin';

IF @RoleId IS NULL
BEGIN
    THROW 50001, 'Role admin not found', 1;
END;

INSERT INTO dbo.Users (
    Username,
    StaffId,
    PasswordHash,
    DisplayName,
    JobTitle,
    Email,
    AvatarUrl,
    IsActive
)
VALUES (
    N'admin',
    N'10000000',
    N'$2a$10$9CI6Loi2iVdqBDC/G0Vwwe3Ozi55L/FRMlo504YAuMl97jT0FHVLa',
    N'Chatree Kueakachai',
    N'Administrator',
    N'admin@doublea1991.com',
    N'https://wms.advanceagro.net/WSVIS/api/Face/GetImage?CardID=10005718&size=200',
    1
);

SET @UserId = SCOPE_IDENTITY();

INSERT INTO dbo.UserRoles (UserId, RoleId)
VALUES (@UserId, @RoleId);

COMMIT TRANSACTION;