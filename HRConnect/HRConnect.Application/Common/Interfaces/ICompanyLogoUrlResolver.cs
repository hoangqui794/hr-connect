using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces;

public interface ICompanyLogoUrlResolver
{
    string? Resolve(Company company);
}
