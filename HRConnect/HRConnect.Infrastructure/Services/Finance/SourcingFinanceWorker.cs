using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Finance.Common;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Infrastructure.Services.Finance;

/// <summary>
/// MF-05 (CV_SOURCING, docs/MF05 section E8): creates the DEPOSIT of every approved CV_SOURCING job,
/// and settles CLOSED jobs that were not settled when their target was reached. Runs on the MF-05
/// worker interval; each job in its own scope so one bad row does not stop the batch.
/// </summary>
public sealed class SourcingFinanceWorker : BackgroundService
{
    private const int BatchSize = 100;

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SourcingFinanceWorker> _logger;
    private readonly TimeSpan _interval;

    public SourcingFinanceWorker(IServiceScopeFactory scopeFactory, IOptions<Mf05Settings> settings, ILogger<SourcingFinanceWorker> logger)
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
                await RunOnceAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "MF-05: không thể tạo cọc / quyết toán job CV Sourcing.");
            }

            if (!await timer.WaitForNextTickAsync(stoppingToken)) break;
        }
    }

    internal async Task<(int Deposits, int Settlements)> RunOnceAsync(CancellationToken cancellationToken)
    {
        IReadOnlyList<Guid> depositJobIds;
        IReadOnlyList<Guid> settlementJobIds;
        await using (var discovery = _scopeFactory.CreateAsyncScope())
        {
            var finance = discovery.ServiceProvider.GetRequiredService<IFinanceRepository>();
            depositJobIds = await finance.GetSourcingJobIdsAwaitingDepositAsync(BatchSize, cancellationToken);
            settlementJobIds = await finance.GetClosedSourcingJobIdsAwaitingSettlementAsync(BatchSize, cancellationToken);
        }

        var deposits = 0;
        foreach (var jobId in depositJobIds)
        {
            if (await RunForJobAsync(jobId, settle: false, cancellationToken))
            {
                deposits++;
            }
        }

        var settlements = 0;
        foreach (var jobId in settlementJobIds)
        {
            if (await RunForJobAsync(jobId, settle: true, cancellationToken))
            {
                settlements++;
            }
        }

        if (deposits + settlements > 0)
        {
            _logger.LogInformation("MF-05: tạo {Deposits} phiếu cọc, quyết toán {Settlements} job CV Sourcing.", deposits, settlements);
        }

        return (deposits, settlements);
    }

    private async Task<bool> RunForJobAsync(Guid jobId, bool settle, CancellationToken cancellationToken)
    {
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var job = await scope.ServiceProvider.GetRequiredService<IFinanceRepository>()
                .GetJobForFinanceAsync(jobId, cancellationToken);
            if (job == null)
            {
                return false;
            }

            var sourcing = scope.ServiceProvider.GetRequiredService<ISourcingFinanceService>();
            var fee = settle
                ? await sourcing.SettleAsync(job, null, cancellationToken)
                : await sourcing.EnsureDepositAsync(job, null, cancellationToken);
            await scope.ServiceProvider.GetRequiredService<IUnitOfWork>().SaveChangesAsync(cancellationToken);
            return fee != null;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "MF-05: lỗi khi {Action} job CV Sourcing {JobId}.", settle ? "quyết toán" : "tạo cọc", jobId);
            return false;
        }
    }
}
