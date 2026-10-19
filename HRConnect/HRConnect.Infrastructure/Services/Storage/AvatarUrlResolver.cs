using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Options;

namespace HRConnect.Infrastructure.Services.Storage;

public sealed class AvatarUrlResolver(IOptions<R2Settings> options) : IAvatarUrlResolver
{
    private readonly R2Settings _settings = options.Value;

    public string? Resolve(AppUser user)
    {
        if (!string.IsNullOrWhiteSpace(user.AvatarObjectKey))
        {
            var route = $"/api/v1/users/{user.UserId:D}/avatar";
            if (user.AvatarUpdatedAt is not null)
                route += $"?v={user.AvatarUpdatedAt.Value.ToUniversalTime().Ticks}";

            return string.IsNullOrWhiteSpace(_settings.PublicApiBaseUrl)
                ? route
                : $"{_settings.PublicApiBaseUrl.TrimEnd('/')}{route}";
        }

        return string.IsNullOrWhiteSpace(user.AvatarUrl) ? null : user.AvatarUrl;
    }
}
