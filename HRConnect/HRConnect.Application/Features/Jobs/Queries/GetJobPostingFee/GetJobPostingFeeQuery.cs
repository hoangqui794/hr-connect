using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Queries.GetJobPostingFee;

public sealed record GetJobPostingFeeQuery(Guid JobId) : IRequest<JobPostingFeeDto?>;

public sealed class GetJobPostingFeeQueryHandler : IRequestHandler<GetJobPostingFeeQuery, JobPostingFeeDto?>
{
    private readonly IJobRepository _jobRepository;

    public GetJobPostingFeeQueryHandler(IJobRepository jobRepository)
    {
        _jobRepository = jobRepository;
    }

    public async Task<JobPostingFeeDto?> Handle(GetJobPostingFeeQuery request, CancellationToken cancellationToken)
    {
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
