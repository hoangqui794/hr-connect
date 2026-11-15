using System;

namespace HRConnect.Application.Common;

/// <summary>
/// Chuẩn hóa quy đổi ngày nghiệp vụ (DateOnly) sang múi giờ Việt Nam (UTC+7).
/// </summary>
public static class VietnamTime
{
    public static readonly TimeSpan UtcOffset = TimeSpan.FromHours(7);

    public static DateOnly Today(TimeProvider? timeProvider = null)
        => ToDateOnly((timeProvider ?? TimeProvider.System).GetUtcNow().UtcDateTime);

    public static DateOnly Today(DateTime utcNow) => ToDateOnly(utcNow);

    public static DateOnly ToDateOnly(DateTime dateTime)
    {
        var utc = dateTime.Kind switch
        {
            DateTimeKind.Utc => dateTime,
            DateTimeKind.Local => dateTime.ToUniversalTime(),
            _ => DateTime.SpecifyKind(dateTime, DateTimeKind.Utc)
        };

        return DateOnly.FromDateTime(utc.Add(UtcOffset));
    }
}
