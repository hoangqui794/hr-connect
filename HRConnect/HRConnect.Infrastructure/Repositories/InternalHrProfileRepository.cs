using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class InternalHrProfileRepository : IInternalHrProfileRepository
{
    private readonly ApplicationDbContext _context;

    public InternalHrProfileRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<InternalHrProfile?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.InternalHrProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);
    }

    public async Task<InternalHrProfile?> GetByUserIdWithDetailsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.InternalHrProfiles
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);
    }

    public async Task AddAsync(InternalHrProfile profile, CancellationToken cancellationToken = default)
    {
        await _context.InternalHrProfiles.AddAsync(profile, cancellationToken);
    }

    public void Update(InternalHrProfile profile)
    {
        _context.InternalHrProfiles.Update(profile);
    }
}
