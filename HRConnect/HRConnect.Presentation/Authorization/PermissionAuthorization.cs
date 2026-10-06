using System.Security.Claims;

namespace HRConnect.Presentation.Authorization;

public static class PermissionAuthorization
{
    public static bool HasPermission(ClaimsPrincipal user, string permission) =>
        user.HasClaim("permission", permission);

    public static IResult Forbidden(string permission) => Results.Json(new
    {
        success = false,
        code = "MISSING_PERMISSION",
        message = $"Bạn không có quyền thực hiện thao tác này. Quyền bắt buộc: {permission}.",
        requiredPermission = permission
    }, statusCode: StatusCodes.Status403Forbidden);
}
