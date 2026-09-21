using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.Application.Features.Affiliates.Commands.SubmitCandidate;

public class SubmitCandidateCommandHandler : IRequestHandler<SubmitCandidateCommand, SubmitCandidateResponse>
{
    private readonly IAffiliateProfileRepository _affiliateProfileRepository;
    private readonly ICandidateRepository _candidateRepository;
    private readonly IJobRepository _jobRepository;
    private readonly ICandidateCvRepository _candidateCvRepository;
    private readonly ICvStorageService _cvStorageService;
    private readonly ISubmissionRepository _submissionRepository;
    private readonly IApplicationRepository _applicationRepository;
    private readonly IAttributionRepository _attributionRepository;
    private readonly IEmailNormalizer _emailNormalizer;
    private readonly IPhoneNormalizer _phoneNormalizer;
    private readonly IMf03ScoringTrigger _scoringTrigger;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<SubmitCandidateCommandHandler> _logger;

    public SubmitCandidateCommandHandler(
        IAffiliateProfileRepository affiliateProfileRepository,
        ICandidateRepository candidateRepository,
        IJobRepository jobRepository,
        ICandidateCvRepository candidateCvRepository,
        ICvStorageService cvStorageService,
        ISubmissionRepository submissionRepository,
        IApplicationRepository applicationRepository,
        IAttributionRepository attributionRepository,
        IEmailNormalizer emailNormalizer,
        IPhoneNormalizer phoneNormalizer,
        IMf03ScoringTrigger scoringTrigger,
        IUnitOfWork unitOfWork,
        ILogger<SubmitCandidateCommandHandler> logger)
    {
        _affiliateProfileRepository = affiliateProfileRepository;
        _candidateRepository = candidateRepository;
        _jobRepository = jobRepository;
        _candidateCvRepository = candidateCvRepository;
        _cvStorageService = cvStorageService;
        _submissionRepository = submissionRepository;
        _applicationRepository = applicationRepository;
        _attributionRepository = attributionRepository;
        _emailNormalizer = emailNormalizer;
        _phoneNormalizer = phoneNormalizer;
        _scoringTrigger = scoringTrigger;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<SubmitCandidateResponse> Handle(SubmitCandidateCommand request, CancellationToken cancellationToken)
    {
        // 1. Xác thực hồ sơ Affiliate Recruiter
        var affiliate = await _affiliateProfileRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        if (affiliate == null)
        {
            _logger.LogWarning("Không tìm thấy hồ sơ Affiliate cho UserId: {UserId}", request.UserId);
            throw new ForbiddenException("Không tìm thấy hồ sơ Affiliate Recruiter của bạn.");
        }

        if (!string.Equals(affiliate.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(affiliate.Status, "VERIFIED", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Hồ sơ Affiliate {AffiliateId} ở trạng thái {Status}, không được nộp ứng viên.",
                affiliate.AffiliateId, affiliate.Status);
            throw new ForbiddenException("Hồ sơ Affiliate Recruiter chưa được kích hoạt hoặc phê duyệt.");
        }

        // 2. Kiểm tra tồn tại và trạng thái Job
        var job = await _jobRepository.GetByIdAsync(request.JobId, cancellationToken);
        if (job == null)
        {
            _logger.LogWarning("Không tìm thấy JobId {JobId}", request.JobId);
            throw new NotFoundException("Không tìm thấy công việc.");
        }

        if (job.Status != JobStatuses.Active)
        {
            _logger.LogWarning("JobId {JobId} có trạng thái {Status}, không nhận hồ sơ.", job.JobId, job.Status);
            throw new BadRequestException("Công việc hiện không ở trạng thái nhận hồ sơ ứng viên.");
        }

        // 3. Phân quyền can_submit dựa trên Service Type và Roles
        var canSubmit = await _jobRepository.CanAnyRoleSubmitJobAsync(job.ServiceTypeId, request.RoleCodes, cancellationToken);
        if (!canSubmit)
        {
            _logger.LogWarning("Vai trò của Affiliate {UserId} ({Roles}) không được phép nộp hồ sơ vào ServiceTypeId {ServiceTypeId}",
                request.UserId, string.Join(",", request.RoleCodes), job.ServiceTypeId);
            throw new ForbiddenException("Your role is not allowed to submit candidates for this service type.", "SERVICE_TYPE_SUBMISSION_NOT_ALLOWED");
        }

        // 4. Nhận diện / Tạo mới ứng viên (Candidate Identification)
        var normalizedEmail = !string.IsNullOrWhiteSpace(request.Email)
            ? _emailNormalizer.Normalize(request.Email)
            : null;

        var normalizedPhone = !string.IsNullOrWhiteSpace(request.Phone)
            ? _phoneNormalizer.Normalize(request.Phone)
            : null;

        Candidate? candidateByEmail = null;
        if (!string.IsNullOrWhiteSpace(normalizedEmail))
        {
            candidateByEmail = await _candidateRepository.GetByNormalizedEmailAsync(normalizedEmail, cancellationToken);
        }

        Candidate? candidateByPhone = null;
        if (!string.IsNullOrWhiteSpace(normalizedPhone))
        {
            candidateByPhone = await _candidateRepository.GetByNormalizedPhoneAsync(normalizedPhone, cancellationToken);
        }

        // Kiểm tra xung đột danh tính: email và số điện thoại thuộc về 2 ứng viên khác nhau
        if (candidateByEmail != null && candidateByPhone != null && candidateByEmail.CandidateId != candidateByPhone.CandidateId)
        {
            _logger.LogWarning("Xung đột danh tính ứng viên: Email {Email} (CandidateId {EmailCandId}) và Phone {Phone} (CandidateId {PhoneCandId})",
                normalizedEmail, candidateByEmail.CandidateId, normalizedPhone, candidateByPhone.CandidateId);
            throw new ConflictException("Email và số điện thoại này thuộc về hai ứng viên khác nhau trong hệ thống.");
        }

        var candidate = candidateByEmail ?? candidateByPhone;
        var now = DateTime.UtcNow;

        if (candidate == null)
        {
            candidate = new Candidate
            {
                CandidateId = Guid.NewGuid(),
                UserId = null, // Ứng viên do Affiliate nộp chưa có tài khoản đăng nhập app_user
                FullName = request.FullName.Trim(),
                Email = request.Email?.Trim(),
                Phone = request.Phone?.Trim(),
                NormalizedEmail = normalizedEmail,
                NormalizedPhone = normalizedPhone,
                ProfileVisibility = "PRIVATE",
                Status = "ACTIVE",
                CreatedAt = now,
                UpdatedAt = now
            };
            await _candidateRepository.AddAsync(candidate, cancellationToken);
        }

        // 5. Xử lý lưu trữ CV PDF
        Guid cvId;
        if (request.FileStream != null && request.FileStream != Stream.Null && !string.IsNullOrWhiteSpace(request.FileName))
        {
            var uploadResult = await _cvStorageService.UploadCvPdfAsync(
                candidate.CandidateId,
                request.FileStream,
                request.FileName,
                request.FileSizeBytes ?? request.FileStream.Length,
                cancellationToken: cancellationToken);
            cvId = uploadResult.CvId;
        }
        else if (request.CvId.HasValue && request.CvId.Value != Guid.Empty)
        {
            var cv = await _candidateCvRepository.GetByIdAsync(request.CvId.Value, cancellationToken);
            if (cv == null || cv.CandidateId != candidate.CandidateId)
            {
                throw new BadRequestException("CV được chọn không hợp lệ cho ứng viên này.");
            }
            if (cv.Status != "ACTIVE" || string.IsNullOrWhiteSpace(cv.SourceFileUrl))
            {
                throw new BadRequestException("CV được chọn hiện không khả dụng.");
            }
            cvId = cv.CvId;
        }
        else
        {
            throw new BadRequestException("Vui lòng đính kèm tệp CV định dạng PDF cho ứng viên.");
        }

        // 6. Kiểm tra trùng lặp (Duplicate Check): Cùng Candidate + Cùng Job
        var existingSubmission = await _submissionRepository.GetAcceptedSubmissionAsync(candidate.CandidateId, job.JobId, cancellationToken);
        var existingApplication = await _applicationRepository.GetByCandidateAndJobAsync(candidate.CandidateId, job.JobId, cancellationToken);

        if (existingSubmission != null || existingApplication != null)
        {
            _logger.LogWarning("Affiliate {AffiliateId} nộp trùng ứng viên: CandidateId={CandidateId}, JobId={JobId}. Ghi nhận BLOCKED_DUPLICATE.",
                affiliate.AffiliateId, candidate.CandidateId, job.JobId);

            var blockedSubmission = new Submission
            {
                SubmissionId = Guid.NewGuid(),
                CandidateId = candidate.CandidateId,
                CvId = cvId,
                JobId = job.JobId,
                SubmittedBy = request.UserId,
                Source = "AFFILIATE",
                Status = "BLOCKED_DUPLICATE",
                DuplicateOfSubmissionId = existingSubmission?.SubmissionId,
                Note = !string.IsNullOrWhiteSpace(request.Note) ? request.Note.Trim() : "Ứng viên đã được nộp vào công việc này trước đó.",
                SubmittedAt = now,
                UpdatedAt = now
            };

            await _submissionRepository.AddAsync(blockedSubmission, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            throw new ConflictException("Ứng viên này đã được nộp vào công việc này trước đó.");
        }

        // 7. Tạo Submission ACCEPTED, Application và Attribution
        var submission = new Submission
        {
            SubmissionId = Guid.NewGuid(),
            CandidateId = candidate.CandidateId,
            CvId = cvId,
            JobId = job.JobId,
            SubmittedBy = request.UserId,
            Source = "AFFILIATE",
            Status = "ACCEPTED",
            Note = request.Note?.Trim(),
            SubmittedAt = now,
            UpdatedAt = now
        };
        await _submissionRepository.AddAsync(submission, cancellationToken);

        var application = new JobApplication
        {
            ApplicationId = Guid.NewGuid(),
            JobId = job.JobId,
            CandidateId = candidate.CandidateId,
            AcceptedSubmissionId = submission.SubmissionId,
            Status = "SUBMITTED",
            CurrentStage = "SUBMITTED",
            AppliedAt = now,
            UpdatedAt = now
        };
        await _applicationRepository.AddAsync(application, cancellationToken);

        // Tạo Attribution ghi nhận nguồn Affiliate
        var attribution = new Attribution
        {
            AttributionId = Guid.NewGuid(),
            ApplicationId = application.ApplicationId,
            AffiliateId = affiliate.AffiliateId,
            WinningSubmissionId = submission.SubmissionId,
            AttributionRule = "FIRST_SUBMISSION_TIMESTAMP_PRECEDENCE",
            Status = "ACTIVE",
            EstablishedAt = now,
            UpdatedAt = now
        };
        await _attributionRepository.AddAsync(attribution, cancellationToken);

        // Commit transaction CSDL
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Affiliate {AffiliateId} nộp ứng viên thành công: ApplicationId={AppId}, AttributionId={AttrId}, CandidateId={CandId}, JobId={JobId}",
            affiliate.AffiliateId, application.ApplicationId, attribution.AttributionId, candidate.CandidateId, job.JobId);

        // 8. Kích hoạt MF-03 bất đồng bộ (không chờ AI scoring hoàn tất)
        try
        {
            await _scoringTrigger.TriggerScoringAsync(
                new Mf03TriggerPayload(application.ApplicationId, cvId, job.JobId),
                CancellationToken.None);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi kích hoạt MF-03 cho ApplicationId {ApplicationId}", application.ApplicationId);
        }

        return new SubmitCandidateResponse
        {
            Success = true,
            Message = "Nộp ứng viên thành công.",
            Data = new SubmitCandidateData
            {
                ApplicationId = application.ApplicationId,
                SubmissionId = submission.SubmissionId,
                AttributionId = attribution.AttributionId,
                AffiliateId = affiliate.AffiliateId,
                CandidateId = candidate.CandidateId,
                JobId = job.JobId,
                CvId = cvId,
                Status = "ACCEPTED",
                AiStatus = "PENDING",
                SubmittedAt = submission.SubmittedAt
            }
        };
    }
}
