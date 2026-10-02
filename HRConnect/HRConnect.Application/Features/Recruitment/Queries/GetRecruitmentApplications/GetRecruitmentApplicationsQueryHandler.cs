using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplications;

public class GetRecruitmentApplicationsQueryHandler : IRequestHandler<GetRecruitmentApplicationsQuery, RecruitmentApplicationsResponse>
{
    private readonly IApplicationRepository _applicationRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly ILogger<GetRecruitmentApplicationsQueryHandler> _logger;

    public GetRecruitmentApplicationsQueryHandler(
        IApplicationRepository applicationRepository,
        ICompanyUserRepository companyUserRepository,
        ILogger<GetRecruitmentApplicationsQueryHandler> logger)
    {
        _applicationRepository = applicationRepository;
        _companyUserRepository = companyUserRepository;
        _logger = logger;
    }

    public async Task<RecruitmentApplicationsResponse> Handle(GetRecruitmentApplicationsQuery request, CancellationToken cancellationToken)
    {
        Guid? companyId = null;

        if (request.IsClientCompanyUser)
        {
            var member = await _companyUserRepository.GetByUserIdAsync(request.UserId, cancellationToken);
            if (member == null)
            {
                _logger.LogWarning("Tài khoản Client Company {UserId} không gắn với doanh nghiệp nào.", request.UserId);
                throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
            }
            companyId = member.CompanyId;
        }
        else if (!request.IsInternalHrOrAdmin)
        {
            _logger.LogWarning("Người dùng {UserId} không có quyền xem danh sách tuyển dụng.", request.UserId);
            throw new ForbiddenException("Bạn không có quyền truy cập danh sách tuyển dụng.");
        }

        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var (items, totalCount) = await _applicationRepository.GetRecruitmentApplicationsAsync(
            companyId,
            request.JobId,
            request.Status,
            request.CandidateName,
            request.FromDate,
            request.ToDate,
            page,
            pageSize,
            cancellationToken);

        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        var dtos = items.Select(a =>
        {
            var latestAi = a.AiMatchResults?.OrderByDescending(r => r.AttemptNo).FirstOrDefault();
            var latestInterview = a.Interviews?.OrderByDescending(i => i.InterviewRound).ThenByDescending(i => i.CreatedAt).FirstOrDefault();
            var latestOffer = a.Offers?.OrderByDescending(o => o.OfferVersion).FirstOrDefault();

            return new RecruitmentApplicationItemDto
            {
                ApplicationId = a.ApplicationId,
                JobId = a.JobId,
                JobTitle = a.Job?.Title ?? string.Empty,
                CompanyId = a.Job?.CompanyId ?? Guid.Empty,
                CompanyName = a.Job?.Company?.CompanyName ?? string.Empty,
                CandidateId = a.CandidateId,
                CandidateName = a.Candidate?.FullName ?? string.Empty,
                CandidateEmail = a.Candidate?.Email,
                CandidatePhone = a.Candidate?.Phone,
                CvId = a.Submission?.CvId,
                CvTitle = a.Submission?.CandidateCv?.Title ?? a.Submission?.CandidateCv?.FileName,
                Status = a.Status,
                CurrentStage = a.CurrentStage,
                AppliedAt = a.AppliedAt,
                AiMatchScore = latestAi?.MatchScore,
                AiMatchTier = latestAi?.MatchTier,
                AiStatus = latestAi?.Status,
                LatestInterviewRound = latestInterview?.InterviewRound,
                LatestInterviewStatus = latestInterview?.Status,
                LatestInterviewResult = latestInterview?.Result,
                LatestInterviewScheduledAt = latestInterview?.ScheduledAt,
                TotalInterviews = a.Interviews?.Count ?? 0,
                LatestOfferStatus = latestOffer?.Status,
                LatestOfferSalary = latestOffer?.Salary,
                PlannedStartDate = a.PlannedStartDate,
                ConcurrencyToken = a.ConcurrencyToken
            };
        }).ToList();

        return new RecruitmentApplicationsResponse
        {
            Success = true,
            Message = "Lấy danh sách hồ sơ tuyển dụng thành công.",
            Data = new RecruitmentApplicationsData
            {
                Items = dtos,
                Page = page,
                PageSize = pageSize,
                Total = totalCount,
                TotalPages = totalPages
            }
        };
    }
}
