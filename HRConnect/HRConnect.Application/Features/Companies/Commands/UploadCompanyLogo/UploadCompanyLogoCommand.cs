using System.Text.Json.Serialization;
using MediatR;

namespace HRConnect.Application.Features.Companies.Commands.UploadCompanyLogo;

public sealed class UploadCompanyLogoCommand : IRequest<CompanyLogoResponse>
{
    [JsonIgnore] public Guid UserId { get; set; }
    [JsonIgnore] public Stream FileStream { get; set; } = Stream.Null;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
}

public sealed class CompanyLogoResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Cập nhật logo doanh nghiệp thành công.";
    public CompanyLogoData? Data { get; set; }
}

public sealed class CompanyLogoData
{
    public Guid CompanyId { get; set; }
    public string? LogoUrl { get; set; }
    public DateTime UpdatedAt { get; set; }
}
