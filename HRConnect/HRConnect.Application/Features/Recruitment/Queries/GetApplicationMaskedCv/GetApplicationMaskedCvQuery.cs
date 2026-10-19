using System.Text.RegularExpressions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Recruitment.Common;
using MediatR;

namespace HRConnect.Application.Features.Recruitment.Queries.GetApplicationMaskedCv;

/// <summary>
/// N16 (chốt 19/10): Client xem CV Headhunt trước khi ứng viên đi làm, với email, số điện thoại và đường link
/// đã được che. Trả về một PDF mới dựng từ chữ của CV gốc.
/// </summary>
public sealed record GetApplicationMaskedCvQuery(Guid ApplicationId, Guid UserId, bool IsClientCompanyUser, bool IsInternalHrOrAdmin)
    : IRequest<MaskedCvFile>;

public sealed record MaskedCvFile(byte[] Content, string FileName);

/// <summary>Reads the CV text and renders the masked PDF (Infrastructure: storage, PdfPig, SkiaSharp).</summary>
public interface IMaskedCvService
{
    /// <summary>Text of each page of the CV, or null when the PDF has no text layer (scan).</summary>
    Task<IReadOnlyList<string>?> ReadPagesAsync(Guid cvId, CancellationToken cancellationToken = default);

    byte[] Render(string title, string note, IReadOnlyList<string> paragraphs);
}

public static class CvRedactor
{
    public const string Mask = "[đã ẩn]";

    private static readonly Regex Email = new(@"[\w.+-]+\s?@\s?[\w-]+(\.[\w-]+)+", RegexOptions.Compiled);
    private static readonly Regex Url = new(@"(https?://|www\.)\S+|\b(linkedin|facebook|fb|github|zalo|skype|t)\.(com|me|vn)/\S*",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);
    // 9-12 digits, optionally grouped by spaces, dots or dashes, optionally +84 / (84).
    private static readonly Regex Phone = new(@"(\+?\(?\d{2,3}\)?[\s.-]?)?\d{2,4}([\s.-]?\d{2,4}){2,3}", RegexOptions.Compiled);

    public static string Redact(string text)
    {
        var result = Email.Replace(text, Mask);
        result = Url.Replace(result, Mask);
        return Phone.Replace(result, m => m.Value.Count(char.IsDigit) is >= 9 and <= 12 ? Mask : m.Value);
    }
}

public sealed class GetApplicationMaskedCvQueryHandler : IRequestHandler<GetApplicationMaskedCvQuery, MaskedCvFile>
{
    private readonly IApplicationRepository _applications;
    private readonly ICompanyUserRepository _companyUsers;
    private readonly IMaskedCvService _maskedCv;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _unitOfWork;

    public GetApplicationMaskedCvQueryHandler(
        IApplicationRepository applications, ICompanyUserRepository companyUsers, IMaskedCvService maskedCv,
        IAuditLogService audit, IUnitOfWork unitOfWork)
    {
        _applications = applications;
        _companyUsers = companyUsers;
        _maskedCv = maskedCv;
        _audit = audit;
        _unitOfWork = unitOfWork;
    }

    public async Task<MaskedCvFile> Handle(GetApplicationMaskedCvQuery request, CancellationToken cancellationToken)
    {
        var app = await _applications.GetRecruitmentApplicationDetailAsync(request.ApplicationId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy thông tin hồ sơ ứng tuyển.");

        if (request.IsClientCompanyUser)
        {
            var member = await _companyUsers.GetByUserIdAsync(request.UserId, cancellationToken);
            if (!CompanyMembershipPolicy.IsActive(member) || member.CompanyId != app.Job?.CompanyId)
                throw new ForbiddenException("Bạn không có quyền xem CV của hồ sơ thuộc công ty khác.");
            if (!ClientVisibilityPolicy.IsVisibleToClient(
                    app.Job?.ServiceType?.Code, app.Status,
                    (app.ApplicationStatusHistories ?? []).Select(h => h.NewStatus),
                    app.SourcingDeliveries?.Any() ?? false))
                throw new NotFoundException("Không tìm thấy thông tin hồ sơ ứng tuyển.");
        }
        else if (!request.IsInternalHrOrAdmin)
        {
            throw new ForbiddenException("Bạn không có quyền xem CV của hồ sơ tuyển dụng.");
        }

        var cv = app.Submission?.CandidateCv ?? throw new NotFoundException("Hồ sơ ứng tuyển này không có CV đính kèm.");
        var pages = await _maskedCv.ReadPagesAsync(cv.CvId, cancellationToken)
            ?? throw new ConflictException(
                "CV dạng ảnh scan nên không che được thông tin liên hệ. CV gốc hiển thị sau khi ứng viên đi làm.",
                "CV_NO_TEXT_LAYER");

        var paragraphs = pages
            .SelectMany(page => page.Split('\n'))
            .Select(line => CvRedactor.Redact(line.Trim()))
            .Where(line => line.Length > 0)
            .ToList();
        var pdf = _maskedCv.Render(
            $"CV ứng viên - {app.Job?.Title}",
            "Bản xem trước do HR Connect tạo: email, số điện thoại và đường link đã được che. Thông tin liên hệ hiển thị sau khi ứng viên đi làm.",
            paragraphs);

        await _audit.AddAsync(new AuditEntry
        {
            Action = AuditActions.ApplicationCvDownloadUrlIssued,
            EntityType = "APPLICATION",
            EntityId = app.ApplicationId,
            ActorUserId = request.UserId,
            NewValues = new { cv.CvId, app.CandidateId, viewer = request.IsClientCompanyUser ? "CLIENT_COMPANY" : "INTERNAL", masked = true }
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new MaskedCvFile(pdf, $"cv-{app.ApplicationId.ToString()[..8]}-da-che.pdf");
    }
}
