namespace HRConnect.Application.Common.Models;

public sealed class SubmissionConsentSettings
{
    public const string SectionName = "SubmissionConsent";
    public int ExpirationHours { get; set; } = 48;
    public int ResendCooldownMinutes { get; set; } = 2;
    public int MaxEmailSends { get; set; } = 5;
    public string ConfirmationUrlBase { get; set; } = "http://localhost:5041/submission-consent";
}
