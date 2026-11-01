using System.Text.RegularExpressions;

namespace HRConnect.Application.Common.Validation;

public static class VietnamPhoneNumber
{
    private static readonly Regex ValidPhoneRegex = new(
        @"^(?:\+84|0)(?:3[2-9]|5[25689]|7(?:0|[6-9])|8[1-9]|9[0-9])[0-9]{7}$",
        RegexOptions.Compiled);

    private static readonly Regex FormattingCharactersRegex = new(
        @"[\s().-]",
        RegexOptions.Compiled);

    public static bool IsValid(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
            return false;

        var compactPhone = FormattingCharactersRegex.Replace(phone.Trim(), string.Empty);
        return ValidPhoneRegex.IsMatch(compactPhone);
    }
}
