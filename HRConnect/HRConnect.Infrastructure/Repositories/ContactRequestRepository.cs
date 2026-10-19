using HRConnect.Application.Features.Contact;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class ContactRequestRepository : IContactRequestRepository
{
    private readonly ApplicationDbContext _context;

    public ContactRequestRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(ContactRequest request, CancellationToken cancellationToken = default) =>
        await _context.ContactRequests.AddAsync(request, cancellationToken);

    public Task<int> CountFromIpSinceAsync(string sourceIpHash, DateTime since, CancellationToken cancellationToken = default) =>
        _context.ContactRequests.CountAsync(c => c.SourceIpHash == sourceIpHash && c.CreatedAt >= since, cancellationToken);

    public Task<ContactRequest?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken = default) =>
        _context.ContactRequests.FirstOrDefaultAsync(c => c.ContactRequestId == id, cancellationToken);

    public async Task<(IReadOnlyList<ContactRequest> Items, int TotalCount)> GetPageAsync(
        string? status, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var query = _context.ContactRequests.AsNoTracking();
        if (status != null)
        {
            query = query.Where(c => c.Status == status);
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            // New requests first, oldest first: the operations queue.
            .OrderBy(c => c.Status == "NEW" ? 0 : c.Status == "CONTACTED" ? 1 : 2)
            .ThenBy(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        return (items, total);
    }
}
