using HRConnect.Application.Common.Interfaces;

namespace HRConnect.Infrastructure.Services.Identity;

public class EmailNormalizer : IEmailNormalizer
{
    public string Normalize(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return string.Empty;
        }

        return email.Trim().ToLowerInvariant();
    }
}
