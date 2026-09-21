using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Jobs.Commands.CreateJob;

public class CreateJobCommandHandler : IRequestHandler<CreateJobCommand, CreateJobResponse>
{
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IJobRepository _jobRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<CreateJobCommandHandler> _logger;

    public CreateJobCommandHandler(
        ICompanyUserRepository companyUserRepository,
        IJobRepository jobRepository,
        IUnitOfWork unitOfWork,
        ILogger<CreateJobCommandHandler> logger)
    {
        _companyUserRepository = companyUserRepository;
        _jobRepository = jobRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<CreateJobResponse> Handle(CreateJobCommand request, CancellationToken cancellationToken)
    {
        var companyUser = await _companyUserRepository.GetByUserIdAsync(request.UserId, cancellationToken);

        if (companyUser == null)
        {
            throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào nên không thể tạo công việc.");
        }

        if (!string.Equals(companyUser.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Tài khoản doanh nghiệp hiện không hoạt động.");
        }

        if (companyUser.Company == null ||
            !string.Equals(companyUser.Company.VerificationStatus, "VERIFIED", StringComparison.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Doanh nghiệp phải được xác thực trước khi tạo công việc.");
        }

        if (!await _jobRepository.IsServiceTypeActiveAsync(request.ServiceTypeId, cancellationToken))
        {
            throw new BadRequestException("Loại dịch vụ không tồn tại hoặc đã ngừng hoạt động.");
        }

        var skillIds = request.Skills.Select(x => x.SkillId).Distinct().ToList();
        if (skillIds.Count > 0 && !await _jobRepository.AreSkillsActiveAsync(skillIds, cancellationToken))
        {
            throw new BadRequestException("Một hoặc nhiều kỹ năng không tồn tại hoặc đã ngừng hoạt động.");
        }

        var now = DateTime.UtcNow;
        var jobId = Guid.NewGuid();
        var job = new Job
        {
            JobId = jobId,
            CompanyId = companyUser.CompanyId,
            ServiceTypeId = request.ServiceTypeId,
            CreatedBy = request.UserId,
            Title = request.Title?.Trim() ?? string.Empty,
            Description = NormalizeOptional(request.Description),
            Location = NormalizeOptional(request.Location),
            EmploymentType = NormalizeOptional(request.EmploymentType)?.ToUpperInvariant(),
            SalaryMin = request.SalaryMin,
            SalaryMax = request.SalaryMax,
            CurrencyCode = request.CurrencyCode.Trim().ToUpperInvariant(),
            Quantity = request.Quantity,
            Status = JobStatuses.Draft,
            PostedAt = null,
            ClosedAt = null,
            CreatedAt = now,
            UpdatedAt = now,
            Visibility = request.Visibility.Trim().ToUpperInvariant(),
            StatusReason = null
        };

        foreach (var requirement in request.Requirements)
        {
            job.JobRequirements.Add(new JobRequirement
            {
                RequirementId = Guid.NewGuid(),
                JobId = jobId,
                RequirementType = requirement.RequirementType.Trim().ToUpperInvariant(),
                Category = NormalizeOptional(requirement.Category),
                Content = requirement.Content.Trim(),
                Weight = requirement.Weight,
                CreatedAt = now,
                UpdatedAt = now
            });
        }


        foreach (var skill in request.Skills)
        {
            job.JobSkills.Add(new JobSkill
            {
                JobId = jobId,
                SkillId = skill.SkillId,
                IsMandatory = skill.IsMandatory,
                Weight = skill.Weight
            });
        }

        job.JobStatusHistories.Add(new JobStatusHistory
        {
            JobStatusHistoryId = Guid.NewGuid(),
            JobId = jobId,
            OldStatus = null,
            NewStatus = JobStatuses.Draft,
            ChangedBy = request.UserId,
            Reason = "Job draft created",
            ChangedAt = now
        });

        await _jobRepository.AddAsync(job, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Job draft {JobId} created by UserId {UserId} for CompanyId {CompanyId}.",
            job.JobId,
            request.UserId,
            companyUser.CompanyId);

        return new CreateJobResponse
        {
            Data = new CreateJobData
            {
                JobId = job.JobId,
                CompanyId = job.CompanyId,
                ServiceTypeId = job.ServiceTypeId,
                Title = job.Title,
                Status = job.Status,
                Visibility = job.Visibility,
                RequirementCount = job.JobRequirements.Count,
                SkillCount = job.JobSkills.Count,
                CreatedAt = job.CreatedAt
            }
        };
    }

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
