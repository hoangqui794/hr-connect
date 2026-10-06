using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class ServiceTypeRepository : IServiceTypeRepository
{
    private readonly ApplicationDbContext _context;

    public ServiceTypeRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<(List<ServiceType> Items, int TotalCount)> GetListAsync(
        string? search,
        bool? isActive,
        string sortBy,
        string sortDirection,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _context.ServiceTypes.AsNoTracking().AsQueryable();

        if (isActive.HasValue)
        {
            query = query.Where(st => st.IsActive == isActive.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var trimmed = search.Trim().ToLower();
            query = query.Where(st => st.Code.ToLower().Contains(trimmed) || st.Name.ToLower().Contains(trimmed));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var isDesc = string.Equals(sortDirection, "desc", StringComparison.OrdinalIgnoreCase);

        query = sortBy?.ToLowerInvariant() switch
        {
            "code" => isDesc ? query.OrderByDescending(st => st.Code) : query.OrderBy(st => st.Code),
            "createdat" => isDesc ? query.OrderByDescending(st => st.CreatedAt) : query.OrderBy(st => st.CreatedAt),
            "updatedat" => isDesc ? query.OrderByDescending(st => st.UpdatedAt) : query.OrderBy(st => st.UpdatedAt),
            "isactive" => isDesc ? query.OrderByDescending(st => st.IsActive) : query.OrderBy(st => st.IsActive),
            _ => isDesc ? query.OrderByDescending(st => st.Name) : query.OrderBy(st => st.Name)
        };

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task<ServiceType?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.ServiceTypes
            .FirstOrDefaultAsync(st => st.ServiceTypeId == id, cancellationToken);
    }

    public async Task<ServiceType?> GetByCodeAsync(string code, CancellationToken cancellationToken = default)
    {
        var normalized = code.Trim().ToUpperInvariant();
        return await _context.ServiceTypes
            .FirstOrDefaultAsync(st => st.Code.ToUpper() == normalized, cancellationToken);
    }

    public async Task<IReadOnlyList<ServiceTypeAllowedRole>> GetAllowedRolesAsync(
        Guid serviceTypeId,
        CancellationToken cancellationToken = default)
    {
        return await _context.ServiceTypeAllowedRoles
            .AsNoTracking()
            .Include(mapping => mapping.Role)
            .Where(mapping => mapping.ServiceTypeId == serviceTypeId)
            .OrderBy(mapping => mapping.Role.Code)
            .ToListAsync(cancellationToken);
    }

    public async Task ReplaceAllowedRolesAsync(
        Guid serviceTypeId,
        IReadOnlyCollection<ServiceTypeAllowedRole> mappings,
        CancellationToken cancellationToken = default)
    {
        var existingMappings = await _context.ServiceTypeAllowedRoles
            .Where(mapping => mapping.ServiceTypeId == serviceTypeId)
            .ToDictionaryAsync(mapping => mapping.RoleId, cancellationToken);

        var requestedRoleIds = mappings.Select(mapping => mapping.RoleId).ToHashSet();
        var now = DateTime.UtcNow;

        foreach (var mapping in mappings)
        {
            if (existingMappings.TryGetValue(mapping.RoleId, out var existing))
            {
                existing.CanView = mapping.CanView;
                existing.CanSubmit = mapping.CanSubmit;
                existing.UpdatedAt = now;
                continue;
            }

            mapping.ServiceTypeId = serviceTypeId;
            mapping.CreatedAt = now;
            mapping.UpdatedAt = now;
            await _context.ServiceTypeAllowedRoles.AddAsync(mapping, cancellationToken);
        }

        var removedMappings = existingMappings.Values
            .Where(mapping => !requestedRoleIds.Contains(mapping.RoleId));
        _context.ServiceTypeAllowedRoles.RemoveRange(removedMappings);
    }

    public async Task<bool> ExistsByCodeAsync(string code, Guid? excludeId = null, CancellationToken cancellationToken = default)
    {
        var normalized = code.Trim().ToUpperInvariant();
        var query = _context.ServiceTypes.AsQueryable();

        if (excludeId.HasValue)
        {
            query = query.Where(st => st.ServiceTypeId != excludeId.Value);
        }

        return await query.AnyAsync(st => st.Code.ToUpper() == normalized, cancellationToken);
    }

    public async Task<bool> IsReferencedAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var hasJobs = await _context.Jobs.AnyAsync(j => j.ServiceTypeId == id, cancellationToken);
        if (hasJobs) return true;

        var hasCommissionRules = await _context.CommissionRules.AnyAsync(cr => cr.ServiceTypeId == id, cancellationToken);
        return hasCommissionRules;
    }

    public async Task AddAsync(ServiceType serviceType, CancellationToken cancellationToken = default)
    {
        await _context.ServiceTypes.AddAsync(serviceType, cancellationToken);
    }

    public void Update(ServiceType serviceType)
    {
        _context.ServiceTypes.Update(serviceType);
    }

    public void Delete(ServiceType serviceType)
    {
        _context.ServiceTypes.Remove(serviceType);
    }
}
