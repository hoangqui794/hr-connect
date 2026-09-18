namespace HRConnect.Infrastructure.Services.Email;

public class ResendSettings
{
    public const string SectionName = "Resend";

    public string ApiKey { get; set; } = string.Empty;

    public string FromEmail { get; set; } = "onboarding@resend.dev";

    public string FromName { get; set; } = "HRConnect System";
}
