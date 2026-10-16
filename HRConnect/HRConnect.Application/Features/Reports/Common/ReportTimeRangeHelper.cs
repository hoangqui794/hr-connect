using System;
using HRConnect.Application.Common.Exceptions;

namespace HRConnect.Application.Features.Reports.Common;

public sealed record ReportTimeRange(
    DateOnly FromDate,
    DateOnly ToDate,
    DateTime FromUtc,
    DateTime ToUtcPlusOne)
{
    private static readonly TimeSpan VietnamOffset = TimeSpan.FromHours(7);

    public static ReportTimeRange Create(DateOnly? from, DateOnly? to)
    {
        var nowUtc = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(nowUtc.Add(VietnamOffset));

        var fromDate = from ?? new DateOnly(today.Year, 1, 1);
        var toDate = to ?? today;

        if (fromDate > toDate)
        {
            throw new BadRequestException("Ngày bắt đầu (from) không được lớn hơn ngày kết thúc (to).");
        }

        // Chuyển sang UTC theo múi giờ Việt Nam (UTC+7)
        var fromUtc = DateTime.SpecifyKind(fromDate.ToDateTime(TimeOnly.MinValue).Subtract(VietnamOffset), DateTimeKind.Utc);
        var toUtcPlusOne = DateTime.SpecifyKind(toDate.AddDays(1).ToDateTime(TimeOnly.MinValue).Subtract(VietnamOffset), DateTimeKind.Utc);

        return new ReportTimeRange(fromDate, toDate, fromUtc, toUtcPlusOne);
    }
}
