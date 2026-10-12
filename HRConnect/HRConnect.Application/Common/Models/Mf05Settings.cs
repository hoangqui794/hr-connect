namespace HRConnect.Application.Common.Models;

/// <summary>
/// MF-05 technical settings (appsettings). Business numbers — fee multiplier, warranty days, payment
/// due days — are Admin-configurable in system_setting (see Common/Settings/BusinessSettingKeys).
/// </summary>
public sealed class Mf05Settings
{
    public const string SectionName = "Mf05";

    /// <summary>How often the background worker checks warranties and overdue fees.</summary>
    public int WorkerIntervalMinutes { get; set; } = 60;

    // Legacy appsettings overrides read by Infrastructure.Services.BusinessSettings (MF-01).
    // 0 means "not set": MF-05 takes these numbers from the job, then from the Admin settings.
    public int WarrantyDays { get; set; }

    public decimal HeadhuntFeeMultiplier { get; set; }

    public int PaymentDueDays { get; set; }
}
