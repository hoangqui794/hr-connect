using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface ISystemSettingRepository
{
    Task<SystemSetting?> GetAsync(string key, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SystemSetting>> GetAllAsync(CancellationToken cancellationToken = default);

    Task AddAsync(SystemSetting setting, CancellationToken cancellationToken = default);
}
