using HRConnect.Application.Common.Models;

namespace HRConnect.Application.Common.Interfaces;

public interface IEmailService
{
    /// <summary>
    /// Gửi một email đơn lẻ đến một người nhận.
    /// </summary>
    Task<EmailResult> SendEmailAsync(
        string to, 
        string subject, 
        string bodyHtml, 
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gửi email đến danh sách nhiều người nhận.
    /// </summary>
    Task<EmailResult> SendEmailAsync(
        IEnumerable<string> to, 
        string subject, 
        string bodyHtml, 
        CancellationToken cancellationToken = default);
}
