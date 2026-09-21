using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Admin.Approvals.GetApprovalList;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class ApprovalRepository : IApprovalRepository
{
    private readonly ApplicationDbContext _context;

    public ApprovalRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<(List<ApprovalListItemDto> Items, int TotalCount)> GetApprovalsAsync(
        string? type,
        string? status,
        string? search,
        string sortBy,
        string sortDirection,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        IQueryable<ApprovalListItemDto>? query = null;

        var affiliateQuery = _context.AffiliateApplications
            .AsNoTracking()
            .Select(a => new ApprovalListItemDto
            {
                ApprovalId = a.AffiliateApplicationId,
                Type = "AFFILIATE",
                UserId = a.UserId,
                Email = a.User.Email,
                DisplayName = a.DisplayName ?? a.User.DisplayName ?? string.Empty,
                CompanyName = null,
                Status = a.Status,
                SubmittedAt = a.SubmittedAt
            });

        var clientQuery = _context.CompanyVerificationRequests
            .AsNoTracking()
            .Select(c => new ApprovalListItemDto
            {
                ApprovalId = c.CompanyVerificationRequestId,
                Type = "CLIENT",
                UserId = c.SubmittedBy,
                Email = c.SubmittedByNavigation.Email,
                DisplayName = c.SubmittedByNavigation.DisplayName ?? string.Empty,
                CompanyName = c.Company.CompanyName,
                Status = c.Status,
                SubmittedAt = c.SubmittedAt
            });

        if (string.Equals(type, "AFFILIATE", StringComparison.OrdinalIgnoreCase))
        {
            query = affiliateQuery;
        }
        else if (string.Equals(type, "CLIENT", StringComparison.OrdinalIgnoreCase))
        {
            query = clientQuery;
        }
        else
        {
            query = affiliateQuery.Concat(clientQuery);
        }

        // 1. Lọc theo Status
        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim().ToUpperInvariant();
            if (normalizedStatus == "PENDING")
            {
                // Trạng thái chờ admin duyệt gồm cả PENDING và UNDER_REVIEW
                query = query.Where(x => x.Status == "PENDING" || x.Status == "UNDER_REVIEW");
            }
            else
            {
                query = query.Where(x => x.Status == normalizedStatus);
            }
        }

        // 2. Tìm kiếm (Search)
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            query = query.Where(x =>
                EF.Functions.ILike(x.Email, $"%{s}%") ||
                EF.Functions.ILike(x.DisplayName, $"%{s}%") ||
                (x.CompanyName != null && EF.Functions.ILike(x.CompanyName, $"%{s}%")));
        }

        // 3. Sắp xếp (Sorting)
        var isAsc = string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase);
        query = sortBy switch
        {
            "status" => isAsc
                ? query.OrderBy(x => x.Status).ThenByDescending(x => x.SubmittedAt)
                : query.OrderByDescending(x => x.Status).ThenByDescending(x => x.SubmittedAt),
            "type" => isAsc
                ? query.OrderBy(x => x.Type).ThenByDescending(x => x.SubmittedAt)
                : query.OrderByDescending(x => x.Type).ThenByDescending(x => x.SubmittedAt),
            _ => isAsc
                ? query.OrderBy(x => x.SubmittedAt)
                : query.OrderByDescending(x => x.SubmittedAt)
        };

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }
}
