using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Application.Features.Recruitment.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Queries.GetJobPostingFee;

public sealed record GetJobPostingFeeQuery(
    Guid JobId,
    Guid UserId = default,
    bool IsBackoffice = false) : IRequest<JobPostingFeeDto?>;

public sealed class GetJobPostingFeeQueryHandler : IRequestHandler<GetJobPostingFeeQuery, JobPostingFeeDto?>
{
    private readonly IJobRepository _jobRepository;
    private readonly ICompanyUserRepository _companyUsers;

    public GetJobPostingFeeQueryHandler(IJobRepository jobRepository, ICompanyUserRepository companyUsers)
    {
        _jobRepository = jobRepository;
        _companyUsers = companyUsers;
    }

    public async Task<JobPostingFeeDto?> Handle(GetJobPostingFeeQuery request, CancellationToken cancellationToken)
    {
        var job = await _jobRepository.GetByIdAsync(request.JobId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy tin tuyển dụng.");
        await CompanyMembershipPolicy.EnsureCompanyAccessAsync(
            _companyUsers, request.UserId, request.IsBackoffice, job.CompanyId, cancellationToken);

        var fee = await _jobRepository.GetPostingFeeByJobIdAsync(request.JobId, cancellationToken);
        if (fee == null) return null;

        return new JobPostingFeeDto(
            fee.PostingFeeId,
            fee.JobId,
            fee.PackageId,
            fee.Package?.Code,
            fee.Package?.Name,
            fee.Amount,
            fee.CurrencyCode,
            fee.Status,
            fee.PaidAt,
            fee.PaymentReference,
            fee.ActivatedAt,
            fee.ExpiresAt,
            fee.CreatedAt);
    }
}
