using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class UserRepository : IUserRepository
{
    private readonly ApplicationDbContext _context;

    public UserRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<bool> ExistsByEmailAsync(string normalizedEmail, CancellationToken cancellationToken = default)
    {
        return await _context.AppUsers
            .AnyAsync(u => u.Email.ToLower() == normalizedEmail, cancellationToken);
    }

    public async Task<AppUser?> GetByEmailAsync(string normalizedEmail, CancellationToken cancellationToken = default)
    {
        return await _context.AppUsers
            .FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail, cancellationToken);
    }

    public async Task<AppUser?> GetByIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.AppUsers
            .FirstOrDefaultAsync(u => u.UserId == userId, cancellationToken);
    }

    public async Task AddAsync(AppUser user, CancellationToken cancellationToken = default)
    {
        await _context.AppUsers.AddAsync(user, cancellationToken);
    }

    public void Update(AppUser user)
    {
        _context.AppUsers.Update(user);
    }
}
