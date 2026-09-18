using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface ICompanyUserRepository
{
    Task AddAsync(CompanyUser companyUser, CancellationToken cancellationToken = default);

    Task<CompanyUser?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    void Update(CompanyUser companyUser);
}
