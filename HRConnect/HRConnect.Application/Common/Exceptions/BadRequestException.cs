namespace HRConnect.Application.Common.Exceptions;

public class BadRequestException : Exception
{
    public string? ErrorCode { get; }

    public BadRequestException(string message) : base(message)
    {
    }

    public BadRequestException(string arg1, string arg2) 
        : base(ResolveMessage(arg1, arg2))
    {
        ErrorCode = ResolveErrorCode(arg1, arg2);
    }

    private static bool LooksLikeCode(string s) =>
        !string.IsNullOrWhiteSpace(s) && s.Length <= 64 && !s.Contains(' ') &&
        s.All(c => char.IsAsciiLetterUpper(c) || char.IsDigit(c) || c == '_' || c == '-');

    private static string ResolveErrorCode(string arg1, string arg2)
    {
        if (LooksLikeCode(arg2) && !LooksLikeCode(arg1)) return arg2;
        if (LooksLikeCode(arg1) && !LooksLikeCode(arg2)) return arg1;
        return arg1; // fallback
    }

    private static string ResolveMessage(string arg1, string arg2)
    {
        if (LooksLikeCode(arg2) && !LooksLikeCode(arg1)) return arg1;
        if (LooksLikeCode(arg1) && !LooksLikeCode(arg2)) return arg2;
        return arg2; // fallback
    }
}
