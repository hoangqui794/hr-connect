namespace HRConnect.Application.Common.Models;

public class EmailResult
{
    public bool IsSuccess { get; set; }
    public string? MessageId { get; set; }
    public string? ErrorMessage { get; set; }

    public static EmailResult Success(string messageId) => new()
    {
        IsSuccess = true,
        MessageId = messageId
    };

    public static EmailResult Failure(string errorMessage) => new()
    {
        IsSuccess = false,
        ErrorMessage = errorMessage
    };
}
