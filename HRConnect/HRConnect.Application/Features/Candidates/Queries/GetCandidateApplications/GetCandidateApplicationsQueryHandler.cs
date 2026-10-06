using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Candidates.Queries.GetCandidateApplications;

public class GetCandidateApplicationsQueryHandler : IRequestHandler<GetCandidateApplicationsQuery, CandidateApplicationsResponse>
{
    private readonly ICandidateRepository _candidateRepository;
    private readonly IApplicationRepository _applicationRepository;
    private readonly ILogger<GetCandidateApplicationsQueryHandler> _logger;

    public GetCandidateApplicationsQueryHandler(
        ICandidateRepository candidateRepository,
        IApplicationRepository applicationRepository,
        ILogger<GetCandidateApplicationsQueryHandler> logger)
    {
        _candidateRepository = candidateRepository;
        _applicationRepository = applicationRepository;
        _logger = logger;
    }

    public async Task<CandidateApplicationsResponse> Handle(GetCandidateApplicationsQuery request, CancellationToken cancellationToken)
    {
        // 1. Phân giải hồ sơ Candidate từ UserId đã xác thực
        var candidate = await _candidateRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        if (candidate == null)
        {
            _logger.LogWarning("Không tìm thấy hồ sơ ứng viên cho UserId: {UserId}", request.UserId);
            throw new NotFoundException("Không tìm thấy thông tin hồ sơ ứng viên.");
        }

        // 2. Chuẩn hóa phân trang
        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        // 3. Truy vấn danh sách Application thuộc sở hữu của Candidate
        var (items, totalCount) = await _applicationRepository.GetCandidateApplicationsAsync(
            candidate.CandidateId,
            request.Status,
            request.JobId,
            request.FromDate,
            request.ToDate,
            page,
            pageSize,
            cancellationToken);

        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        // 4. Ánh xạ sang DTO
        var dtos = items.Select(a =>
        {
            var latestAi = a.AiMatchResults?.OrderByDescending(r => r.AttemptNo).FirstOrDefault();
            return new CandidateApplicationItemDto
            {
                ApplicationId = a.ApplicationId,
                JobId = a.JobId,
                JobTitle = a.Job?.Title ?? string.Empty,
                CompanyName = a.Job?.Company?.CompanyName ?? string.Empty,
                CvId = a.Submission?.CvId,
                CvTitle = a.Submission?.CandidateCv?.Title ?? a.Submission?.CandidateCv?.FileName,
                Status = a.Status,
                AiStatus = latestAi?.Status,
                AppliedAt = a.AppliedAt
            };
        }).ToList();

        return new CandidateApplicationsResponse
        {
            Success = true,
            Message = "Lấy lịch sử ứng tuyển của ứng viên thành công.",
            Data = new CandidateApplicationsData
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
