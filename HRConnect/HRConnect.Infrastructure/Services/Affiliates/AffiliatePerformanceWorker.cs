using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Features.Reports.Common;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Services.Affiliates;

/// <summary>
/// Worker chạy hằng ngày tính lại hiệu suất Affiliate kỳ tháng hiện tại và quý hiện tại cho mọi Affiliate có hoạt động.
/// </summary>
public sealed class AffiliatePerformanceWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AffiliatePerformanceWorker> _logger;
    private readonly TimeSpan _interval;

    public AffiliatePerformanceWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<AffiliatePerformanceWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        // Mặc định chạy mỗi 24 giờ một lần
        _interval = TimeSpan.FromHours(24);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Chờ 1 phút sau khi ứng dụng khởi động rồi mới chạy lần đầu
        try
        {
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

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
                _logger.LogError(ex, "Lỗi xảy ra trong AffiliatePerformanceWorker khi tính định kỳ.");
            }

            try
            {
                await Task.Delay(_interval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    public async Task RunOnceAsync(DateOnly today, CancellationToken cancellationToken)
    {
        // Kỳ tháng hiện tại
        var monthStart = new DateOnly(today.Year, today.Month, 1);
        var monthEnd = new DateOnly(today.Year, today.Month, DateTime.DaysInMonth(today.Year, today.Month));

        // Kỳ quý hiện tại
        int quarter = (today.Month - 1) / 3 + 1;
        int quarterStartMonth = (quarter - 1) * 3 + 1;
        var quarterStart = new DateOnly(today.Year, quarterStartMonth, 1);
        int quarterEndMonth = quarterStartMonth + 2;
        var quarterEnd = new DateOnly(today.Year, quarterEndMonth, DateTime.DaysInMonth(today.Year, quarterEndMonth));

        await using var scope = _scopeFactory.CreateAsyncScope();
        var calcService = scope.ServiceProvider.GetRequiredService<IAffiliatePerformanceCalculationService>();

        _logger.LogInformation("AffiliatePerformanceWorker: Bắt đầu tính hiệu suất tháng ({MonthStart} - {MonthEnd})...", monthStart, monthEnd);
        var monthCount = await calcService.RecalculateAllActiveAffiliatesAsync(monthStart, monthEnd, cancellationToken);

        _logger.LogInformation("AffiliatePerformanceWorker: Bắt đầu tính hiệu suất quý ({QuarterStart} - {QuarterEnd})...", quarterStart, quarterEnd);
        var quarterCount = await calcService.RecalculateAllActiveAffiliatesAsync(quarterStart, quarterEnd, cancellationToken);

        _logger.LogInformation("AffiliatePerformanceWorker: Hoàn tất cập nhật hiệu suất (Tháng: {MonthCount}, Quý: {QuarterCount})", monthCount, quarterCount);
    }
}
