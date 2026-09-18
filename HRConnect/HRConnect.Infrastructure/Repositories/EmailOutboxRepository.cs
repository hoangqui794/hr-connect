using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;

namespace HRConnect.Infrastructure.Repositories;

public class EmailOutboxRepository : IEmailOutboxRepository
{
    private readonly ApplicationDbContext _context;

    public EmailOutboxRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(EmailOutbox emailOutbox, CancellationToken cancellationToken = default)
    {
        await _context.EmailOutboxes.AddAsync(emailOutbox, cancellationToken);
    }
}
