using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.Application.Features.Candidates.Commands.ApplyJob;

public class ApplyJobCommandHandler : IRequestHandler<ApplyJobCommand, ApplyJobResponse>
{
    private readonly ICandidateRepository _candidateRepository;
    private readonly IJobRepository _jobRepository;
    private readonly ICandidateCvRepository _candidateCvRepository;
    private readonly ICvStorageService _cvStorageService;
    private readonly ISubmissionRepository _submissionRepository;
    private readonly IApplicationRepository _applicationRepository;
    private readonly IMf03ScoringTrigger _scoringTrigger;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<ApplyJobCommandHandler> _logger;

    public ApplyJobCommandHandler(
        ICandidateRepository candidateRepository,
        IJobRepository jobRepository,
        ICandidateCvRepository candidateCvRepository,
        ICvStorageService cvStorageService,
        ISubmissionRepository submissionRepository,
        IApplicationRepository applicationRepository,
        IMf03ScoringTrigger scoringTrigger,
        IUnitOfWork unitOfWork,
        ILogger<ApplyJobCommandHandler> logger)
    {
        _candidateRepository = candidateRepository;
        _jobRepository = jobRepository;
        _candidateCvRepository = candidateCvRepository;
        _cvStorageService = cvStorageService;
        _submissionRepository = submissionRepository;
        _applicationRepository = applicationRepository;
        _scoringTrigger = scoringTrigger;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<ApplyJobResponse> Handle(ApplyJobCommand request, CancellationToken cancellationToken)
    {
        // 1. Xác thực và ánh xạ tài khoản sang Candidate record
        var candidate = await _candidateRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        if (candidate == null)
        {
            _logger.LogWarning("Không tìm thấy thông tin Candidate cho UserId: {UserId}", request.UserId);
            throw new NotFoundException("Không tìm thấy thông tin hồ sơ ứng viên tương ứng với tài khoản.");
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
            throw new BadRequestException("Công việc hiện không ở trạng thái nhận hồ sơ ứng tuyển.");
        }

        // 3. Phân quyền can_submit dựa trên Service Type và Roles
        var canSubmit = await _jobRepository.CanAnyRoleSubmitJobAsync(job.ServiceTypeId, request.RoleCodes, cancellationToken);
        if (!canSubmit)
        {
            _logger.LogWarning("Vai trò của người dùng {UserId} ({Roles}) không được phép nộp hồ sơ vào ServiceTypeId {ServiceTypeId}",
                request.UserId, string.Join(",", request.RoleCodes), job.ServiceTypeId);
            throw new ForbiddenException("Your role is not allowed to submit candidates for this service type.", "SERVICE_TYPE_SUBMISSION_NOT_ALLOWED");
        }

        // 4. Xử lý CV (Upload mới hoặc chọn CV có sẵn)
        Guid cvId;
        Guid? newlyUploadedCvId = null;
        if (request.FileStream != null && request.FileStream != Stream.Null && !string.IsNullOrWhiteSpace(request.FileName))
        {
            var uploadResult = await _cvStorageService.UploadCvPdfAsync(
                candidate.CandidateId,
                request.FileStream,
                request.FileName,
                request.FileSizeBytes ?? request.FileStream.Length,
                cancellationToken: cancellationToken);
            cvId = uploadResult.CvId;
            newlyUploadedCvId = cvId;
        }
        else if (request.CvId.HasValue && request.CvId.Value != Guid.Empty)
        {
            var cv = await _candidateCvRepository.GetByIdAsync(request.CvId.Value, cancellationToken);
            if (cv == null || cv.CandidateId != candidate.CandidateId)
            {
                throw new BadRequestException("CV được chọn không hợp lệ hoặc không thuộc sở hữu của bạn.");
            }
            if (cv.Status != "ACTIVE" || string.IsNullOrWhiteSpace(cv.SourceFileUrl))
            {
                throw new BadRequestException("CV được chọn hiện không khả dụng.");
            }
            cvId = cv.CvId;
        }
        else
        {
            var primaryCv = await _candidateCvRepository.GetPrimaryByCandidateIdAsync(candidate.CandidateId, cancellationToken);
            if (primaryCv != null && !string.IsNullOrWhiteSpace(primaryCv.SourceFileUrl))
            {
                cvId = primaryCv.CvId;
            }
            else
            {
                throw new BadRequestException("Vui lòng tải lên tệp CV định dạng PDF hoặc chọn CV có sẵn.");
            }
        }

        // 5. Kiểm tra trùng lặp (Duplicate Check): Cùng Candidate + Cùng Job
        var existingSubmission = await _submissionRepository.GetAcceptedSubmissionAsync(candidate.CandidateId, job.JobId, cancellationToken);
        var existingApplication = await _applicationRepository.GetByCandidateAndJobAsync(candidate.CandidateId, job.JobId, cancellationToken);

        if (existingSubmission != null || existingApplication != null)
        {
            _logger.LogWarning("Phát hiện nộp trùng lặp: CandidateId={CandidateId}, JobId={JobId}. Ghi nhận BLOCKED_DUPLICATE.",
                candidate.CandidateId, job.JobId);

            if (newlyUploadedCvId.HasValue)
            {
                try
                {
                    await _cvStorageService.DeleteCvAsync(newlyUploadedCvId.Value, CancellationToken.None);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi bồi hoàn xóa CV {CvId} trên R2 khi phát hiện nộp trùng", newlyUploadedCvId.Value);
                }
            }

            var blockedSubmission = new Submission
            {
                SubmissionId = Guid.NewGuid(),
                CandidateId = candidate.CandidateId,
                CvId = existingSubmission?.CvId ?? cvId,
                JobId = job.JobId,
                SubmittedBy = request.UserId,
                Source = "CANDIDATE",
                Status = "BLOCKED_DUPLICATE",
                DuplicateOfSubmissionId = existingSubmission?.SubmissionId,
                Note = "Ứng viên đã nộp hồ sơ ứng tuyển vào công việc này trước đó.",
                SubmittedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _submissionRepository.AddAsync(blockedSubmission, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            throw new ConflictException("Bạn đã nộp hồ sơ ứng tuyển vào công việc này trước đó.");
        }

        // 6. Tạo Submission ACCEPTED và Application chính thức trong Transaction
        var now = DateTime.UtcNow;
        JobApplication application;
        Submission submission;

        await _unitOfWork.BeginTransactionAsync(cancellationToken);

        try
        {
            submission = new Submission
            {
                SubmissionId = Guid.NewGuid(),
                CandidateId = candidate.CandidateId,
                CvId = cvId,
                JobId = job.JobId,
                SubmittedBy = request.UserId,
                Source = "CANDIDATE",
                Status = "ACCEPTED",
                SubmittedAt = now,
                UpdatedAt = now
            };
            await _submissionRepository.AddAsync(submission, cancellationToken);

            application = new JobApplication
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

            // Persist the AI request in the same transaction. A hosted dispatcher sends it after commit.
            await _scoringTrigger.TriggerScoringAsync(
                new Mf03TriggerPayload(application.ApplicationId, cvId, job.JobId),
                cancellationToken);

            await _unitOfWork.CommitTransactionAsync(cancellationToken);
        }
        catch (Exception ex) when (IsDuplicateConstraintViolation(ex))
        {
            _logger.LogWarning(ex, "Phát hiện nộp trùng lặp ứng viên do tranh chấp đồng thời: CandidateId={CandidateId}, JobId={JobId}",
                candidate.CandidateId, job.JobId);

            await _unitOfWork.RollbackTransactionAsync(cancellationToken);

            if (newlyUploadedCvId.HasValue)
            {
                try
                {
                    await _cvStorageService.DeleteCvAsync(newlyUploadedCvId.Value, CancellationToken.None);
                }
                catch (Exception delEx)
                {
                    _logger.LogError(delEx, "Lỗi bồi hoàn xóa CV {CvId} trên R2 sau tranh chấp đồng thời", newlyUploadedCvId.Value);
                }
            }

            try
            {
                var winningSub = await _submissionRepository.GetAcceptedSubmissionAsync(candidate.CandidateId, job.JobId, CancellationToken.None);
                var blockedSub = new Submission
                {
                    SubmissionId = Guid.NewGuid(),
                    CandidateId = candidate.CandidateId,
                    CvId = winningSub?.CvId ?? cvId,
                    JobId = job.JobId,
                    SubmittedBy = request.UserId,
                    Source = "CANDIDATE",
                    Status = "BLOCKED_DUPLICATE",
                    DuplicateOfSubmissionId = winningSub?.SubmissionId,
                    Note = "Nộp trùng lặp trong phiên đồng thời.",
                    SubmittedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                await _submissionRepository.AddAsync(blockedSub, CancellationToken.None);
                await _unitOfWork.SaveChangesAsync(CancellationToken.None);
            }
            catch (Exception recEx)
            {
                _logger.LogWarning(recEx, "Không thể ghi nhận BLOCKED_DUPLICATE sau khi tranh chấp đồng thời.");
            }

            throw new ConflictException("Bạn đã nộp hồ sơ ứng tuyển vào công việc này trước đó.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi lưu trữ hồ sơ nộp vào database");
            await _unitOfWork.RollbackTransactionAsync(cancellationToken);

            if (newlyUploadedCvId.HasValue)
            {
                try
                {
                    await _cvStorageService.DeleteCvAsync(newlyUploadedCvId.Value, CancellationToken.None);
                }
                catch (Exception delEx)
                {
                    _logger.LogError(delEx, "Lỗi bồi hoàn xóa CV {CvId} trên R2 khi DB lỗi", newlyUploadedCvId.Value);
                }
            }

            throw;
        }

        _logger.LogInformation("Ứng tuyển thành công: ApplicationId={ApplicationId}, CandidateId={CandidateId}, JobId={JobId}, CvId={CvId}",
            application.ApplicationId, candidate.CandidateId, job.JobId, cvId);

        return new ApplyJobResponse
        {
            Success = true,
            Message = "Nộp hồ sơ ứng tuyển thành công.",
            Data = new ApplyJobData
            {
                ApplicationId = application.ApplicationId,
                SubmissionId = submission.SubmissionId,
                CandidateId = candidate.CandidateId,
                JobId = job.JobId,
                CvId = cvId,
                Status = "ACCEPTED",
                AiStatus = "PENDING",
                AppliedAt = application.AppliedAt
            }
        };
    }

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
}
