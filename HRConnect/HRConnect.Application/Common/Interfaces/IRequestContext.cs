using System.Net;

namespace HRConnect.Application.Common.Interfaces;

public interface IRequestContext
{
    Guid? UserId { get; }

    Guid? CorrelationId { get; }

    IPAddress? IpAddress { get; }

    string? UserAgent { get; }
}
