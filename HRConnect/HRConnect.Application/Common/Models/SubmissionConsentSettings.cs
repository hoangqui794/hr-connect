namespace HRConnect.Application.Common.Models;

public sealed class SubmissionConsentSettings
{
    public const string SectionName = "SubmissionConsent";
    public int ExpirationHours { get; set; } = 48;
    public int ResendCooldownMinutes { get; set; } = 2;
    public int MaxEmailSends { get; set; } = 5;
    public string ConfirmationUrlBase { get; set; } = "http://localhost:5173/submission-consent";

    /// <summary>
    /// Thời hạn, thời gian chờ và số lần gửi do Platform Admin chỉnh trên trang Cài đặt (BusinessSettingKeys.Consent*).
    /// Giá trị trong appsettings chỉ dùng khi không đọc được cài đặt.
    /// </summary>
    public static async Task<int> ReadAsync(
        HRConnect.Application.Common.Settings.IAdminBusinessSettings? settings, string key, int fallback, CancellationToken cancellationToken)
    {
        if (settings == null) return fallback;
        var value = await settings.GetIntAsync(key, cancellationToken);
        return value > 0 ? value : fallback;
    }
}
