using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Features.Candidates.SavedJobs.DTOs;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Candidates.SavedJobs.Queries.GetCandidateSavedJobs;

public sealed record GetCandidateSavedJobsQuery(
    Guid UserId,
    int Page = 1,
    int PageSize = 20) : IRequest<SavedJobPageDto>;

public sealed class GetCandidateSavedJobsQueryHandler : IRequestHandler<GetCandidateSavedJobsQuery, SavedJobPageDto>
{
    private readonly ICandidateRepository _candidateRepository;
    private readonly ICandidateSavedJobRepository _savedJobRepository;
    private readonly ICompanyLogoUrlResolver? _logoUrlResolver;

    public GetCandidateSavedJobsQueryHandler(
        ICandidateRepository candidateRepository,
        ICandidateSavedJobRepository savedJobRepository,
        ICompanyLogoUrlResolver? logoUrlResolver = null)
    {
        _candidateRepository = candidateRepository;
        _savedJobRepository = savedJobRepository;
        _logoUrlResolver = logoUrlResolver;
    }

    public async Task<SavedJobPageDto> Handle(GetCandidateSavedJobsQuery request, CancellationToken cancellationToken)
    {
        var candidate = await _candidateRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        if (candidate == null)
            throw new NotFoundException("Không tìm thấy thông tin hồ sơ ứng viên tương ứng với tài khoản.");

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var (items, totalCount) = await _savedJobRepository.GetSavedJobsAsync(
            candidate.CandidateId, page, pageSize, cancellationToken);

        var dtoList = items.Select(s => new SavedJobDto(
            s.CandidateSavedJobId,
            s.CreatedAt,
            JobListItemDto.From(s.Job, _logoUrlResolver))).ToList();

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        return new SavedJobPageDto(
            dtoList,
            page,
            pageSize,
            totalCount,
            totalPages);
    }
}
