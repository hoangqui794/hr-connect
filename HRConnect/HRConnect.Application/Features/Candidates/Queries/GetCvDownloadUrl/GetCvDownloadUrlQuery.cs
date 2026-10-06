using HRConnect.Application.Common.Models;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Queries.GetCvDownloadUrl;

public class GetCvDownloadUrlQuery : IRequest<GetCvDownloadUrlResponse>
{
    public Guid CvId { get; set; }

    public Guid? UserId { get; set; }

    public int? ExpiryMinutes { get; set; }

    public GetCvDownloadUrlQuery(Guid cvId, Guid? userId = null, int? expiryMinutes = null)
    {
        CvId = cvId;
        UserId = userId;
        ExpiryMinutes = expiryMinutes;
    }
}

public class GetCvDownloadUrlResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Lấy đường dẫn tải xuống CV thành công.";
    public CvDownloadUrlResult? Data { get; set; }
}
