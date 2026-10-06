using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Text.Json;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Constants;
using MediatR;
using Microsoft.Extensions.Logging;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationDetail;

public class GetRecruitmentApplicationDetailQueryHandler : IRequestHandler<GetRecruitmentApplicationDetailQuery, RecruitmentApplicationDetailResponse>
{
    private readonly IApplicationRepository _applicationRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly ILogger<GetRecruitmentApplicationDetailQueryHandler> _logger;

    public GetRecruitmentApplicationDetailQueryHandler(
        IApplicationRepository applicationRepository,
        ICompanyUserRepository companyUserRepository,
        ILogger<GetRecruitmentApplicationDetailQueryHandler> logger)
    {
        _applicationRepository = applicationRepository;
        _companyUserRepository = companyUserRepository;
        _logger = logger;
    }

    public async Task<RecruitmentApplicationDetailResponse> Handle(GetRecruitmentApplicationDetailQuery request, CancellationToken cancellationToken)
    {
        var app = await _applicationRepository.GetRecruitmentApplicationDetailAsync(request.ApplicationId, cancellationToken);
        if (app == null)
        {
            _logger.LogWarning("Không tìm thấy hồ sơ ứng tuyển với ApplicationId: {ApplicationId}", request.ApplicationId);
            throw new NotFoundException("Không tìm thấy thông tin hồ sơ ứng tuyển.");
        }

        var serviceTypeCode = app.Job?.ServiceType?.Code;
        var contactOwner = ClientVisibilityPolicy.GetContactOwner(serviceTypeCode);
        var maskContact = request.IsClientCompanyUser
            && ClientVisibilityPolicy.ShouldMaskContactForClient(serviceTypeCode, app.Status, app.Placement != null);

        if (request.IsClientCompanyUser)
        {
            var member = await _companyUserRepository.GetByUserIdAsync(request.UserId, cancellationToken);
            if (member == null || member.CompanyId != app.Job?.CompanyId)
            {
                _logger.LogWarning("Tài khoản {UserId} không có quyền xem hồ sơ thuộc công ty {CompanyId}", request.UserId, app.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền truy cập hồ sơ ứng tuyển của công ty khác.");
            }

            if (!ClientVisibilityPolicy.IsVisibleToClient(
                    serviceTypeCode,
                    app.Status,
                    (app.ApplicationStatusHistories ?? []).Select(h => h.NewStatus)))
            {
                throw new NotFoundException("Không tìm thấy thông tin hồ sơ ứng tuyển.");
            }
        }
        else if (!request.IsInternalHrOrAdmin)
        {
            _logger.LogWarning("Người dùng {UserId} không có quyền xem chi tiết hồ sơ tuyển dụng.", request.UserId);
            throw new ForbiddenException("Bạn không có quyền xem chi tiết hồ sơ tuyển dụng.");
        }

        var latestAi = app.AiMatchResults?.OrderByDescending(r => r.AttemptNo).FirstOrDefault();
        var aiMetadata = ParseSafeAiMetadata(latestAi?.RawResponse);
        var cvEntity = app.Submission?.CandidateCv;

        var interviewsDto = (app.Interviews ?? new List<Domain.Entities.Interview>())
            .OrderBy(i => i.InterviewRound)
            .Select(i => new RecruitmentInterviewSummaryDto
            {
                InterviewId = i.InterviewId,
                InterviewRound = i.InterviewRound,
                InterviewType = i.InterviewType,
                ScheduledAt = i.ScheduledAt,
                DurationMinutes = i.DurationMinutes,
                Location = i.Location,
                MeetingLink = i.MeetingLink,
                Status = i.Status,
                Result = i.Result,
                Feedback = i.Feedback,
                RecordedBy = i.RecordedBy,
                RecordedAt = i.RecordedAt,
                ConcurrencyToken = i.ConcurrencyToken
            }).ToList();

        var offersDto = (app.Offers ?? new List<Domain.Entities.Offer>())
            .OrderByDescending(o => o.OfferVersion)
            .Select(o => new RecruitmentOfferSummaryDto
            {
                OfferId = o.OfferId,
                OfferVersion = o.OfferVersion,
                Salary = o.Salary,
                CurrencyCode = o.CurrencyCode ?? "VND",
                StartDate = o.StartDate,
                ExpiryDate = o.ExpiryDate,
                Status = o.Status,
                OfferDocumentUrl = o.OfferDocumentUrl,
                SentAt = o.SentAt,
                RespondedAt = o.RespondedAt,
                DeclineReason = o.DeclineReason,
                ConcurrencyToken = o.ConcurrencyToken
            }).ToList();

        RecruitmentPlacementSummaryDto? placementDto = null;
        if (app.Placement != null)
        {
            placementDto = new RecruitmentPlacementSummaryDto
            {
                PlacementId = app.Placement.PlacementId,
                ActualStartDate = app.Placement.ActualStartDate,
                Position = app.Placement.Position,
                Department = app.Placement.Department,
                Status = app.Placement.Status,
                ConfirmedAt = app.Placement.ConfirmedAt,
                ConfirmationNote = app.Placement.ConfirmationNote
            };
        }

        var allowedActions = ComputeAllowedActions(app, request.IsClientCompanyUser, request.ScreeningActor, serviceTypeCode);

        var data = new RecruitmentApplicationDetailData
        {
            ApplicationId = app.ApplicationId,
            JobId = app.JobId,
            JobTitle = app.Job?.Title ?? string.Empty,
            CompanyId = app.Job?.CompanyId ?? Guid.Empty,
            CompanyName = app.Job?.Company?.CompanyName ?? string.Empty,
            CandidateId = app.CandidateId,
            CandidateFullName = app.Candidate?.FullName ?? string.Empty,
            CandidateEmail = maskContact ? null : app.Candidate?.Email,
            CandidatePhone = maskContact ? null : app.Candidate?.Phone,
            DateOfBirth = app.Candidate?.DateOfBirth,
            Gender = app.Candidate?.Gender,
            CurrentAddress = maskContact ? null : app.Candidate?.CurrentAddress,
            YearsOfExperience = app.Candidate?.YearsOfExperience,
            HighestEducation = app.Candidate?.HighestEducation,
            Status = app.Status,
            CurrentStage = app.CurrentStage,
            StatusReason = app.StatusReason,
            StatusReasonCode = app.StatusReasonCode,
            AppliedAt = app.AppliedAt,
            UpdatedAt = app.UpdatedAt,
            PlannedStartDate = app.PlannedStartDate,
            ConcurrencyToken = app.ConcurrencyToken,
            Cv = cvEntity != null ? new RecruitmentCvSummaryDto
            {
                CvId = cvEntity.CvId,
                Title = cvEntity.Title,
                FileName = cvEntity.FileName,
                FileUrl = maskContact ? null : cvEntity.RenderedFileUrl ?? cvEntity.SourceFileUrl,
                FileSizeBytes = cvEntity.FileSizeBytes,
                CreatedAt = cvEntity.CreatedAt
            } : null,
            AiMatch = latestAi != null ? new RecruitmentAiMatchSummaryDto
            {
                MatchScore = latestAi.MatchScore,
                MatchTier = latestAi.MatchTier,
                CandidateHighlight = latestAi.CandidateHighlight,
                Status = latestAi.Status,
                ParseConfidence = aiMetadata?.ParseConfidence,
                RequiresManualReview = aiMetadata?.RequiresManualReview,
                SemanticScore = aiMetadata?.SemanticScore,
                Warnings = aiMetadata?.Warnings ?? new List<string>(),
                Diagnostics = aiMetadata?.Diagnostics ?? new List<RecruitmentAiDiagnosticDto>(),
                MissingRequirements = aiMetadata?.MissingRequirements ?? new List<string>(),
                MatchingReasons = aiMetadata?.MatchingReasons ?? new List<string>(),
                InputFingerprints = aiMetadata?.InputFingerprints
            } : null,
            Interviews = interviewsDto,
            Offers = offersDto,
            Placement = placementDto,
            AllowedActions = allowedActions,
            ServiceTypeCode = serviceTypeCode,
            ContactOwner = contactOwner.ToString(),
            IsContactMasked = maskContact
        };

        return new RecruitmentApplicationDetailResponse
        {
            Success = true,
            Message = "Lấy chi tiết hồ sơ tuyển dụng thành công.",
            Data = data
        };
    }

    private static SafeAiMetadata? ParseSafeAiMetadata(string? rawResponse)
    {
        if (string.IsNullOrWhiteSpace(rawResponse)) return null;

        try
        {
            return JsonSerializer.Deserialize<SafeAiMetadata>(rawResponse, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private sealed class SafeAiMetadata
    {
        public decimal? ParseConfidence { get; set; }
        public bool? RequiresManualReview { get; set; }
        public decimal? SemanticScore { get; set; }
        public List<string>? Warnings { get; set; }
        public List<RecruitmentAiDiagnosticDto>? Diagnostics { get; set; }
        public List<string>? MissingRequirements { get; set; }
        public List<string>? MatchingReasons { get; set; }
        public RecruitmentAiInputFingerprintsDto? InputFingerprints { get; set; }
    }

    private static List<string> ComputeAllowedActions(
        JobApplication app,
        bool isClientCompanyUser,
        ScreeningActor? screeningActor,
        string? serviceTypeCode)
    {
        var actions = new List<string>();
        var status = (app.Status ?? string.Empty).ToUpperInvariant();

        // Screening actions follow ScreeningPolicy: only the responsible screener sees them.
        var canScreen = screeningActor.HasValue && ScreeningPolicy.CanScreen(screeningActor.Value, serviceTypeCode);
        if (canScreen && status is ApplicationStates.Submitted or ApplicationStates.Screening)
        {
            if (status == ApplicationStates.Submitted)
            {
                actions.Add("START_SCREENING");
            }

            actions.Add("SHORTLIST");
            actions.Add("REJECT");
            if (screeningActor == ScreeningActor.ClientCompany)
            {
                actions.Add("MARK_BACKUP");
            }
        }

        if (!isClientCompanyUser)
        {
            return actions;
        }

        var scheduledInterview = app.Interviews?
            .Where(i => i.Status == InterviewStates.Scheduled)
            .OrderByDescending(i => i.ScheduledAt)
            .FirstOrDefault();
        var latestInterview = app.Interviews?.OrderByDescending(i => i.InterviewRound).ThenByDescending(i => i.CreatedAt).FirstOrDefault();
        var latestOffer = app.Offers?.OrderByDescending(o => o.OfferVersion).FirstOrDefault();

        if (status == ApplicationStates.Shortlisted)
        {
            actions.Add("SCHEDULE_INTERVIEW");
        }

        if (status == ApplicationStates.Interview)
        {
            if (scheduledInterview == null)
            {
                actions.Add("SCHEDULE_INTERVIEW");
            }
            else
            {
                actions.Add("RESCHEDULE_INTERVIEW");
                actions.Add("CANCEL_INTERVIEW");
                if (!scheduledInterview.ScheduledAt.HasValue || scheduledInterview.ScheduledAt <= DateTime.UtcNow)
                {
                    actions.Add("RECORD_INTERVIEW_RESULT");
                    actions.Add("RECORD_NO_SHOW");
                }
            }
        }

        if (status == ApplicationStates.Backup)
        {
            actions.Add("SELECT_BACKUP");
            actions.Add("SHORTLIST");
            actions.Add("REJECT_BACKUP");
        }

        if (status == ApplicationStates.OfferPending)
        {
            if (latestOffer == null || latestOffer.Status is OfferStates.Declined or OfferStates.Withdrawn)
            {
                actions.Add("CREATE_OFFER");
            }
            else if (latestOffer.Status == OfferStates.Draft)
            {
                actions.Add("UPDATE_OFFER");
                actions.Add("SEND_OFFER");
            }
            else if (latestOffer.Status == OfferStates.Sent)
            {
                actions.Add("WITHDRAW_OFFER");
            }
        }

        if (status == ApplicationStates.OfferAccepted)
        {
            actions.Add("CONFIRM_PLANNED_START_DATE");
            actions.Add("CONFIRM_PLACEMENT");
            actions.Add("MARK_NOT_STARTED");
        }

        return actions;
    }
}
