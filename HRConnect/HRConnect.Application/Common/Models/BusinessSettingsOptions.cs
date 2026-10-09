namespace HRConnect.Application.Common.Models;

/// <summary>
/// Các thiết lập kinh doanh đọc từ file cấu hình appsettings.json (Section "BusinessSettings").
/// </summary>
public sealed class BusinessSettingsOptions
{
    public const string SectionName = "BusinessSettings";

    public decimal DefaultHeadhuntFeeMultiplier { get; set; } = 1.5m;

    public int DefaultWarrantyDays { get; set; } = 30;

    public int DefaultPaymentDueDays { get; set; } = 14;

    public decimal DefaultSourcingPricePerCv { get; set; } = 100_000m;

    public int FreeActiveJobLimit { get; set; } = 1;

    public int FreeCooldownMonths { get; set; } = 2;

    public decimal StandardPostingPackagePrice { get; set; } = 1_500_000m;

    public int StandardPostingDurationDays { get; set; } = 30;
}
