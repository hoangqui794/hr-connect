using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Services.Storage;
using Microsoft.Extensions.Options;

namespace HRConnect.UnitTests.Services.Storage;

public sealed class CompanyLogoUrlResolverTests
{
    [Fact]
    public void Resolve_ObjectKey_ReturnsVersionedApiUrl()
    {
        var resolver = new CompanyLogoUrlResolver(Options.Create(new R2Settings { PublicApiBaseUrl = "https://api.example.com/" }));
        var updatedAt = new DateTime(2026, 10, 25, 1, 2, 3, DateTimeKind.Utc);
        var company = new Company
        {
            CompanyId = Guid.NewGuid(), CompanyName = "ACME", VerificationStatus = "VERIFIED",
            LogoObjectKey = "company-logos/example/logo.webp", LogoUpdatedAt = updatedAt
        };

        Assert.Equal($"https://api.example.com/api/v1/companies/{company.CompanyId:D}/logo?v={updatedAt.Ticks}", resolver.Resolve(company));
    }

    [Fact]
    public void Resolve_LegacyAbsoluteUrl_ReturnsLegacyValue()
    {
        var resolver = new CompanyLogoUrlResolver(Options.Create(new R2Settings()));
        var company = new Company { CompanyId = Guid.NewGuid(), CompanyName = "ACME", VerificationStatus = "VERIFIED", LogoUrl = "https://legacy.example.com/logo.png" };
        Assert.Equal(company.LogoUrl, resolver.Resolve(company));
    }
}
