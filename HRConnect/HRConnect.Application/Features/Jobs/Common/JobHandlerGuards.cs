using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.Jobs.Common;

public static class JobHandlerGuards
{
    public static async Task<Job> GetJobAsync(IJobRepository repository, Guid jobId, CancellationToken cancellationToken) =>
        await repository.GetByIdAsync(jobId, cancellationToken)
        ?? throw new NotFoundException("Không tìm thấy công việc.");

    public static async Task<Job> GetOwnedJobAsync(
        IJobRepository jobRepository, ICompanyUserRepository companyUserRepository,
        Guid jobId, Guid userId, CancellationToken cancellationToken)
    {
        var member = await companyUserRepository.GetByUserIdAsync(userId, cancellationToken)
            ?? throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
        var job = await GetJobAsync(jobRepository, jobId, cancellationToken);
        if (job.CompanyId != member.CompanyId)
            throw new ForbiddenException("Bạn không có quyền thao tác công việc của doanh nghiệp khác.");
        return job;
    }

    public static void RequireStatus(Job job, params string[] allowed)
    {
        if (!allowed.Contains(job.Status, StringComparer.OrdinalIgnoreCase))
            throw new ConflictException($"Không thể thực hiện thao tác khi công việc ở trạng thái {job.Status}.");
    }
}
