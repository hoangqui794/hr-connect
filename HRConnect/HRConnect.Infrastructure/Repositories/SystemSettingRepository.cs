using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class SystemSettingRepository : ISystemSettingRepository
{
    private readonly ApplicationDbContext _context;

    public SystemSettingRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<SystemSetting?> GetAsync(string key, CancellationToken cancellationToken = default) =>
        _context.SystemSettings.FirstOrDefaultAsync(s => s.SettingKey == key, cancellationToken);

    public async Task<IReadOnlyList<SystemSetting>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await _context.SystemSettings.AsNoTracking().ToListAsync(cancellationToken);

    public async Task AddAsync(SystemSetting setting, CancellationToken cancellationToken = default) =>
        await _context.SystemSettings.AddAsync(setting, cancellationToken);
}
