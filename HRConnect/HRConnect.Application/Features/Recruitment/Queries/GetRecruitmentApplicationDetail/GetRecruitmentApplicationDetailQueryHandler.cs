using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
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

        if (request.IsClientCompanyUser)
        {
            var member = await _companyUserRepository.GetByUserIdAsync(request.UserId, cancellationToken);
            if (member == null || member.CompanyId != app.Job?.CompanyId)
            {
                _logger.LogWarning("Tài khoản {UserId} không có quyền xem hồ sơ thuộc công ty {CompanyId}", request.UserId, app.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền truy cập hồ sơ ứng tuyển của công ty khác.");
            }
        }
        else if (!request.IsInternalHrOrAdmin)
        {
            _logger.LogWarning("Người dùng {UserId} không có quyền xem chi tiết hồ sơ tuyển dụng.", request.UserId);
            throw new ForbiddenException("Bạn không có quyền xem chi tiết hồ sơ tuyển dụng.");
        }

        var latestAi = app.AiMatchResults?.OrderByDescending(r => r.AttemptNo).FirstOrDefault();
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

        var allowedActions = ComputeAllowedActions(app);

        var data = new RecruitmentApplicationDetailData
        {
            ApplicationId = app.ApplicationId,
            JobId = app.JobId,
            JobTitle = app.Job?.Title ?? string.Empty,
            CompanyId = app.Job?.CompanyId ?? Guid.Empty,
            CompanyName = app.Job?.Company?.CompanyName ?? string.Empty,
            CandidateId = app.CandidateId,
            CandidateFullName = app.Candidate?.FullName ?? string.Empty,
            CandidateEmail = app.Candidate?.Email,
            CandidatePhone = app.Candidate?.Phone,
            DateOfBirth = app.Candidate?.DateOfBirth,
            Gender = app.Candidate?.Gender,
            CurrentAddress = app.Candidate?.CurrentAddress,
            YearsOfExperience = app.Candidate?.YearsOfExperience,
            HighestEducation = app.Candidate?.HighestEducation,
            Status = app.Status,
            CurrentStage = app.CurrentStage,
            StatusReason = app.StatusReason,
            AppliedAt = app.AppliedAt,
            UpdatedAt = app.UpdatedAt,
            PlannedStartDate = app.PlannedStartDate,
            ConcurrencyToken = app.ConcurrencyToken,
            Cv = cvEntity != null ? new RecruitmentCvSummaryDto
            {
                CvId = cvEntity.CvId,
                Title = cvEntity.Title,
                FileName = cvEntity.FileName,
                FileUrl = cvEntity.RenderedFileUrl ?? cvEntity.SourceFileUrl,
                FileSizeBytes = cvEntity.FileSizeBytes,
                CreatedAt = cvEntity.CreatedAt
            } : null,
            AiMatch = latestAi != null ? new RecruitmentAiMatchSummaryDto
            {
                MatchScore = latestAi.MatchScore,
                MatchTier = latestAi.MatchTier,
                CandidateHighlight = latestAi.CandidateHighlight,
                Status = latestAi.Status
            } : null,
            Interviews = interviewsDto,
            Offers = offersDto,
            Placement = placementDto,
            AllowedActions = allowedActions
        };

        return new RecruitmentApplicationDetailResponse
        {
            Success = true,
            Message = "Lấy chi tiết hồ sơ tuyển dụng thành công.",
            Data = data
        };
    }

    private static List<string> ComputeAllowedActions(JobApplication app)
    {
        var actions = new List<string>();
        var status = (app.Status ?? string.Empty).ToUpperInvariant();

        var hasScheduledInterview = app.Interviews?.Any(i => i.Status == "SCHEDULED") == true;
        var hasInProgressInterview = app.Interviews?.Any(i => i.Status == "IN_PROGRESS") == true;
        var latestInterview = app.Interviews?.OrderByDescending(i => i.InterviewRound).ThenByDescending(i => i.CreatedAt).FirstOrDefault();
        var latestOffer = app.Offers?.OrderByDescending(o => o.OfferVersion).FirstOrDefault();

        if (status is "APPLIED" or "SCREENING_PASSED" or "INTERVIEWING")
        {
            if (!hasScheduledInterview && !hasInProgressInterview)
            {
                actions.Add("SCHEDULE_INTERVIEW");
            }
            else
            {
                actions.Add("RESCHEDULE_INTERVIEW");
                actions.Add("CANCEL_INTERVIEW");
                actions.Add("RECORD_INTERVIEW_RESULT");
            }

            if (latestInterview?.Result == "PASS")
            {
                actions.Add("CREATE_OFFER");
            }
            else if (latestInterview?.Result == "BACKUP")
            {
                actions.Add("SELECT_BACKUP");
            }
        }

        if (status == "OFFERED" || (status == "INTERVIEWING" && latestInterview?.Result == "PASS"))
        {
            if (latestOffer != null)
            {
                if (latestOffer.Status == "DRAFT")
                {
                    actions.Add("SEND_OFFER");
                    actions.Add("UPDATE_OFFER");
                }
                else if (latestOffer.Status == "SENT")
                {
                    actions.Add("WITHDRAW_OFFER");
                }
                else if (latestOffer.Status is "DECLINED" or "WITHDRAWN")
                {
                    actions.Add("CREATE_OFFER");
                }
            }
            else
            {
                actions.Add("CREATE_OFFER");
            }
        }

        if (status is "OFFER_ACCEPTED" or "HIRED" or "PLACED")
        {
            if (app.Placement == null || app.Placement.Status != "CONFIRMED")
            {
                actions.Add("CONFIRM_PLACEMENT");
            }
            actions.Add("MARK_NOT_STARTED");
        }

        if (status is not ("REJECTED" or "HIRED" or "PLACED" or "WITHDRAWN" or "NOT_STARTED"))
        {
            actions.Add("REJECT_APPLICATION");
        }

        return actions;
    }
}
