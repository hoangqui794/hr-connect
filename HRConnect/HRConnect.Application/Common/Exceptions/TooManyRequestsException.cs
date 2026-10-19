namespace HRConnect.Application.Common.Exceptions;

/// <summary>A business limit on how often something may be done was reached (HTTP 429).</summary>
public class TooManyRequestsException : Exception
{
    public TooManyRequestsException(string message, string? errorCode = null) : base(message)
    {
        ErrorCode = errorCode;
    }

    public string? ErrorCode { get; }
}
