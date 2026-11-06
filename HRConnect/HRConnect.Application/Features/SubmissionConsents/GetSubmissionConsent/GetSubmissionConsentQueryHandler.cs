using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.SubmissionConsents.Common;
using HRConnect.Application.Common.Models;
using MediatR;

namespace HRConnect.Application.Features.SubmissionConsents.GetSubmissionConsent;

public sealed class GetSubmissionConsentQueryHandler : IRequestHandler<GetSubmissionConsentQuery, SubmissionConsentReviewResponse>
{
    private readonly ISubmissionConsentRepository _repository;
    private readonly ICvStorageService _cvStorage;
    private readonly ISubmissionConsentExpiryService _expiryService;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _unitOfWork;

    public GetSubmissionConsentQueryHandler(
        ISubmissionConsentRepository repository,
        ICvStorageService cvStorage,
        ISubmissionConsentExpiryService expiryService,
        IAuditLogService audit,
        IUnitOfWork unitOfWork)
    {
        _repository = repository;
        _cvStorage = cvStorage;
        _expiryService = expiryService;
        _audit = audit;
        _unitOfWork = unitOfWork;
    }

    public async Task<SubmissionConsentReviewResponse> Handle(GetSubmissionConsentQuery request, CancellationToken cancellationToken)
    {
        var consent = await ResolveConsentAsync(request, cancellationToken);
        await _expiryService.ExpireAsync(
            consent,
            DateTime.UtcNow,
            request.RequesterUserId,
            "CONSENT_REVIEW",
            cancellationToken);

        string? url = null;
        DateTime? urlExpiresAt = null;
        if (consent.Status == "PENDING")
        {
            var download = await _cvStorage.GetCvDownloadUrlAsync(
                consent.Submission.CvId, TimeSpan.FromMinutes(5), cancellationToken);
            url = download.DownloadUrl;
            urlExpiresAt = download.ExpiresAt;

            await _audit.AddAsync(new AuditEntry
            {
                Action = AuditActions.SubmissionConsentCvDownloadUrlIssued,
                EntityType = "CANDIDATE_CV",
                EntityId = consent.Submission.CvId,
                ActorUserId = request.RequesterUserId,
                CorrelationId = consent.ConsentId,
                NewValues = new
                {
                    consent.SubmissionId,
                    consent.Submission.CandidateId,
                    accessMethod = request.RequesterUserId.HasValue ? "CANDIDATE_ACCOUNT" : "EMAIL_LINK",
                    download.ExpiresAt
                }
            }, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        var job = consent.Submission.Job;
        var company = job.Company;
        var affiliate = consent.Submission.SubmittedByNavigation;
        var currency = string.IsNullOrWhiteSpace(job.CurrencyCode) ? "VND" : job.CurrencyCode;
        var salaryNegotiable = job.SalaryNegotiable || (job.SalaryMin == null && job.SalaryMax == null);
        var expReq = FormatExperienceRequirement(job.MinExperienceYears, job.MaxExperienceYears);
        var workMode = ResolveWorkMode(job.EmploymentType, job.WorkingTime);

        return new SubmissionConsentReviewResponse
        {
            Data = new SubmissionConsentReviewData
            {
                SubmissionId = consent.SubmissionId,
                JobId = job.JobId,
                CompanyId = company?.CompanyId ?? job.CompanyId,
                CompanyLogoUrl = company?.LogoUrl,
                Status = consent.Status,
                ExpiresAt = consent.ExpiresAt,
                CandidateName = consent.Submission.Candidate.FullName,
                JobTitle = job.Title,
                CompanyName = company?.CompanyName ?? string.Empty,
                JobLocation = job.Location,
                WorkLocation = job.Location,
                WorkMode = workMode,
                EmploymentType = job.EmploymentType,
                SalaryMin = job.SalaryMin,
                SalaryMax = job.SalaryMax,
                CurrencyCode = currency,
                SalaryCurrency = currency,
                SalaryNegotiable = salaryNegotiable,
                IsSalaryNegotiable = salaryNegotiable,
                MinExperienceYears = job.MinExperienceYears,
                MaxExperienceYears = job.MaxExperienceYears,
                ExperienceRequirement = expReq,
                AffiliateDisplayName = affiliate?.DisplayName ?? affiliate?.Email,
                AffiliateEmail = affiliate?.Email,
                AffiliatePhone = affiliate?.Phone,
                PitchText = consent.Submission.Note,
                CandidateConditionSummary = consent.Submission.Note,
                CvFileName = consent.Submission.CandidateCv.FileName ?? "candidate-cv.pdf",
                CvFileSizeBytes = consent.Submission.CandidateCv.FileSizeBytes,
                CvDownloadUrl = url,
                CvUrlExpiresAt = urlExpiresAt,
                AffiliateReuseStatus = consent.Submission.CandidateCv.AffiliateReuseStatus,
                ReuseConcurrencyToken = consent.Submission.CandidateCv.AffiliateReuseConcurrencyToken
            }
        };
    }

    internal static string? FormatExperienceRequirement(decimal? min, decimal? max)
    {
        if (min.HasValue && max.HasValue)
        {
            if (min.Value == max.Value)
                return min.Value <= 0 ? "Không yêu cầu kinh nghiệm" : $"Yêu cầu {min.Value:0.#} năm kinh nghiệm";
            return $"Yêu cầu {min.Value:0.#} – {max.Value:0.#} năm kinh nghiệm";
        }
        if (min.HasValue)
            return min.Value <= 0 ? "Không yêu cầu kinh nghiệm" : $"Yêu cầu {min.Value:0.#}+ năm kinh nghiệm";
        if (max.HasValue)
            return $"Tối đa {max.Value:0.#} năm kinh nghiệm";
        return null;
    }

    internal static string ResolveWorkMode(string? employmentType, string? workingTime)
    {
        if (!string.IsNullOrWhiteSpace(employmentType))
        {
            var upper = employmentType.Trim().ToUpperInvariant();
            if (upper.Contains("REMOTE")) return "REMOTE";
            if (upper.Contains("HYBRID")) return "HYBRID";
        }
        if (!string.IsNullOrWhiteSpace(workingTime))
        {
            var upper = workingTime.Trim().ToUpperInvariant();
            if (upper.Contains("REMOTE") || upper.Contains("TỪ XA")) return "REMOTE";
            if (upper.Contains("HYBRID") || upper.Contains("LINH HOẠT")) return "HYBRID";
        }
        return "ONSITE";
    }

    private async Task<HRConnect.Domain.Entities.SubmissionConsent> ResolveConsentAsync(
        GetSubmissionConsentQuery request,
        CancellationToken cancellationToken)
    {
        if (request.SubmissionId.HasValue)
        {
            if (!request.RequesterUserId.HasValue)
                throw new ForbiddenException("Vui lòng đăng nhập tài khoản Candidate để xem yêu cầu xác nhận.");

            var consent = await _repository.GetBySubmissionIdAsync(request.SubmissionId.Value, cancellationToken)
                ?? throw new NotFoundException("Không tìm thấy yêu cầu xác nhận hồ sơ.");
            if (consent.Submission.Candidate.UserId != request.RequesterUserId)
                throw new ForbiddenException("Bạn không có quyền xem yêu cầu xác nhận của Candidate khác.");
            return consent;
        }

        if (string.IsNullOrWhiteSpace(request.Token))
            throw new BadRequestException("Liên kết xác nhận không hợp lệ.");

        var tokenConsent = await _repository.GetByTokenHashAsync(
            SubmissionConsentToken.Hash(request.Token), cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy yêu cầu xác nhận hoặc liên kết không hợp lệ.");
        EnsureIdentity(tokenConsent.Submission.Candidate.UserId, request.RequesterUserId);
        return tokenConsent;
    }

    private static void EnsureIdentity(Guid? candidateUserId, Guid? requesterUserId)
    {
        if (candidateUserId.HasValue && requesterUserId != candidateUserId)
            throw new ForbiddenException("Vui lòng đăng nhập đúng tài khoản Candidate để xem và xác nhận hồ sơ.");
    }
}
