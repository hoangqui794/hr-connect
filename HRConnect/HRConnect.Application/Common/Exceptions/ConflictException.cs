namespace HRConnect.Application.Common.Exceptions;

public class ConflictException : Exception
{
    public ConflictException(string message, string? errorCode = null, Exception? innerException = null)
        : base(message, innerException)
    {
        ErrorCode = errorCode;
    }

    public ConflictException(
        string message,
        string errorCode,
        IReadOnlyDictionary<string, object?> details,
        Exception? innerException = null)
        : base(message, innerException)
    {
        ErrorCode = errorCode;
        Details = details;
    }

    public string? ErrorCode { get; }

    /// <summary>
    /// Optional client-safe context for resolving the conflict. Never place actor identity,
    /// contact details, internal notes, or other private business data in this collection.
    /// </summary>
    public IReadOnlyDictionary<string, object?>? Details { get; }
}
