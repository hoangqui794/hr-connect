using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IEmailOutboxRepository
{
    Task AddAsync(EmailOutbox emailOutbox, CancellationToken cancellationToken = default);
}
