using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common;
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
    private readonly TimeProvider _timeProvider;
    private readonly ICompanyUserRepository? _companyUserRepository;

    public GetCandidateRecruitmentApplicationDetailQueryHandler(
        IApplicationRepository applicationRepository,
        ILogger<GetCandidateRecruitmentApplicationDetailQueryHandler> logger,
        TimeProvider? timeProvider = null,
        ICompanyUserRepository? companyUserRepository = null)
    {
        _applicationRepository = applicationRepository;
        _logger = logger;
        _timeProvider = timeProvider ?? TimeProvider.System;
        _companyUserRepository = companyUserRepository;
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

        var today = VietnamTime.Today(_timeProvider);

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
        var employerContact = await BuildEmployerContactAsync(app, cancellationToken);

        var data = new CandidateRecruitmentApplicationDetailDto
        {
            ApplicationId = app.ApplicationId,
            JobId = app.JobId,
            JobTitle = app.Job?.Title ?? string.Empty,
            CompanyId = app.Job?.CompanyId ?? Guid.Empty,
            CompanyName = app.Job?.Company?.CompanyName ?? string.Empty,
            JobOverview = app.Job == null ? null : new CandidateApplicationJobOverviewDto
            {
                Description = app.Job.Description,
                Benefits = app.Job.Benefits,
                Location = app.Job.Location,
                WorkingTime = app.Job.WorkingTime,
                EmploymentType = app.Job.EmploymentType,
                SalaryMin = app.Job.SalaryMin,
                SalaryMax = app.Job.SalaryMax,
                SalaryNegotiable = app.Job.SalaryNegotiable,
                CurrencyCode = app.Job.CurrencyCode,
                ApplicationDeadline = app.Job.ApplicationDeadline,
                Requirements = app.Job.JobRequirements
                    .OrderBy(requirement => requirement.CreatedAt)
                    .Select(requirement => requirement.Content)
                    .ToList(),
                Skills = app.Job.JobSkills
                    .Where(jobSkill => jobSkill.Skill != null)
                    .OrderByDescending(jobSkill => jobSkill.IsMandatory)
                    .ThenBy(jobSkill => jobSkill.Skill.SkillName)
                    .Select(jobSkill => jobSkill.Skill.SkillName)
                    .ToList()
            },
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
            AllowedActions = allowedActions,
            EmployerContact = employerContact
        };

        return new CandidateRecruitmentApplicationDetailResponse
        {
            Success = true,
            Message = "Lấy chi tiết hồ sơ tuyển dụng thành công.",
            Data = data
        };
    }

    private async Task<CandidateEmployerContactDto?> BuildEmployerContactAsync(
        Domain.Entities.Application app,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(app.Status, ApplicationStates.OfferAccepted, StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(app.Status, ApplicationStates.Placed, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var company = app.Job?.Company;
        if (company == null)
        {
            return null;
        }

        var candidateCompanyUser = _companyUserRepository != null
            ? await _companyUserRepository.GetPrimaryActiveByCompanyIdAsync(company.CompanyId, cancellationToken)
            : company.CompanyUser;

        var activeCompanyUser = IsActiveContact(candidateCompanyUser)
            ? candidateCompanyUser
            : null;

        var contactName = TrimOrNull(activeCompanyUser?.User.DisplayName);
        var roleInCompany = TrimOrNull(activeCompanyUser?.RoleInCompany);
        var email = TrimOrNull(activeCompanyUser?.User.Email);
        var phone = TrimOrNull(activeCompanyUser?.User.Phone);
        var website = NormalizeWebsiteUrl(company.Website);
        var address = TrimOrNull(company.Address);

        if (contactName == null && roleInCompany == null && email == null && phone == null && website == null && address == null)
        {
            return null;
        }

        return new CandidateEmployerContactDto
        {
            ContactName = contactName,
            RoleInCompany = roleInCompany,
            Email = email,
            Phone = phone,
            Website = website,
            Address = address
        };
    }

    private static bool IsActiveContact(Domain.Entities.CompanyUser? companyUser)
    {
        if (companyUser?.User == null)
        {
            return false;
        }

        if (!string.Equals(companyUser.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        // Legacy/in-memory fixtures may omit AppUser.Status; if populated, require ACTIVE.
        return companyUser.User.Status == null ||
            string.Equals(companyUser.User.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase);
    }

    private static string? NormalizeWebsiteUrl(string? value)
    {
        var website = TrimOrNull(value);
        if (website == null)
        {
            return null;
        }

        if (!website.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            !website.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            if (Uri.TryCreate(website, UriKind.Absolute, out var explicitUri) &&
                explicitUri.Scheme is not ("http" or "https") &&
                !Regex.IsMatch(website, @"^[^/:]+:\d+($|/)"))
            {
                return null;
            }

            website = "https://" + website;
        }

        return Uri.TryCreate(website, UriKind.Absolute, out var uri) &&
            (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
                ? website
                : null;
    }

    private static string? TrimOrNull(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

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
