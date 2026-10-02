namespace HRConnect.Application.Common.Models;

public sealed class SubmissionConsentSettings
{
    public const string SectionName = "SubmissionConsent";
    public int ExpirationHours { get; set; } = 48;
    public string ConfirmationUrlBase { get; set; } = "http://localhost:5041/api/v1/submission-consents";
}
