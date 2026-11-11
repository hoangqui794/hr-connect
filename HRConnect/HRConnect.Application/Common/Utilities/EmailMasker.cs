namespace HRConnect.Application.Common.Utilities;

public static class EmailMasker
{
    public static string Mask(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return string.Empty;

        var parts = email.Trim().Split('@');
        if (parts.Length != 2 || string.IsNullOrWhiteSpace(parts[0]) || string.IsNullOrWhiteSpace(parts[1]))
            return email;

        var name = parts[0];
        var domain = parts[1];

        if (name.Length <= 1)
            return $"{name}*@{domain}";

        if (name.Length == 2)
            return $"{name[0]}*@{domain}";

        return $"{name[0]}***{name[^1]}@{domain}";
    }
}

