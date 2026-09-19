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

    public async Task<AppUser?> GetByEmailWithRolesAndPermissionsAsync(string normalizedEmail, CancellationToken cancellationToken = default)
    {
        return await _context.AppUsers
            .Include(u => u.UserRoleUsers.Where(ur => ur.Status == "ACTIVE"))
                .ThenInclude(ur => ur.Role)
                    .ThenInclude(r => r.RolePermissions)
                        .ThenInclude(rp => rp.Permission)
            .Include(u => u.AffiliateApplicationUser)
            .Include(u => u.CompanyUsers)
                .ThenInclude(cu => cu.Company)
                    .ThenInclude(c => c.CompanyVerificationRequest)
            .Include(u => u.CompanyVerificationRequestSubmittedByNavigations)
                .ThenInclude(cvr => cvr.Company)
            .FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail, cancellationToken);
    }

    public async Task<AppUser?> GetByIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.AppUsers
            .FirstOrDefaultAsync(u => u.UserId == userId, cancellationToken);
    }

    public async Task<AppUser?> GetByIdWithRolesAndPermissionsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.AppUsers
            .Include(u => u.UserRoleUsers.Where(ur => ur.Status == "ACTIVE"))
                .ThenInclude(ur => ur.Role)
                    .ThenInclude(r => r.RolePermissions)
                        .ThenInclude(rp => rp.Permission)
            .Include(u => u.AffiliateApplicationUser)
            .Include(u => u.CompanyUsers)
                .ThenInclude(cu => cu.Company)
                    .ThenInclude(c => c.CompanyVerificationRequest)
            .Include(u => u.CompanyVerificationRequestSubmittedByNavigations)
                .ThenInclude(cvr => cvr.Company)
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
