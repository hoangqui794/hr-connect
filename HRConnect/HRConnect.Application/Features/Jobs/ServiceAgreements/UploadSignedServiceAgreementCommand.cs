using System;
using System.IO;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Jobs.ServiceAgreements;

public sealed class UploadSignedServiceAgreementCommand : IRequest<ServiceAgreementDto>
{
    [JsonIgnore] public Guid JobId { get; set; }
    [JsonIgnore] public Guid AgreementId { get; set; }
    [JsonIgnore] public Guid UserId { get; set; }
    [JsonIgnore] public Stream FileStream { get; set; } = null!;
    [JsonIgnore] public string FileName { get; set; } = null!;
    [JsonIgnore] public string ContentType { get; set; } = null!;
    [JsonIgnore] public long FileLength { get; set; }
}

public sealed class UploadSignedServiceAgreementCommandHandler : IRequestHandler<UploadSignedServiceAgreementCommand, ServiceAgreementDto>
{
    private readonly IServiceAgreementRepository _agreements;
    private readonly IJobRepository _jobs;
    private readonly ICompanyUserRepository _companyUsers;
    private readonly IUserRepository _users;
    private readonly IFileStorageService _storage;
    private readonly INotificationRepository _notifications;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _uow;

    public UploadSignedServiceAgreementCommandHandler(
        IServiceAgreementRepository agreements,
        IJobRepository jobs,
        ICompanyUserRepository companyUsers,
        IUserRepository users,
        IFileStorageService storage,
        INotificationRepository notifications,
        IAuditLogService audit,
        IUnitOfWork uow)
    {
        _agreements = agreements;
        _jobs = jobs;
        _companyUsers = companyUsers;
        _users = users;
        _storage = storage;
        _notifications = notifications;
        _audit = audit;
        _uow = uow;
    }

    public async Task<ServiceAgreementDto> Handle(UploadSignedServiceAgreementCommand request, CancellationToken ct)
    {
        if (request.FileStream == null || request.FileLength <= 0)
        {
            throw new BadRequestException("Vui lòng đính kèm tập tin hợp đồng đã ký.");
        }

        if (request.FileLength > 25 * 1024 * 1024)
        {
            throw new BadRequestException("Kích thước tệp tin không được vượt quá 25MB.");
        }

        var ext = Path.GetExtension(request.FileName).ToLowerInvariant();
        string[] allowedExtensions = [".pdf", ".jpg", ".jpeg", ".png", ".docx", ".doc"];
        if (!Array.Exists(allowedExtensions, e => e == ext))
        {
            throw new BadRequestException("Định dạng tệp không được hỗ trợ. Vui lòng tải lên file PDF, ảnh (JPG/PNG) hoặc Word (DOC/DOCX).");
        }

        var agreement = await _agreements.GetByIdForUpdateAsync(request.AgreementId, ct);
        if (agreement == null || agreement.JobId != request.JobId)
        {
            throw new NotFoundException("Không tìm thấy thỏa thuận dịch vụ yêu cầu.");
        }

        var job = await _jobs.GetByIdAsync(agreement.JobId, ct)
                  ?? throw new NotFoundException("Không tìm thấy tin tuyển dụng liên quan.");

        if (!agreement.IsCurrent || agreement.Status == ServiceAgreementStatuses.Void)
        {
            throw new ConflictException("Thỏa thuận dịch vụ này không còn hiệu lực để tải lên văn bản ký kết.");
        }

        var companyUser = await _companyUsers.GetByUserIdAsync(request.UserId, ct);
        if (companyUser == null || companyUser.CompanyId != agreement.CompanyId || companyUser.Status != "ACTIVE")
        {
            throw new ForbiddenException("Bạn không có quyền tải lên hợp đồng đã ký cho doanh nghiệp này.");
        }

        var user = await _users.GetByIdAsync(request.UserId, ct);

        // Upload to storage
        var objectKey = $"companies/{agreement.CompanyId}/service-agreements/{agreement.ServiceAgreementId}/v{agreement.Version}/signed_{Guid.NewGuid()}{ext}";
        await _storage.UploadAsync(request.FileStream, objectKey, string.IsNullOrWhiteSpace(request.ContentType) ? "application/pdf" : request.ContentType, ct);

        agreement.SignedDocumentStorageKey = objectKey;
        agreement.SignedAt = DateTime.UtcNow;
        agreement.SignerUserId = request.UserId;
        agreement.SignerNameSnapshot = user?.DisplayName ?? "Đại diện Doanh nghiệp";
        agreement.SignerEmailSnapshot = user?.Email;
        agreement.ConcurrencyToken = Guid.NewGuid();

        // Gửi thông báo cho Internal HR
        await _notifications.AddAsync(new Notification
        {
            NotificationId = Guid.NewGuid(),
            UserId = job.CreatedBy,
            NotificationType = "JOB",
            Title = "Doanh nghiệp đã tải lên hợp đồng đã ký",
            Message = $"Doanh nghiệp {agreement.CompanyNameSnapshot} đã tải lên văn bản hợp đồng đã ký cho tin \"{job.Title}\". Vui lòng xem xét và công khai tin tuyển dụng.",
            RelatedEntityType = "JOB",
            RelatedEntityId = job.JobId,
            Metadata = System.Text.Json.JsonSerializer.Serialize(new
            {
                jobId = job.JobId,
                agreementId = agreement.ServiceAgreementId,
                actionRoute = $"/internal/jobs/review?jobId={job.JobId}"
            }),
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        }, ct);

        await _audit.AddAsync(new AuditEntry
        {
            Action = "AGREEMENT_SIGNED_UPLOADED",
            EntityType = "SERVICE_AGREEMENT",
            EntityId = agreement.ServiceAgreementId,
            ActorUserId = request.UserId,
            NewValues = new
            {
                jobId = job.JobId,
                agreementId = agreement.ServiceAgreementId,
                version = agreement.Version,
                signedDocumentStorageKey = objectKey,
                fileName = request.FileName
            }
        }, ct);

        await _uow.SaveChangesAsync(ct);
        return ServiceAgreementDto.FromEntity(agreement);
    }
}
