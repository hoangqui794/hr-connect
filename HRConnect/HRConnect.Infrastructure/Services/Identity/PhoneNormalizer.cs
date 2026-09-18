using System.Text.RegularExpressions;
using HRConnect.Application.Common.Interfaces;

namespace HRConnect.Infrastructure.Services.Identity;

public partial class PhoneNormalizer : IPhoneNormalizer
{
    [GeneratedRegex(@"[^\d+]")]
    private static partial Regex NonDigitOrPlusRegex();

    public string? Normalize(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
        {
            return null;
        }

        var cleaned = NonDigitOrPlusRegex().Replace(phone.Trim(), "");

        if (cleaned.StartsWith("+84"))
        {
            cleaned = "0" + cleaned[3..];
        }
        else if (cleaned.StartsWith("84") && cleaned.Length >= 11)
        {
            cleaned = "0" + cleaned[2..];
        }

        return cleaned;
    }
}
