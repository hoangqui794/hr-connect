using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Offers.Common;
using HRConnect.Domain.Constants;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationDetail;

public class GetCandidateRecruitmentApplicationDetailQueryHandler
    : IRequestHandler<GetCandidateRecruitmentApplicationDetailQuery, CandidateRecruitmentApplicationDetailResponse>
{
    private readonly IApplicationRepository _applicationRepository;
    private readonly ILogger<GetCandidateRecruitmentApplicationDetailQueryHandler> _logger;

    public GetCandidateRecruitmentApplicationDetailQueryHandler(
        IApplicationRepository applicationRepository,
        ILogger<GetCandidateRecruitmentApplicationDetailQueryHandler> logger)
    {
        _applicationRepository = applicationRepository;
        _logger = logger;
    }

    public async Task<CandidateRecruitmentApplicationDetailResponse> Handle(
        GetCandidateRecruitmentApplicationDetailQuery request,
        CancellationToken cancellationToken)
    {
        var app = await _applicationRepository.GetRecruitmentApplicationDetailAsync(request.ApplicationId, cancellationToken);
        if (app == null)
        {
            _logger.LogWarning("Không tìm thấy hồ sơ ứng tuyển với ApplicationId: {ApplicationId}", request.ApplicationId);
            throw new NotFoundException("Không tìm thấy thông tin hồ sơ ứng tuyển.");
        }

        if (app.Candidate?.UserId != request.UserId)
        {
            _logger.LogWarning("Người dùng {UserId} cố truy cập hồ sơ {ApplicationId} thuộc sở hữu của ứng viên khác.",
                request.UserId, request.ApplicationId);
            throw new ForbiddenException("Bạn không có quyền xem chi tiết hồ sơ tuyển dụng này.");
        }

        var cvEntity = app.Submission?.CandidateCv;
        CandidateSubmittedCvDto? submittedCv = null;
        if (cvEntity != null)
        {
            submittedCv = new CandidateSubmittedCvDto
            {
                CvId = cvEntity.CvId,
                Title = cvEntity.Title,
                FileName = cvEntity.FileName
            };
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var interviews = (app.Interviews ?? new List<Domain.Entities.Interview>())
            .OrderBy(i => i.InterviewRound)
            .Select(i => new CandidateInterviewSummaryDto
            {
                InterviewId = i.InterviewId,
                InterviewRound = i.InterviewRound,
                InterviewType = i.InterviewType,
                ScheduledAt = i.ScheduledAt,
                DurationMinutes = i.DurationMinutes,
                Location = i.Location,
                MeetingLink = i.MeetingLink,
                Status = i.Status,
                ConcurrencyToken = i.ConcurrencyToken
            }).ToList();

        var offers = (app.Offers ?? new List<Domain.Entities.Offer>())
            .Where(o => o.Status != OfferStates.Draft)
            .OrderByDescending(o => o.OfferVersion)
            .Select(o =>
            {
                var canRespond = o.Status == OfferStates.Sent && (!o.ExpiryDate.HasValue || o.ExpiryDate.Value >= today);
                return new CandidateOfferSummaryDto
                {
                    OfferId = o.OfferId,
                    OfferVersion = o.OfferVersion,
                    Salary = o.Salary,
                    CurrencyCode = o.CurrencyCode ?? "VND",
                    SalaryBasis = o.SalaryBasis,
                    SalaryPeriod = o.SalaryPeriod,
                    MonthlyGrossSalary = OfferSalaryPolicy.CalculateMonthlyGrossSalary(o.Salary, o.SalaryBasis, o.SalaryPeriod),
                    StartDate = o.StartDate,
                    ExpiryDate = o.ExpiryDate,
                    Status = o.Status,
                    OfferDocumentUrl = o.OfferDocumentUrl,
                    SentAt = o.SentAt,
                    RespondedAt = o.RespondedAt,
                    DeclineReason = o.DeclineReason,
                    ConcurrencyToken = o.ConcurrencyToken,
                    CanRespond = canRespond
                };
            }).ToList();

        CandidatePlacementSummaryDto? placement = null;
        if (app.Placement != null)
        {
            placement = new CandidatePlacementSummaryDto
            {
                PlacementId = app.Placement.PlacementId,
                ActualStartDate = app.Placement.ActualStartDate,
                Position = app.Placement.Position,
                Department = app.Placement.Department,
                Status = app.Placement.Status
            };
        }

        var allowedActions = ComputeCandidateAllowedActions(app.Status, interviews, offers);

        var data = new CandidateRecruitmentApplicationDetailDto
        {
            ApplicationId = app.ApplicationId,
            JobId = app.JobId,
            JobTitle = app.Job?.Title ?? string.Empty,
            CompanyId = app.Job?.CompanyId ?? Guid.Empty,
            CompanyName = app.Job?.Company?.CompanyName ?? string.Empty,
            CandidateId = app.CandidateId,
            Status = app.Status,
            CurrentStage = app.CurrentStage,
            StatusReason = app.StatusReason,
            AppliedAt = app.AppliedAt,
            UpdatedAt = app.UpdatedAt,
            PlannedStartDate = app.PlannedStartDate,
            ConcurrencyToken = app.ConcurrencyToken,
            SubmittedCv = submittedCv,
            Interviews = interviews,
            Offers = offers,
            Placement = placement,
            AllowedActions = allowedActions
        };

        return new CandidateRecruitmentApplicationDetailResponse
        {
            Success = true,
            Message = "Lấy chi tiết hồ sơ tuyển dụng thành công.",
            Data = data
        };
    }

    private static List<string> ComputeCandidateAllowedActions(
        string status,
        List<CandidateInterviewSummaryDto> interviews,
        List<CandidateOfferSummaryDto> offers)
    {
        var actions = new List<string>();

        // 1. Can withdraw if not terminal status
        if (status is not ApplicationStates.Rejected
            and not ApplicationStates.InterviewFailed
            and not ApplicationStates.BackupNotSelected
            and not ApplicationStates.OfferDeclined
            and not ApplicationStates.NotStarted
            and not ApplicationStates.Withdrawn
            and not ApplicationStates.Placed
            and not ApplicationStates.Closed)
        {
            actions.Add("WITHDRAW_APPLICATION");
        }

        // 2. Can view interviews if any exist
        if (interviews.Count > 0)
        {
            actions.Add("VIEW_INTERVIEW");
        }

        // 3. Can respond offer if any offer has CanRespond == true
        if (offers.Any(o => o.CanRespond))
        {
            actions.Add("RESPOND_OFFER");
        }

        return actions;
    }
}
