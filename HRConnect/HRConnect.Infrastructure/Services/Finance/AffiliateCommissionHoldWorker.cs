using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Finance.Common;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Infrastructure.Services.Finance;

/// <summary>
/// MF-05: holds not-yet-earned commissions of suspended affiliates and releases them on reactivation
/// (<see cref="IAffiliateCommissionHoldService"/>). Runs on the MF-05 worker interval so the Admin
/// suspend / reactivate code stays untouched.
/// </summary>
public sealed class AffiliateCommissionHoldWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AffiliateCommissionHoldWorker> _logger;
    private readonly TimeSpan _interval;

    public AffiliateCommissionHoldWorker(IServiceScopeFactory scopeFactory, IOptions<Mf05Settings> settings, ILogger<AffiliateCommissionHoldWorker> logger)
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
                await using var scope = _scopeFactory.CreateAsyncScope();
                var (held, released) = await scope.ServiceProvider.GetRequiredService<IAffiliateCommissionHoldService>()
                    .RunAsync(stoppingToken);
                if (held + released > 0)
                {
                    _logger.LogInformation("MF-05: tạm giữ {Held}, trả lại {Released} hoa hồng của Affiliate bị khóa / mở khóa.", held, released);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "MF-05: không thể xử lý hoa hồng của Affiliate bị khóa.");
            }

            if (!await timer.WaitForNextTickAsync(stoppingToken)) break;
        }
    }
}
