namespace HRConnect.Infrastructure.Services.Email;

public class ResendSettings
{
    public const string SectionName = "Resend";

    public string ApiKey { get; set; } = string.Empty;

    public string FromEmail { get; set; } = "no-reply@hrconnectvn.online";

    public string FromName { get; set; } = "HR Connect";
}
