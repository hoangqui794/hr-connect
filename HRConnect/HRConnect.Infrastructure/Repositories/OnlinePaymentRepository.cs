using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public sealed class OnlinePaymentRepository(ApplicationDbContext context) : IOnlinePaymentRepository
{
    public Task AddAsync(OnlinePayment payment, CancellationToken cancellationToken = default) =>
        context.OnlinePayments.AddAsync(payment, cancellationToken).AsTask();

    public Task<OnlinePayment?> GetByTxnRefAsync(string txnRef, CancellationToken cancellationToken = default) =>
        context.OnlinePayments.FirstOrDefaultAsync(p => p.TxnRef == txnRef, cancellationToken);

    public async Task<bool> TryClaimAsync(Guid onlinePaymentId, DateTime now, CancellationToken cancellationToken = default)
    {
        if (!context.Database.IsRelational())
        {
            // In-memory tests: no concurrent callbacks, so a tracked update is enough.
            var payment = await context.OnlinePayments.FirstOrDefaultAsync(p => p.OnlinePaymentId == onlinePaymentId, cancellationToken);
            if (payment is not { Status: OnlinePaymentStates.Pending }) return false;
            payment.Status = OnlinePaymentStates.Processing;
            payment.UpdatedAt = now;
            await context.SaveChangesAsync(cancellationToken);
            return true;
        }

        var claimed = await context.OnlinePayments
            .Where(p => p.OnlinePaymentId == onlinePaymentId && p.Status == OnlinePaymentStates.Pending)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.Status, OnlinePaymentStates.Processing)
                .SetProperty(p => p.UpdatedAt, now), cancellationToken);
        return claimed == 1;
    }

    public async Task ReleaseClaimAsync(Guid onlinePaymentId, CancellationToken cancellationToken = default)
    {
        // Drop whatever the failed attempt left tracked, so nothing half-done is saved later in this request.
        context.ChangeTracker.Clear();
        if (!context.Database.IsRelational())
        {
            var payment = await context.OnlinePayments.FirstOrDefaultAsync(p => p.OnlinePaymentId == onlinePaymentId, cancellationToken);
            if (payment is { Status: OnlinePaymentStates.Processing })
            {
                payment.Status = OnlinePaymentStates.Pending;
                await context.SaveChangesAsync(cancellationToken);
            }
            return;
        }

        await context.OnlinePayments
            .Where(p => p.OnlinePaymentId == onlinePaymentId && p.Status == OnlinePaymentStates.Processing)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.Status, OnlinePaymentStates.Pending)
                .SetProperty(p => p.UpdatedAt, DateTime.UtcNow), cancellationToken);
    }
}
