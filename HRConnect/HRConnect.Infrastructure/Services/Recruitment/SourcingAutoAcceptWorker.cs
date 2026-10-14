using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Recruitment.Sourcing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Infrastructure.Services.Recruitment;

/// <summary>
/// MF-03 (CV_SOURCING): a delivered CV the Client has not answered by the end of the review
/// window counts as accepted (AUTO_ACCEPTED). Runs on the MF-05 worker interval; each item in its own scope.
/// </summary>
public sealed class SourcingAutoAcceptWorker : BackgroundService
{
    private const int BatchSize = 100;

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SourcingAutoAcceptWorker> _logger;
    private readonly TimeSpan _interval;

    public SourcingAutoAcceptWorker(IServiceScopeFactory scopeFactory, IOptions<Mf05Settings> settings, ILogger<SourcingAutoAcceptWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _interval = TimeSpan.FromMinutes(Math.Max(1, settings.Value.WorkerIntervalMinutes));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(_interval);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunOnceAsync(DateTime.UtcNow, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "MF-03: không thể tự chấp nhận CV hết hạn xem xét.");
            }

            if (!await timer.WaitForNextTickAsync(stoppingToken)) break;
        }
    }

    internal async Task<int> RunOnceAsync(DateTime now, CancellationToken cancellationToken)
    {
        IReadOnlyList<Guid> ids;
        await using (var discovery = _scopeFactory.CreateAsyncScope())
        {
            ids = await discovery.ServiceProvider.GetRequiredService<ISourcingDeliveryRepository>()
                .GetDueForAutoAcceptAsync(now, BatchSize, cancellationToken);
        }

        var accepted = 0;
        foreach (var id in ids)
        {
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                if (await scope.ServiceProvider.GetRequiredService<ISourcingAutoAcceptService>().AutoAcceptAsync(id, now, cancellationToken))
                {
                    accepted++;
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // One bad row must not stop the rest of the batch.
                _logger.LogError(ex, "MF-03: lỗi khi tự chấp nhận CV {DeliveryId}.", id);
            }
        }

        if (accepted > 0)
        {
            _logger.LogInformation("MF-03: {Count} CV hết hạn xem xét được tính là đã chấp nhận.", accepted);
        }

        return accepted;
    }
}
