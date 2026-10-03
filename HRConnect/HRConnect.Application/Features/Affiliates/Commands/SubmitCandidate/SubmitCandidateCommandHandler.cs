using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
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
    private readonly ISubmissionConsentRepository _consentRepository;
    private readonly INotificationRepository _notificationRepository;
    private readonly IEmailOutboxRepository _emailOutboxRepository;
    private readonly IEmailService _emailService;
    private readonly IEmailNormalizer _emailNormalizer;
    private readonly IPhoneNormalizer _phoneNormalizer;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _auditLogService;
    private readonly SubmissionConsentSettings _consentSettings;
    private readonly ILogger<SubmitCandidateCommandHandler> _logger;

    public SubmitCandidateCommandHandler(
        IAffiliateProfileRepository affiliateProfileRepository,
        ICandidateRepository candidateRepository,
        IJobRepository jobRepository,
        ICandidateCvRepository candidateCvRepository,
        ICvStorageService cvStorageService,
        ISubmissionRepository submissionRepository,
        IApplicationRepository applicationRepository,
        ISubmissionConsentRepository consentRepository,
        INotificationRepository notificationRepository,
        IEmailOutboxRepository emailOutboxRepository,
        IEmailService emailService,
        IEmailNormalizer emailNormalizer,
        IPhoneNormalizer phoneNormalizer,
        IUnitOfWork unitOfWork,
        IAuditLogService auditLogService,
        IOptions<SubmissionConsentSettings> consentSettings,
        ILogger<SubmitCandidateCommandHandler> logger)
    {
        _affiliateProfileRepository = affiliateProfileRepository;
        _candidateRepository = candidateRepository;
        _jobRepository = jobRepository;
        _candidateCvRepository = candidateCvRepository;
        _cvStorageService = cvStorageService;
        _submissionRepository = submissionRepository;
        _applicationRepository = applicationRepository;
        _consentRepository = consentRepository;
        _notificationRepository = notificationRepository;
        _emailOutboxRepository = emailOutboxRepository;
        _emailService = emailService;
        _emailNormalizer = emailNormalizer;
        _phoneNormalizer = phoneNormalizer;
        _unitOfWork = unitOfWork;
        _auditLogService = auditLogService;
        _consentSettings = consentSettings.Value;
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
        if (!JobAccessPolicy.CanAffiliateSubmit(job, request.RoleCodes))
        {
            throw new ForbiddenException("This job is not visible to affiliate recruiters.", "JOB_VISIBILITY_NOT_ALLOWED");
        }

        // Check the permission of the actor used by this operation only. A multi-role
        // account must not borrow another role's service-type permission.
        var canSubmit = await _jobRepository.CanAnyRoleSubmitJobAsync(
            job.ServiceTypeId, [JobAccessPolicy.AffiliateRole], cancellationToken);
        if (!canSubmit)
        {
            _logger.LogWarning("Vai trò của Affiliate {UserId} ({Roles}) không được phép nộp hồ sơ vào ServiceTypeId {ServiceTypeId}",
                request.UserId, string.Join(",", request.RoleCodes), job.ServiceTypeId);
            throw new ForbiddenException("Your role is not allowed to submit candidates for this service type.", "SERVICE_TYPE_SUBMISSION_NOT_ALLOWED");
        }

        // 4. Nhận diện / Tạo mới ứng viên (Candidate Identification)
        var hasUploadedFile = request.FileStream != null &&
                              request.FileStream != Stream.Null &&
                              !string.IsNullOrWhiteSpace(request.FileName);
        var isLibraryReuse = request.CandidateId.HasValue && request.CandidateId.Value != Guid.Empty;
        Candidate? candidate;
        AffiliateCandidateCvAccessRecord? libraryCv = null;
        string? normalizedEmail;
        string? normalizedPhone;

        if (isLibraryReuse)
        {
            if (hasUploadedFile || !request.CvId.HasValue || request.CvId.Value == Guid.Empty)
                throw new BadRequestException("Khi sử dụng Candidate từ kho, phải chọn đúng một cvId và không tải tệp CV mới.");

            libraryCv = await _submissionRepository.GetAffiliateCandidateCvAccessAsync(
                request.UserId, request.CandidateId!.Value, request.CvId.Value, cancellationToken);
            if (libraryCv == null)
                throw new NotFoundException("Không tìm thấy Candidate/CV trong kho của Affiliate.");

            candidate = await _candidateRepository.GetByIdAsync(request.CandidateId.Value, cancellationToken);
            if (candidate == null || candidate.Status != "ACTIVE" || candidate.MergedIntoCandidateId.HasValue)
                throw new NotFoundException("Không tìm thấy Candidate/CV trong kho của Affiliate.");

            normalizedEmail = candidate.NormalizedEmail;
            normalizedPhone = candidate.NormalizedPhone;
        }
        else
        {
            normalizedEmail = !string.IsNullOrWhiteSpace(request.Email)
                ? _emailNormalizer.Normalize(request.Email)
                : null;
            normalizedPhone = !string.IsNullOrWhiteSpace(request.Phone)
                ? _phoneNormalizer.Normalize(request.Phone)
                : null;

            Candidate? candidateByEmail = null;
            if (!string.IsNullOrWhiteSpace(normalizedEmail))
                candidateByEmail = await _candidateRepository.GetByNormalizedEmailAsync(normalizedEmail, cancellationToken);

            Candidate? candidateByPhone = null;
            if (!string.IsNullOrWhiteSpace(normalizedPhone))
                candidateByPhone = await _candidateRepository.GetByNormalizedPhoneAsync(normalizedPhone, cancellationToken);

            if (candidateByEmail != null && candidateByPhone != null && candidateByEmail.CandidateId != candidateByPhone.CandidateId)
            {
                _logger.LogWarning("Xung đột danh tính ứng viên: Email {Email} (CandidateId {EmailCandId}) và Phone {Phone} (CandidateId {PhoneCandId})",
                    normalizedEmail, candidateByEmail.CandidateId, normalizedPhone, candidateByPhone.CandidateId);
                throw new ConflictException("Email và số điện thoại này thuộc về hai ứng viên khác nhau trong hệ thống.");
            }

            candidate = candidateByEmail ?? candidateByPhone;
            if (candidate != null)
            {
                if (!string.Equals(candidate.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) ||
                    candidate.MergedIntoCandidateId.HasValue)
                {
                    throw new ConflictException("Hồ sơ Candidate đã bị khóa, lưu trữ hoặc hợp nhất và không thể nhận lượt nộp mới.");
                }

                // Email is the consent identity. Never attach a phone-matched Candidate
                // to an email that is not already owned by that Candidate.
                if (candidateByEmail == null && !string.IsNullOrWhiteSpace(normalizedEmail))
                {
                    throw new ConflictException("Số điện thoại đã thuộc một Candidate khác hoặc email không khớp với hồ sơ Candidate hiện có.");
                }

                if (!string.IsNullOrWhiteSpace(normalizedPhone) &&
                    !string.IsNullOrWhiteSpace(candidate.NormalizedPhone) &&
                    !string.Equals(normalizedPhone, candidate.NormalizedPhone, StringComparison.Ordinal))
                {
                    throw new ConflictException("Email và số điện thoại không khớp với cùng một hồ sơ Candidate.");
                }
            }
        }

        var now = DateTime.UtcNow;
        var recipientEmail = !isLibraryReuse && !string.IsNullOrWhiteSpace(request.Email)
            ? request.Email.Trim()
            : candidate?.Email?.Trim();
        if (string.IsNullOrWhiteSpace(recipientEmail))
        {
            throw new BadRequestException("Candidate phải có email để nhận và xác nhận yêu cầu nộp hồ sơ.");
        }

        // Chặn trùng trước khi upload để không tạo tệp R2 rồi mới xóa bồi hoàn.
        if (candidate != null)
        {
            var existingSubmission = await _submissionRepository.GetAcceptedSubmissionAsync(
                candidate.CandidateId, job.JobId, cancellationToken);
            var existingApplication = await _applicationRepository.GetByCandidateAndJobAsync(
                candidate.CandidateId, job.JobId, cancellationToken);

            if (existingSubmission != null || existingApplication != null)
            {
                await RecordDuplicateAttemptAsync(
                    candidate,
                    job.JobId,
                    request.UserId,
                    request.Note,
                    existingSubmission,
                    existingApplication,
                    now,
                    cancellationToken);

                throw new ConflictException("Ứng viên này đã được nộp vào công việc này trước đó.");
            }

            var pendingSubmission = await _submissionRepository.GetPendingConsentSubmissionAsync(
                candidate.CandidateId, job.JobId, cancellationToken);
            if (pendingSubmission?.Consent is { } pendingConsent)
            {
                if (pendingConsent.Status == "PENDING" && pendingConsent.ExpiresAt > now)
                {
                    throw new ConflictException(
                        $"Hồ sơ này đang chờ Candidate xác nhận đến {pendingConsent.ExpiresAt:O}.");
                }

                pendingSubmission.Status = "CONSENT_EXPIRED";
                pendingSubmission.UpdatedAt = now;
                pendingConsent.Status = "EXPIRED";
                pendingConsent.UpdatedAt = now;
                if (pendingSubmission.CandidateCv.CreationMethod == "AFFILIATE_UPLOAD" &&
                    pendingSubmission.CandidateCv.Status == "PENDING_CONSENT")
                {
                    pendingSubmission.CandidateCv.Status = "ARCHIVED";
                    pendingSubmission.CandidateCv.UpdatedAt = now;
                }
                _submissionRepository.Update(pendingSubmission);
                _consentRepository.Update(pendingConsent);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }
        }

        // CV đã lưu chỉ hợp lệ khi danh tính Candidate đã tồn tại và CV do chính Affiliate này tải.
        Guid? selectedCvId = null;
        if (isLibraryReuse)
        {
            selectedCvId = libraryCv!.CvId;
        }
        else if (!hasUploadedFile && request.CvId.HasValue && request.CvId.Value != Guid.Empty)
        {
            if (candidate == null)
            {
                throw new BadRequestException("Không thể dùng cvId cho ứng viên chưa tồn tại; vui lòng tải lên tệp PDF mới.");
            }

            var cv = await _candidateCvRepository.GetByIdAsync(request.CvId.Value, cancellationToken);
            if (cv == null || cv.CandidateId != candidate.CandidateId)
            {
                throw new BadRequestException("CV được chọn không hợp lệ cho ứng viên này.");
            }
            if (!string.Equals(cv.CreationMethod, "AFFILIATE_UPLOAD", StringComparison.Ordinal) ||
                cv.UploadedByUserId != request.UserId)
            {
                throw new ForbiddenException("Affiliate không được sử dụng CV riêng của ứng viên hoặc CV do Affiliate khác tải lên.");
            }
            if (cv.Status != "ACTIVE" || string.IsNullOrWhiteSpace(cv.SourceFileUrl))
            {
                throw new BadRequestException("CV được chọn hiện không khả dụng.");
            }
            selectedCvId = cv.CvId;
        }
        else if (!hasUploadedFile)
        {
            throw new BadRequestException("Vui lòng đính kèm tệp CV định dạng PDF cho ứng viên.");
        }

        // Stage Candidate/CV and consent atomically. Application, attribution and
        // MF03 work are created only after candidate confirmation.
        Submission submission;
        SubmissionConsent consent;
        EmailOutbox emailOutbox;
        string? uploadedObjectKey = null;
        Guid cvId = Guid.Empty;
        var rawToken = CreateOpaqueToken();
        var tokenHash = HashToken(rawToken);
        var expirationHours = Math.Clamp(_consentSettings.ExpirationHours, 1, 168);
        var expiresAt = now.AddHours(expirationHours);

        try
        {
            if (candidate == null)
            {
                candidate = new Candidate
                {
                    CandidateId = Guid.NewGuid(),
                    UserId = null,
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

            if (hasUploadedFile)
            {
                var uploadResult = await _cvStorageService.UploadAffiliateCvPdfAsync(
                    candidate.CandidateId,
                    request.UserId,
                    request.FileStream!,
                    request.FileName!,
                    request.FileSizeBytes ?? request.FileStream!.Length,
                    cancellationToken: cancellationToken);
                cvId = uploadResult.CvId;
                uploadedObjectKey = uploadResult.ObjectKey;
            }
            else
            {
                cvId = selectedCvId!.Value;
            }

            await _unitOfWork.BeginTransactionAsync(cancellationToken);

            submission = new Submission
            {
                SubmissionId = Guid.NewGuid(),
                CandidateId = candidate.CandidateId,
                CvId = cvId,
                JobId = job.JobId,
                SubmittedBy = request.UserId,
                Source = "AFFILIATE",
                Status = "PENDING_CONSENT",
                Note = request.Note?.Trim(),
                SubmittedAt = now,
                UpdatedAt = now
            };
            await _submissionRepository.AddAsync(submission, cancellationToken);

            consent = new SubmissionConsent
            {
                ConsentId = Guid.NewGuid(),
                SubmissionId = submission.SubmissionId,
                RecipientEmail = recipientEmail,
                TokenHash = tokenHash,
                Status = "PENDING",
                RequestedAt = now,
                ExpiresAt = expiresAt,
                EmailSendCount = 0,
                CreatedAt = now,
                UpdatedAt = now
            };
            await _consentRepository.AddAsync(consent, cancellationToken);

            emailOutbox = new EmailOutbox
            {
                EmailOutboxId = Guid.NewGuid(),
                UserId = candidate.UserId,
                RecipientEmail = consent.RecipientEmail,
                TemplateCode = "AFFILIATE_SUBMISSION_CONSENT",
                Subject = $"Xác nhận hồ sơ ứng tuyển: {job.Title}",
                Payload = JsonSerializer.Serialize(new
                {
                    consent.ConsentId,
                    submission.SubmissionId,
                    candidate.CandidateId,
                    job.JobId,
                    expiresAt
                }),
                Status = "PENDING",
                RetryCount = 0,
                CreatedAt = now
            };
            await _emailOutboxRepository.AddAsync(emailOutbox, cancellationToken);

            if (candidate.UserId.HasValue)
            {
                await _notificationRepository.AddAsync(new Notification
                {
                    NotificationId = Guid.NewGuid(),
                    UserId = candidate.UserId.Value,
                    NotificationType = "SUBMISSION",
                    Title = "Yêu cầu xác nhận hồ sơ ứng tuyển",
                    Message = $"Một Affiliate Recruiter đã giới thiệu bạn vào vị trí {job.Title}. Vui lòng kiểm tra và xác nhận.",
                    RelatedEntityType = "SUBMISSION",
                    RelatedEntityId = submission.SubmissionId,
                    Metadata = JsonSerializer.Serialize(new { job.JobId, consent.ConsentId, expiresAt }),
                    IsRead = false,
                    CreatedAt = now
                }, cancellationToken);
            }

            await _auditLogService.AddAsync(new AuditEntry
            {
                Action = AuditActions.AffiliateSubmissionCreated,
                EntityType = "SUBMISSION",
                EntityId = submission.SubmissionId,
                ActorUserId = request.UserId,
                NewValues = new
                {
                    submission.SubmissionId,
                    candidate.CandidateId,
                    affiliate.AffiliateId,
                    job.JobId,
                    cvId,
                    source = "AFFILIATE",
                    status = "PENDING_CONSENT",
                    consentExpiresAt = expiresAt,
                    aiStatus = "NOT_QUEUED"
                }
            }, cancellationToken);

            await _unitOfWork.CommitTransactionAsync(cancellationToken);
        }
        catch (Exception ex) when (IsDuplicateConstraintViolation(ex))
        {
            _logger.LogWarning(ex, "Phát hiện nộp trùng lặp do tranh chấp đồng thời (concurrency race): CandidateId={CandidateId}, JobId={JobId}",
                candidate?.CandidateId, job.JobId);

            await _unitOfWork.RollbackTransactionAsync(cancellationToken);
            await CompensateUploadAsync(uploadedObjectKey, "tranh chấp đồng thời");

            var persistedCandidate = await ResolvePersistedCandidateAsync(
                normalizedEmail, normalizedPhone, CancellationToken.None) ?? candidate;
            if (persistedCandidate != null)
            {
                try
                {
                    var winningSub = await _submissionRepository.GetAcceptedSubmissionAsync(
                        persistedCandidate.CandidateId, job.JobId, CancellationToken.None);
                    var winningApp = await _applicationRepository.GetByCandidateAndJobAsync(
                        persistedCandidate.CandidateId, job.JobId, CancellationToken.None);
                    await RecordDuplicateAttemptAsync(
                        persistedCandidate,
                        job.JobId,
                        request.UserId,
                        "Nộp trùng lặp trong phiên đồng thời.",
                        winningSub,
                        winningApp,
                        DateTime.UtcNow,
                        CancellationToken.None);
                }
                catch (Exception recEx)
                {
                    _logger.LogWarning(recEx, "Không thể ghi nhận BLOCKED_DUPLICATE sau khi tranh chấp đồng thời.");
                }
            }

            throw new ConflictException("Ứng viên này đã được nộp vào công việc này trước đó.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi lưu trữ hồ sơ nộp Affiliate vào database");
            await _unitOfWork.RollbackTransactionAsync(cancellationToken);
            await CompensateUploadAsync(uploadedObjectKey, "transaction thất bại");

            throw;
        }

        var deliveryStatus = "SENT";
        try
        {
            var confirmationUrl = candidate.UserId.HasValue
                ? $"{_consentSettings.ConfirmationUrlBase.TrimEnd('/')}#submissionId={submission.SubmissionId}"
                : $"{_consentSettings.ConfirmationUrlBase.TrimEnd('/')}#token={Uri.EscapeDataString(rawToken)}";
            var email = HRConnect.Application.Common.Email.HrConnectEmailTemplates.SubmissionConsent(
                candidate.FullName, job.Title, job.Company?.CompanyName ?? "doanh nghiệp tuyển dụng",
                confirmationUrl, expiresAt, candidate.UserId.HasValue, isReminder: false);
            emailOutbox.Subject = email.Subject;
            var result = await _emailService.SendEmailAsync(
                consent.RecipientEmail, email.Subject, email.HtmlBody, CancellationToken.None);

            consent.EmailSendCount = 1;
            consent.UpdatedAt = DateTime.UtcNow;
            if (result.IsSuccess)
            {
                consent.EmailSentAt = DateTime.UtcNow;
                emailOutbox.Status = "SENT";
                emailOutbox.SentAt = consent.EmailSentAt;
            }
            else
            {
                deliveryStatus = "FAILED";
                consent.LastEmailError = result.ErrorMessage;
                emailOutbox.Status = "FAILED";
                emailOutbox.RetryCount = 1;
                emailOutbox.LastError = result.ErrorMessage;
            }
            await _unitOfWork.SaveChangesAsync(CancellationToken.None);
        }
        catch (Exception emailException)
        {
            deliveryStatus = "FAILED";
            consent.EmailSendCount = 1;
            consent.LastEmailError = emailException.Message;
            consent.UpdatedAt = DateTime.UtcNow;
            emailOutbox.Status = "FAILED";
            emailOutbox.RetryCount = 1;
            emailOutbox.LastError = emailException.Message;
            try { await _unitOfWork.SaveChangesAsync(CancellationToken.None); }
            catch (Exception saveException) { _logger.LogError(saveException, "Không thể lưu trạng thái gửi consent email."); }
            _logger.LogError(emailException, "Không thể gửi yêu cầu consent cho SubmissionId={SubmissionId}", submission.SubmissionId);
        }

        _logger.LogInformation("Affiliate {AffiliateId} tạo Submission {SubmissionId} chờ Candidate xác nhận cho JobId={JobId}",
            affiliate.AffiliateId, submission.SubmissionId, job.JobId);

        // 8. Kích hoạt MF-03 bất đồng bộ (không chờ AI scoring hoàn tất)
        return new SubmitCandidateResponse
        {
            Success = true,
            Message = deliveryStatus == "SENT"
                ? "Đã tiếp nhận hồ sơ và gửi yêu cầu xác nhận đến Candidate."
                : "Đã lưu hồ sơ chờ xác nhận nhưng chưa gửi được email. Affiliate có thể yêu cầu gửi lại.",
            Data = new SubmitCandidateData
            {
                SubmissionId = submission.SubmissionId,
                AffiliateId = affiliate.AffiliateId,
                CandidateId = candidate.CandidateId,
                JobId = job.JobId,
                CvId = cvId,
                Status = "PENDING_CONSENT",
                AiStatus = "NOT_QUEUED",
                ConsentExpiresAt = expiresAt,
                EmailDeliveryStatus = deliveryStatus,
                SubmittedAt = submission.SubmittedAt
            }
        };
    }

    private static string CreateOpaqueToken()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();

    private static bool IsDuplicateConstraintViolation(Exception ex)
    {
        var current = ex;
        while (current != null)
        {
            var message = current.Message;
            if (message.Contains("23505", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("uq_submission_one_accepted", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("application_candidate_id_job_id_key", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("duplicate key", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("unique constraint", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
            current = current.InnerException;
        }
        return false;
    }

    private Task AddDuplicateAuditAsync(Submission submission, Guid actorUserId, CancellationToken cancellationToken)
    {
        return _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.SubmissionDuplicateBlocked,
            EntityType = "SUBMISSION",
            EntityId = submission.SubmissionId,
            ActorUserId = actorUserId,
            NewValues = new
            {
                submission.CandidateId,
                submission.JobId,
                submission.DuplicateOfSubmissionId,
                submission.Source,
                submission.Status
            }
        }, cancellationToken);
    }

    private async Task RecordDuplicateAttemptAsync(
        Candidate candidate,
        Guid jobId,
        Guid actorUserId,
        string? note,
        Submission? existingSubmission,
        JobApplication? existingApplication,
        DateTime occurredAt,
        CancellationToken cancellationToken)
    {
        _logger.LogWarning(
            "Affiliate UserId {UserId} nộp trùng CandidateId={CandidateId}, JobId={JobId}.",
            actorUserId, candidate.CandidateId, jobId);

        if (existingSubmission != null)
        {
            var blockedSubmission = new Submission
            {
                SubmissionId = Guid.NewGuid(),
                CandidateId = candidate.CandidateId,
                CvId = existingSubmission.CvId,
                JobId = jobId,
                SubmittedBy = actorUserId,
                Source = "AFFILIATE",
                Status = "BLOCKED_DUPLICATE",
                DuplicateOfSubmissionId = existingSubmission.SubmissionId,
                Note = !string.IsNullOrWhiteSpace(note)
                    ? note.Trim()
                    : "Ứng viên đã được nộp vào công việc này trước đó.",
                SubmittedAt = occurredAt,
                UpdatedAt = occurredAt
            };

            await _submissionRepository.AddAsync(blockedSubmission, cancellationToken);
            await AddDuplicateAuditAsync(blockedSubmission, actorUserId, cancellationToken);
        }
        else
        {
            await _auditLogService.AddAsync(new AuditEntry
            {
                Action = AuditActions.SubmissionDuplicateBlocked,
                EntityType = "APPLICATION",
                EntityId = existingApplication?.ApplicationId,
                ActorUserId = actorUserId,
                NewValues = new
                {
                    candidate.CandidateId,
                    jobId,
                    existingApplicationId = existingApplication?.ApplicationId,
                    source = "AFFILIATE",
                    status = "BLOCKED_DUPLICATE"
                }
            }, cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task<Candidate?> ResolvePersistedCandidateAsync(
        string? normalizedEmail,
        string? normalizedPhone,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(normalizedEmail))
        {
            var byEmail = await _candidateRepository.GetByNormalizedEmailAsync(normalizedEmail, cancellationToken);
            if (byEmail != null) return byEmail;
        }

        return string.IsNullOrWhiteSpace(normalizedPhone)
            ? null
            : await _candidateRepository.GetByNormalizedPhoneAsync(normalizedPhone, cancellationToken);
    }

    private async Task CompensateUploadAsync(string? objectKey, string reason)
    {
        if (string.IsNullOrWhiteSpace(objectKey)) return;

        try
        {
            await _cvStorageService.CompensateUploadAsync(objectKey, CancellationToken.None);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Không thể bồi hoàn tệp CV R2 {ObjectKey} sau {Reason}", objectKey, reason);
        }
    }
}
