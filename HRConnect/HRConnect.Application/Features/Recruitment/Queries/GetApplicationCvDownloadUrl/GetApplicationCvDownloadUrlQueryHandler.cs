using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Recruitment.Common;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Recruitment.Queries.GetApplicationCvDownloadUrl;

public class GetApplicationCvDownloadUrlQueryHandler
    : IRequestHandler<GetApplicationCvDownloadUrlQuery, GetApplicationCvDownloadUrlResponse>
{
    /// <summary>Links are only for viewing now; keep them short-lived.</summary>
    public static readonly TimeSpan LinkLifetime = TimeSpan.FromMinutes(10);

    private readonly IApplicationRepository _applicationRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly ICvStorageService _cvStorageService;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<GetApplicationCvDownloadUrlQueryHandler> _logger;

    public GetApplicationCvDownloadUrlQueryHandler(
        IApplicationRepository applicationRepository,
        ICompanyUserRepository companyUserRepository,
        ICvStorageService cvStorageService,
        IAuditLogService audit,
        IUnitOfWork unitOfWork,
        ILogger<GetApplicationCvDownloadUrlQueryHandler> logger)
    {
        _applicationRepository = applicationRepository;
        _companyUserRepository = companyUserRepository;
        _cvStorageService = cvStorageService;
        _audit = audit;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<GetApplicationCvDownloadUrlResponse> Handle(
        GetApplicationCvDownloadUrlQuery request,
        CancellationToken cancellationToken)
    {
        var app = await _applicationRepository.GetRecruitmentApplicationDetailAsync(request.ApplicationId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy thông tin hồ sơ ứng tuyển.");

        var serviceTypeCode = app.Job?.ServiceType?.Code;

        // Same access rules as the application detail (GetRecruitmentApplicationDetailQueryHandler).
        if (request.IsClientCompanyUser)
        {
            var member = await _companyUserRepository.GetByUserIdAsync(request.UserId, cancellationToken);
            if (member == null || member.CompanyId != app.Job?.CompanyId)
            {
                _logger.LogWarning("Tài khoản {UserId} xin xem CV của hồ sơ thuộc công ty khác {CompanyId}", request.UserId, app.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền xem CV của hồ sơ thuộc công ty khác.");
            }

            if (!ClientVisibilityPolicy.IsVisibleToClient(
                    serviceTypeCode,
                    app.Status,
                    (app.ApplicationStatusHistories ?? []).Select(h => h.NewStatus)))
            {
                throw new NotFoundException("Không tìm thấy thông tin hồ sơ ứng tuyển.");
            }

            // HEADHUNT_COD hides contact data, including the CV file, until the candidate starts work.
            if (ClientVisibilityPolicy.ShouldMaskContactForClient(serviceTypeCode, app.Status, app.Placement != null))
            {
                throw new ForbiddenException("CV của ứng viên dịch vụ Headhunt được hiển thị sau khi ứng viên đi làm.");
            }
        }
        else if (!request.IsInternalHrOrAdmin)
        {
            throw new ForbiddenException("Bạn không có quyền xem CV của hồ sơ tuyển dụng.");
        }

        var cv = app.Submission?.CandidateCv
            ?? throw new NotFoundException("Hồ sơ ứng tuyển này không có CV đính kèm.");

        var link = await _cvStorageService.GetCvDownloadUrlAsync(cv.CvId, LinkLifetime, cancellationToken);

        await _audit.AddAsync(new AuditEntry
        {
            Action = AuditActions.ApplicationCvDownloadUrlIssued,
            EntityType = "APPLICATION",
            EntityId = app.ApplicationId,
            ActorUserId = request.UserId,
            NewValues = new
            {
                cv.CvId,
                app.CandidateId,
                viewer = request.IsClientCompanyUser ? "CLIENT_COMPANY" : "INTERNAL",
                link.ExpiresAt
            }
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new GetApplicationCvDownloadUrlResponse
        {
            Data = new ApplicationCvDownloadUrlData
            {
                ApplicationId = app.ApplicationId,
                CvId = cv.CvId,
                FileName = string.IsNullOrWhiteSpace(cv.FileName) ? link.FileName : cv.FileName!,
                MimeType = link.MimeType,
                DownloadUrl = link.DownloadUrl,
                ExpiresAt = link.ExpiresAt
            }
        };
    }
}
