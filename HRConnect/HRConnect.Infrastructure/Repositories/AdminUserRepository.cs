using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public sealed class AdminUserRepository : IAdminUserRepository
{
    private readonly ApplicationDbContext _context;

    public AdminUserRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<(IReadOnlyList<AppUser> Items, int TotalCount)> GetUsersAsync(
        string? search,
        string? status,
        string? role,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _context.AppUsers.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var normalizedSearch = search.Trim().ToLower();
            query = query.Where(user =>
                user.Email.ToLower().Contains(normalizedSearch) ||
                (user.DisplayName != null && user.DisplayName.ToLower().Contains(normalizedSearch)));
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim().ToUpper();
            query = query.Where(user => user.Status == normalizedStatus);
        }

        if (!string.IsNullOrWhiteSpace(role))
        {
            var normalizedRole = role.Trim().ToUpper();
            query = query.Where(user => user.UserRoleUsers.Any(assignment =>
                assignment.Status == "ACTIVE" &&
                assignment.Role.IsActive &&
                assignment.Role.Code == normalizedRole));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .Include(user => user.UserRoleUsers.Where(assignment => assignment.Status == "ACTIVE"))
                .ThenInclude(assignment => assignment.Role)
            .OrderByDescending(user => user.UpdatedAt)
            .ThenBy(user => user.UserId)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task<AppUser?> GetByIdWithRolesAsync(
        Guid userId,
        bool tracking = false,
        CancellationToken cancellationToken = default)
    {
        IQueryable<AppUser> query = _context.AppUsers;
        if (!tracking)
        {
            query = query.AsNoTracking();
        }

        return await query
            .Include(user => user.UserRoleUsers.Where(assignment => assignment.Status == "ACTIVE"))
                .ThenInclude(assignment => assignment.Role)
            .FirstOrDefaultAsync(user => user.UserId == userId, cancellationToken);
    }

    public void Update(AppUser user)
    {
        _context.AppUsers.Update(user);
    }
}
