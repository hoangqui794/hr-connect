using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Finance.Common;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Infrastructure.Services.Finance;

/// <summary>
/// MF-05 clock: passes warranties whose 30 days are over (earning their commissions in full)
/// and moves unpaid service fees to DUE (reminder window, mf05.fee.due_reminder_days) and then OVERDUE.
/// Each item runs in its own scope.
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
        IReadOnlyList<Guid> dueSoonIds;
        IReadOnlyList<Guid> expiredSlotIds;
        IReadOnlyList<Guid> paidWaitingSlotIds;
        var now = DateTime.UtcNow;
        int reminderDays;
        await using (var discovery = _scopeFactory.CreateAsyncScope())
        {
            var repository = discovery.ServiceProvider.GetRequiredService<IFinanceRepository>();
            placementIds = await repository.GetPlacementIdsWithWarrantyEndingAsync(today, BatchSize, cancellationToken);
            feeIds = await repository.GetOverdueServiceFeeIdsAsync(today, BatchSize, cancellationToken);
            reminderDays = await discovery.ServiceProvider.GetRequiredService<IAdminBusinessSettings>()
                .GetIntAsync(BusinessSettingKeys.FeeDueReminderDays, cancellationToken);
            dueSoonIds = await repository.GetServiceFeeIdsDueSoonAsync(today, today.AddDays(reminderDays), BatchSize, cancellationToken);
            expiredSlotIds = await repository.GetExpiredReplacementSlotIdsAsync(now, BatchSize, cancellationToken);
            paidWaitingSlotIds = await repository.GetPaidWaitingReplacementSlotIdsAsync(BatchSize, cancellationToken);
        }

        var passed = 0;
        foreach (var placementId in placementIds)
        {
            passed += await RunItemAsync(service => service.CompleteWarrantyAsync(placementId, today, cancellationToken), placementId) ? 1 : 0;
        }

        var due = 0;
        foreach (var feeId in dueSoonIds)
        {
            due += await RunItemAsync(service => service.MarkServiceFeeDueAsync(feeId, today, reminderDays, cancellationToken: cancellationToken), feeId) ? 1 : 0;
        }

        var overdue = 0;
        foreach (var feeId in feeIds)
        {
            overdue += await RunItemAsync(service => service.MarkServiceFeeOverdueAsync(feeId, today, cancellationToken: cancellationToken), feeId) ? 1 : 0;
        }

        var expired = 0;
        foreach (var slotId in expiredSlotIds)
        {
            expired += await RunItemAsync(service => service.ExpireReplacementSlotAsync(slotId, now, cancellationToken), slotId) ? 1 : 0;
        }

        // A slot left WAITING_PAYMENT although its fee is already PAID opens here.
        var reopened = 0;
        foreach (var slotId in paidWaitingSlotIds)
        {
            reopened += await RunItemAsync(service => service.OpenPaidReplacementSlotAsync(slotId, now, cancellationToken), slotId) ? 1 : 0;
        }

        if (passed + due + overdue + expired + reopened > 0)
        {
            _logger.LogInformation(
                "MF-05: {Passed} bảo hành đã qua (hoa hồng EARNED), {Due} công nợ sắp đến hạn, {Overdue} công nợ quá hạn, {Expired} suất thay thế hết hạn, {Reopened} suất thay thế đã trả phí được mở.",
                passed, due, overdue, expired, reopened);
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
