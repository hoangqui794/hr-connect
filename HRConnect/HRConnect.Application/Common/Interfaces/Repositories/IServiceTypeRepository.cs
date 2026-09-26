using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IServiceTypeRepository
{
    Task<(List<ServiceType> Items, int TotalCount)> GetListAsync(
        string? search,
        bool? isActive,
        string sortBy,
        string sortDirection,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<ServiceType?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<ServiceType?> GetByCodeAsync(string code, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ServiceTypeAllowedRole>> GetAllowedRolesAsync(Guid serviceTypeId, CancellationToken cancellationToken = default);

    Task<bool> ExistsByCodeAsync(string code, Guid? excludeId = null, CancellationToken cancellationToken = default);

    Task<bool> IsReferencedAsync(Guid id, CancellationToken cancellationToken = default);

    Task AddAsync(ServiceType serviceType, CancellationToken cancellationToken = default);

    void Update(ServiceType serviceType);

    void Delete(ServiceType serviceType);
}
