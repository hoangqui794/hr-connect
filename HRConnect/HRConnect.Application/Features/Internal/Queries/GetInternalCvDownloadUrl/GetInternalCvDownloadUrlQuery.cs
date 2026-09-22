using HRConnect.Application.Common.Models;
using MediatR;

namespace HRConnect.Application.Features.Internal.Queries.GetInternalCvDownloadUrl;

public class GetInternalCvDownloadUrlQuery : IRequest<GetInternalCvDownloadUrlResponse>
{
    public Guid CvId { get; set; }

    public int? ExpiryMinutes { get; set; }

    public GetInternalCvDownloadUrlQuery(Guid cvId, int? expiryMinutes = null)
    {
        CvId = cvId;
        ExpiryMinutes = expiryMinutes;
    }
}

public class GetInternalCvDownloadUrlResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Lấy đường dẫn tải xuống CV thành công.";
    public CvDownloadUrlResult? Data { get; set; }
}
