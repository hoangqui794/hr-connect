using HRConnect.Domain.Entities;
using System.Diagnostics.CodeAnalysis;

namespace HRConnect.Application.Features.Recruitment.Common;

public static class CompanyMembershipPolicy
{
    public static bool IsActive([NotNullWhen(true)] CompanyUser? companyUser) =>
        companyUser != null
        && string.Equals(companyUser.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase);
}
