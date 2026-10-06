using System;
using System.Collections.Generic;

namespace HRConnect.Application.Features.Candidates.Queries.GetCandidateCvs;

public class CandidateCvItemResponse
{
    public Guid CvId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string MimeType { get; set; } = "application/pdf";
    public long? FileSizeBytes { get; set; }
    public bool IsPrimary { get; set; }
    public string Status { get; set; } = "ACTIVE";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class GetCandidateCvsResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Lấy danh sách CV thành công.";
    public List<CandidateCvItemResponse> Data { get; set; } = new();
}
