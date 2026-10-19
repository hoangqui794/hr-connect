using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Services.Storage;
using Microsoft.Extensions.Options;

namespace HRConnect.UnitTests.Services.Storage;

public sealed class AvatarUrlResolverTests
{
    [Fact]
    public void Resolve_ObjectKey_ReturnsVersionedApiUrl()
    {
        var resolver = new AvatarUrlResolver(Options.Create(new R2Settings { PublicApiBaseUrl = "https://api.example.com/" }));
        var updatedAt = new DateTime(2026, 10, 19, 1, 2, 3, DateTimeKind.Utc);
        var user = new AppUser { UserId = Guid.NewGuid(), AvatarObjectKey = $"avatars/{Guid.NewGuid()}/avatar.webp", AvatarUpdatedAt = updatedAt };

        var result = resolver.Resolve(user);

        Assert.Equal($"https://api.example.com/api/v1/users/{user.UserId:D}/avatar?v={updatedAt.Ticks}", result);
    }

    [Fact]
    public void Resolve_LegacyAbsoluteUrl_ReturnsLegacyValue()
    {
        var resolver = new AvatarUrlResolver(Options.Create(new R2Settings()));
        var user = new AppUser { UserId = Guid.NewGuid(), AvatarUrl = "https://legacy.example.com/avatar.jpg" };

        Assert.Equal(user.AvatarUrl, resolver.Resolve(user));
    }

    [Fact]
    public void Resolve_NoAvatar_ReturnsNull()
    {
        var resolver = new AvatarUrlResolver(Options.Create(new R2Settings()));
        Assert.Null(resolver.Resolve(new AppUser { UserId = Guid.NewGuid() }));
    }
}
