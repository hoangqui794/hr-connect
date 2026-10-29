using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.PostingPackages;

/// <summary>
/// Admin edits a CV_APPLICATION posting package (name, description, price, display days, max CVs, on/off).
/// New values apply to jobs created or submitted afterwards: a job copies the package numbers when it
/// is submitted, and an existing posting fee keeps its amount.
/// </summary>
public sealed record UpdatePostingPackageCommand(
    Guid PackageId,
    string Name,
    string? Description,
    decimal Price,
    int DurationDays,
    int? MaxApplications,
    bool IsActive,
    Guid CurrentUserId) : IRequest<JobPostingPackageDto>;

public sealed class UpdatePostingPackageCommandHandler : IRequestHandler<UpdatePostingPackageCommand, JobPostingPackageDto>
{
    public const int NameMaxLength = 200;
    public const int DescriptionMaxLength = 2000;
    public const int MaxDurationDays = 365;
    public const decimal MaxPrice = 1_000_000_000m;

    private readonly IJobRepository _jobRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _auditLogService;

    public UpdatePostingPackageCommandHandler(IJobRepository jobRepository, IUnitOfWork unitOfWork, IAuditLogService auditLogService)
    {
        _jobRepository = jobRepository;
        _unitOfWork = unitOfWork;
        _auditLogService = auditLogService;
    }

    public async Task<JobPostingPackageDto> Handle(UpdatePostingPackageCommand request, CancellationToken cancellationToken)
    {
        var package = await _jobRepository.GetPostingPackageByIdAsync(request.PackageId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy gói đăng tin.");

        var name = request.Name?.Trim() ?? string.Empty;
        if (name.Length == 0 || name.Length > NameMaxLength)
        {
            throw new BadRequestException($"Tên gói là bắt buộc và tối đa {NameMaxLength} ký tự.");
        }

        var description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        if (description?.Length > DescriptionMaxLength)
        {
            throw new BadRequestException($"Mô tả tối đa {DescriptionMaxLength} ký tự.");
        }

        if (request.Price < 0 || request.Price > MaxPrice)
        {
            throw new BadRequestException("Giá gói phải từ 0 đến 1.000.000.000 VNĐ.");
        }

        // The FREE package is the no-payment path (no posting fee is created), so it cannot carry a price.
        if (string.Equals(package.Code, JobPostingPackageCodes.Free, StringComparison.OrdinalIgnoreCase) && request.Price != 0)
        {
            throw new BadRequestException("Gói miễn phí phải có giá 0 VNĐ.");
        }

        if (request.DurationDays < 1 || request.DurationDays > MaxDurationDays)
        {
            throw new BadRequestException($"Số ngày hiển thị phải từ 1 đến {MaxDurationDays}.");
        }

        if (request.MaxApplications is < 1)
        {
            throw new BadRequestException("Số hồ sơ tối đa phải lớn hơn 0, hoặc để trống nếu không giới hạn.");
        }

        var oldValues = Snapshot(package.Name, package.Description, package.Price, package.DurationDays, package.MaxApplications, package.IsActive);

        package.Name = name;
        package.Description = description;
        package.Price = request.Price;
        package.DurationDays = request.DurationDays;
        package.MaxApplications = request.MaxApplications;
        package.IsActive = request.IsActive;
        package.UpdatedAt = DateTime.UtcNow;

        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.PostingPackageUpdated,
            EntityType = "JOB_POSTING_PACKAGE",
            EntityId = package.PackageId,
            ActorUserId = request.CurrentUserId,
            OldValues = oldValues,
            NewValues = Snapshot(package.Name, package.Description, package.Price, package.DurationDays, package.MaxApplications, package.IsActive),
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new JobPostingPackageDto(
            package.PackageId, package.Code, package.Name, package.Description, package.Price,
            package.DurationDays, package.MaxApplications, package.IsActive);
    }

    private static object Snapshot(string name, string? description, decimal price, int durationDays, int? maxApplications, bool isActive) =>
        new { name, description, price, durationDays, maxApplications, isActive };
}
