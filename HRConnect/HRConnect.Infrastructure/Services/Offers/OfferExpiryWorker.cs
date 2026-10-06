using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Offers.Common;
using HRConnect.Domain.Constants;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Services.Offers;

public sealed class OfferExpiryWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OfferExpiryWorker> _logger;

    public OfferExpiryWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<OfferExpiryWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ExpireBatchAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Không thể cập nhật các offer hết hạn.");
            }

            if (!await timer.WaitForNextTickAsync(stoppingToken)) break;
        }
    }

    internal async Task ExpireBatchAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        List<Guid> expiredOfferIds;

        await using (var discoveryScope = _scopeFactory.CreateAsyncScope())
        {
            var discoveryContext = discoveryScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            expiredOfferIds = await discoveryContext.Offers.AsNoTracking()
                .Where(offer => offer.Status == OfferStates.Sent &&
                    offer.ExpiryDate.HasValue && offer.ExpiryDate.Value < today)
                .OrderBy(offer => offer.ExpiryDate)
                .Take(100)
                .Select(offer => offer.OfferId)
                .ToListAsync(cancellationToken);
        }

        var expiredCount = 0;
        foreach (var offerId in expiredOfferIds)
        {
            await using var itemScope = _scopeFactory.CreateAsyncScope();
            var context = itemScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var expiryService = itemScope.ServiceProvider.GetRequiredService<IOfferExpiryService>();
            var offer = await context.Offers
                .Include(item => item.Application)
                    .ThenInclude(application => application.Candidate)
                .SingleOrDefaultAsync(item => item.OfferId == offerId, cancellationToken);
            if (offer == null)
            {
                continue;
            }

            try
            {
                if (await expiryService.ExpireAsync(offer, now, cancellationToken))
                {
                    expiredCount++;
                }
            }
            catch (ConflictException exception) when (exception.ErrorCode == "CONCURRENT_UPDATE")
            {
                _logger.LogInformation(
                    "Bỏ qua offer {OfferId} vì trạng thái vừa được cập nhật bởi yêu cầu khác.",
                    offerId);
            }
        }

        if (expiredCount > 0)
        {
            _logger.LogInformation("Đã chuyển {Count} offer quá hạn sang EXPIRED.", expiredCount);
        }
    }
}
