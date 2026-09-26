using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface ICommissionMilestoneRepository
{
    Task<IReadOnlyList<CommissionMilestone>> GetListAsync(
        bool? isActive,
        CancellationToken cancellationToken = default);
}
