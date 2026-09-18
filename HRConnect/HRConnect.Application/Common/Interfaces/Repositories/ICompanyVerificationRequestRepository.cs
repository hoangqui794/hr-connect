using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface ICompanyVerificationRequestRepository
{
    Task AddAsync(CompanyVerificationRequest request, CancellationToken cancellationToken = default);

    Task<CompanyVerificationRequest?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<CompanyVerificationRequest?> GetByCompanyIdAsync(Guid companyId, CancellationToken cancellationToken = default);

    Task<CompanyVerificationRequest?> GetByIdAsync(Guid requestId, CancellationToken cancellationToken = default);

    void Update(CompanyVerificationRequest request);
}
