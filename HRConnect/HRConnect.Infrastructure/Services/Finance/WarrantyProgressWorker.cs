using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Finance.Common;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Infrastructure.Services.Finance;

/// <summary>
/// MF-05 clock: passes warranties whose 30 days are over (earning their commissions in full)
/// and marks unpaid service fees past their due date as OVERDUE. Each item runs in its own scope.
/// </summary>
public sealed class WarrantyProgressWorker : BackgroundService
{
    private const int BatchSize = 100;

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<WarrantyProgressWorker> _logger;
    private readonly TimeSpan _interval;

    public WarrantyProgressWorker(IServiceScopeFactory scopeFactory, IOptions<Mf05Settings> settings, ILogger<WarrantyProgressWorker> logger)
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
                await RunOnceAsync(DateOnly.FromDateTime(DateTime.UtcNow), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "MF-05: không thể xử lý bảo hành và công nợ đến hạn.");
            }

            if (!await timer.WaitForNextTickAsync(stoppingToken)) break;
        }
    }

    internal async Task RunOnceAsync(DateOnly today, CancellationToken cancellationToken)
    {
        IReadOnlyList<Guid> placementIds;
        IReadOnlyList<Guid> feeIds;
        await using (var discovery = _scopeFactory.CreateAsyncScope())
        {
            var repository = discovery.ServiceProvider.GetRequiredService<IFinanceRepository>();
            placementIds = await repository.GetPlacementIdsWithWarrantyEndingAsync(today, BatchSize, cancellationToken);
            feeIds = await repository.GetOverdueServiceFeeIdsAsync(today, BatchSize, cancellationToken);
        }

        var passed = 0;
        foreach (var placementId in placementIds)
        {
            passed += await RunItemAsync(service => service.CompleteWarrantyAsync(placementId, today, cancellationToken), placementId) ? 1 : 0;
        }

        var overdue = 0;
        foreach (var feeId in feeIds)
        {
            overdue += await RunItemAsync(service => service.MarkServiceFeeOverdueAsync(feeId, today, cancellationToken), feeId) ? 1 : 0;
        }

        if (passed + overdue > 0)
        {
            _logger.LogInformation("MF-05: {Passed} bảo hành đã qua (hoa hồng EARNED), {Overdue} công nợ quá hạn.", passed, overdue);
        }
    }

    private async Task<bool> RunItemAsync(Func<IWarrantyProgressService, Task<bool>> work, Guid id)
    {
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            return await work(scope.ServiceProvider.GetRequiredService<IWarrantyProgressService>());
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // One bad row must not stop the rest of the batch.
            _logger.LogError(ex, "MF-05: lỗi khi xử lý {Id}.", id);
            return false;
        }
    }
}
