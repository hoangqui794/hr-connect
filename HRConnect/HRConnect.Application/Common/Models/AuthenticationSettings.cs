namespace HRConnect.Application.Common.Models;

public class AuthenticationSettings
{
    public const string SectionName = "Authentication";

    public OtpSettings Otp { get; set; } = new();
}

public class OtpSettings
{
    public int Length { get; set; } = 6;

    public int ExpirationMinutes { get; set; } = 15;
}
