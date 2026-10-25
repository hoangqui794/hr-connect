using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Options;

namespace HRConnect.Infrastructure.Services.Storage;

public sealed class CompanyLogoUrlResolver(IOptions<R2Settings> options) : ICompanyLogoUrlResolver
{
    private readonly R2Settings _settings = options.Value;

    public string? Resolve(Company company)
    {
        if (!string.IsNullOrWhiteSpace(company.LogoObjectKey))
        {
            var route = $"/api/v1/companies/{company.CompanyId:D}/logo";
            if (company.LogoUpdatedAt is not null)
                route += $"?v={company.LogoUpdatedAt.Value.ToUniversalTime().Ticks}";

            return string.IsNullOrWhiteSpace(_settings.PublicApiBaseUrl)
                ? route
                : $"{_settings.PublicApiBaseUrl.TrimEnd('/')}{route}";
        }

        return string.IsNullOrWhiteSpace(company.LogoUrl) ? null : company.LogoUrl;
    }
}
