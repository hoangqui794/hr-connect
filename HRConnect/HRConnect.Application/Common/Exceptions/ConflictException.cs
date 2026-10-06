namespace HRConnect.Application.Common.Exceptions;

public class ConflictException : Exception
{
    public ConflictException(string message, string? errorCode = null, Exception? innerException = null)
        : base(message, innerException)
    {
        ErrorCode = errorCode;
    }

    public string? ErrorCode { get; }
}
