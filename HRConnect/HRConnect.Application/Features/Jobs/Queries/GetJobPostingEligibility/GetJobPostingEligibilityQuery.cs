using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Queries.GetJobPostingEligibility;

public sealed record JobPostingEligibilityDto(
    bool CanUseFreePackage,
    string? Reason,
    int ActiveJobsCount,
    int FreeActiveLimit,
    DateTime? LastPostedAt,
    DateTime? NextFreeAvailableDate);

public sealed record GetJobPostingEligibilityQuery(Guid UserId) : IRequest<JobPostingEligibilityDto>;

public sealed class GetJobPostingEligibilityQueryHandler : IRequestHandler<GetJobPostingEligibilityQuery, JobPostingEligibilityDto>
{
    private readonly IJobRepository _jobRepository;
    private readonly ICompanyUserRepository _members;
    private readonly IBusinessSettings _businessSettings;

    public GetJobPostingEligibilityQueryHandler(
        IJobRepository jobRepository,
        ICompanyUserRepository members,
        IBusinessSettings businessSettings)
    {
        _jobRepository = jobRepository;
        _members = members;
        _businessSettings = businessSettings;
    }

    public async Task<JobPostingEligibilityDto> Handle(GetJobPostingEligibilityQuery request, CancellationToken cancellationToken)
    {
        var member = await _members.GetByUserIdAsync(request.UserId, cancellationToken);
        if (member == null)
        {
            throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
        }

        var companyId = member.CompanyId;
        var activeCount = await _jobRepository.CountActiveJobsByCompanyIdAsync(companyId, cancellationToken);
        var freeLimit = _businessSettings.FreeActiveJobLimit;

        // 1. Kiểm tra giới hạn số tin mở đồng thời
        if (activeCount >= freeLimit)
        {
            return new JobPostingEligibilityDto(
                CanUseFreePackage: false,
                Reason: $"Doanh nghiệp đã có {activeCount} tin tuyển dụng đang mở. Gói Miễn Phí (FREE) chỉ cho phép tối đa {freeLimit} tin mở tại một thời điểm.",
                ActiveJobsCount: activeCount,
                FreeActiveLimit: freeLimit,
                LastPostedAt: null,
                NextFreeAvailableDate: null);
        }

        // 2. Kiểm tra chu kỳ đăng tin miễn phí
        var lastPosted = await _jobRepository.GetLastPostedJobByCompanyIdAsync(companyId, JobPostingPackageCodes.Free, cancellationToken);
        if (lastPosted?.PostedAt != null)
        {
            var cooldownMonths = _businessSettings.FreeCooldownMonths;
            var cooldownEnd = lastPosted.PostedAt.Value.AddMonths(cooldownMonths);
            var now = DateTime.UtcNow;

            if (cooldownEnd > now)
            {
                return new JobPostingEligibilityDto(
                    CanUseFreePackage: false,
                    Reason: $"Gói Miễn Phí (FREE) có chu kỳ {cooldownMonths} tháng giữa các lần đăng tin. Tin gần nhất của bạn được đăng ngày {lastPosted.PostedAt.Value:dd/MM/yyyy}. Bạn có thể đăng tin miễn phí tiếp theo từ ngày {cooldownEnd:dd/MM/yyyy}.",
                    ActiveJobsCount: activeCount,
                    FreeActiveLimit: freeLimit,
                    LastPostedAt: lastPosted.PostedAt.Value,
                    NextFreeAvailableDate: cooldownEnd);
            }

            return new JobPostingEligibilityDto(
                CanUseFreePackage: true,
                Reason: null,
                ActiveJobsCount: activeCount,
                FreeActiveLimit: freeLimit,
                LastPostedAt: lastPosted.PostedAt.Value,
                NextFreeAvailableDate: null);
        }

        // 3. Chưa từng đăng tin miễn phí nào
        return new JobPostingEligibilityDto(
            CanUseFreePackage: true,
            Reason: null,
            ActiveJobsCount: activeCount,
            FreeActiveLimit: freeLimit,
            LastPostedAt: null,
            NextFreeAvailableDate: null);
    }
}
