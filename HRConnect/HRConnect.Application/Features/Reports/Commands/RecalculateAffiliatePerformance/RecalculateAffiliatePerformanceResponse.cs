using System;

namespace HRConnect.Application.Features.Reports.Commands.RecalculateAffiliatePerformance;

public class RecalculateAffiliatePerformanceResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Tính toán lại hiệu suất thành công.";
    public int RecalculatedCount { get; set; }
    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
}
