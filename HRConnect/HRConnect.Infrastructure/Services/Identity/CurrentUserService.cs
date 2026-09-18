using System.Security.Claims;
using HRConnect.Application.Common.Interfaces;
using Microsoft.AspNetCore.Http;

namespace HRConnect.Infrastructure.Services.Identity;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    private ClaimsPrincipal? User => _httpContextAccessor.HttpContext?.User;

    public Guid? UserId
    {
        get
        {
            var userIdString = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                            ?? User?.FindFirst("sub")?.Value;

            return Guid.TryParse(userIdString, out var userId) ? userId : null;
        }
    }

    public string? Email => User?.FindFirst(ClaimTypes.Email)?.Value 
                         ?? User?.FindFirst("email")?.Value;

    public bool IsAuthenticated => User?.Identity?.IsAuthenticated ?? false;

    public bool HasRole(string role)
    {
        return User?.IsInRole(role) ?? false;
    }

    public bool HasPermission(string permission)
    {
        return User?.HasClaim("permission", permission) ?? false;
    }
}
