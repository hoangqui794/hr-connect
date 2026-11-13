using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Constants;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Queries.GetMyJobs;
public sealed record GetMyJobsQuery(Guid UserId, string? Status) : IRequest<IReadOnlyList<JobDto>>;
public sealed class GetMyJobsQueryHandler : IRequestHandler<GetMyJobsQuery, IReadOnlyList<JobDto>>
{
    private readonly IJobRepository _jobs;
    private readonly ICompanyUserRepository _members;
    private readonly ISourcingDeliveryRepository? _sourcingDeliveries;
    private readonly IFinanceRepository? _finance;

    public GetMyJobsQueryHandler(
        IJobRepository jobs,
        ICompanyUserRepository members,
        ISourcingDeliveryRepository? sourcingDeliveries = null,
        IFinanceRepository? finance = null) =>
        (_jobs, _members, _sourcingDeliveries, _finance) = (jobs, members, sourcingDeliveries, finance);

    public async Task<IReadOnlyList<JobDto>> Handle(GetMyJobsQuery request, CancellationToken ct)
    {
        var member = await _members.GetByUserIdAsync(request.UserId, ct) ?? throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
        var jobs = await _jobs.GetByCompanyIdAsync(member.CompanyId, ct);
        var filtered = jobs
            .Where(x => string.IsNullOrWhiteSpace(request.Status) || x.Status.Equals(request.Status, StringComparison.OrdinalIgnoreCase))
            .ToList();

        var sourcingJobIds = filtered
            .Where(j => string.Equals(j.ServiceType?.Code, "CV_SOURCING", StringComparison.OrdinalIgnoreCase))
            .Select(j => j.JobId)
            .Distinct()
            .ToHashSet();

        var countedByJob = sourcingJobIds.Count == 0 || _sourcingDeliveries is null
            ? null
            : await _sourcingDeliveries.GetCountedCountsByJobIdsAsync(sourcingJobIds, ct);

        // The deposit BE actually issued (amount and due date) for CV_SOURCING jobs; nothing is invented
        // when the fee does not exist yet.
        var depositByJob = sourcingJobIds.Count == 0 || _finance is null
            ? new Dictionary<Guid, Domain.Entities.ServiceFee>()
            : (await _finance.GetJobServiceFeesAsync(sourcingJobIds, ct))
                .Where(fee => fee.JobId.HasValue && fee.Kind == ServiceFeeKinds.Deposit && fee.Status != ServiceFeeStates.Cancelled)
                .GroupBy(fee => fee.JobId!.Value)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(fee => fee.CreatedAt).First());

        return filtered.Select(x =>
        {
            var dto = JobDto.From(x);
            if (countedByJob is not null && sourcingJobIds.Contains(x.JobId))
            {
                dto = dto with { SourcingCounted = countedByJob.GetValueOrDefault(x.JobId, 0) };
            }

            if (depositByJob.TryGetValue(x.JobId, out var deposit))
            {
                var open = deposit.Status is ServiceFeeStates.Pending or ServiceFeeStates.Due or ServiceFeeStates.Overdue;
                dto = dto with { DepositAmount = deposit.Amount, PaymentDueAt = open ? deposit.DueDate : null };
            }

            return dto;
        }).ToList();
    }
}
