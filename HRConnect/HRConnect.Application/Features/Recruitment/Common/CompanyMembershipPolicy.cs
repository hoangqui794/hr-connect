using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using System.Diagnostics.CodeAnalysis;

namespace HRConnect.Application.Features.Recruitment.Common;

public static class CompanyMembershipPolicy
{
    public static bool IsActive([NotNullWhen(true)] CompanyUser? companyUser) =>
        companyUser != null
        && string.Equals(companyUser.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Ensures the caller is either an authorized backoffice actor or an active member of <paramref name="companyId"/>.
    /// </summary>
    public static async Task EnsureCompanyAccessAsync(
        ICompanyUserRepository? companyUsers,
        Guid userId,
        bool isBackoffice,
        Guid companyId,
        CancellationToken cancellationToken = default)
    {
        if (isBackoffice)
        {
            return;
        }

        if (userId == Guid.Empty || companyUsers == null)
        {
            throw new ForbiddenException("Bạn không có quyền thực hiện thao tác cho doanh nghiệp này.");
        }

        var member = await companyUsers.GetByUserIdAsync(userId, cancellationToken);
        if (!IsActive(member) || member.CompanyId != companyId)
        {
            throw new ForbiddenException("Bạn không có quyền thực hiện thao tác cho doanh nghiệp này.");
        }
    }
}
