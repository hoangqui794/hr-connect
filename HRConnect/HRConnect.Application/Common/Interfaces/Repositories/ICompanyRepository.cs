using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface ICompanyRepository
{
    Task AddAsync(Company company, CancellationToken cancellationToken = default);

    Task<Company?> GetByIdAsync(Guid companyId, CancellationToken cancellationToken = default);

    Task<bool> ExistsByTaxCodeAsync(string taxCode, CancellationToken cancellationToken = default);

    Task<bool> ExistsByTaxCodeAsync(string taxCode, Guid excludeCompanyId, CancellationToken cancellationToken = default);

    void Update(Company company);
}
