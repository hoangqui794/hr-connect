namespace HRConnect.Application.Common.Models;

/// <summary>MF-05 defaults. Business values, configurable per environment.</summary>
public sealed class Mf05Settings
{
    public const string SectionName = "Mf05";

    /// <summary>Warranty length; the HEADHUNT_COD commission is earned in full when it passes.</summary>
    public int WarrantyDays { get; set; } = 30;

    /// <summary>HEADHUNT_COD service fee = offer gross monthly salary × this multiplier.</summary>
    public decimal HeadhuntFeeMultiplier { get; set; } = 1.5m;

    /// <summary>Days after the start date the Client has to pay the service fee.</summary>
    public int PaymentDueDays { get; set; } = 14;

    /// <summary>How often the background worker checks warranties and overdue fees.</summary>
    public int WorkerIntervalMinutes { get; set; } = 60;
}
