using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class AdminProfileRepository : IAdminProfileRepository
{
    private readonly ApplicationDbContext _context;

    public AdminProfileRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<AdminProfile?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.AdminProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);
    }

    public async Task<AdminProfile?> GetByUserIdWithDetailsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.AdminProfiles
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);
    }

    public async Task AddAsync(AdminProfile profile, CancellationToken cancellationToken = default)
    {
        await _context.AdminProfiles.AddAsync(profile, cancellationToken);
    }

    public void Update(AdminProfile profile)
    {
        _context.AdminProfiles.Update(profile);
    }
}
