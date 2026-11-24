using System;
using System.IO;
using System.Security.Cryptography;
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
    private readonly IAppNotifier? _notifier;

    public UploadSignedServiceAgreementCommandHandler(
        IServiceAgreementRepository agreements,
        IJobRepository jobs,
        ICompanyUserRepository companyUsers,
        IUserRepository users,
        IFileStorageService storage,
        INotificationRepository notifications,
        IAuditLogService audit,
        IUnitOfWork uow,
        IAppNotifier? notifier = null)
    {
        _agreements = agreements;
        _jobs = jobs;
        _companyUsers = companyUsers;
        _users = users;
        _storage = storage;
        _notifications = notifications;
        _audit = audit;
        _uow = uow;
        _notifier = notifier;
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

        if (agreement.Status == ServiceAgreementStatuses.Signed)
        {
            throw new ConflictException(
                "Thỏa thuận dịch vụ này đã được ký kết chính thức, không thể tải lại bản ký kết.",
                "AGREEMENT_ALREADY_SIGNED");
        }

        if (agreement.Status == ServiceAgreementStatuses.ChangeRequested)
        {
            throw new ConflictException(
                "Thỏa thuận dịch vụ đang được yêu cầu điều chỉnh, không thể tải lên bản ký kết.",
                "AGREEMENT_CHANGE_REQUESTED");
        }

        var companyUser = await _companyUsers.GetByUserIdAsync(request.UserId, ct);
        if (companyUser == null || companyUser.CompanyId != agreement.CompanyId || companyUser.Status != "ACTIVE")
        {
            throw new ForbiddenException("Bạn không có quyền tải lên hợp đồng đã ký cho doanh nghiệp này.");
        }

        var user = await _users.GetByIdAsync(request.UserId, ct);

        // Buffer once so SHA-256 hashing and storage upload both read the full payload cleanly.
        using var buffer = new MemoryStream();
        await request.FileStream.CopyToAsync(buffer, ct);
        var fileBytes = buffer.ToArray();
        if (fileBytes.Length == 0)
        {
            throw new BadRequestException("Vui lòng đính kèm tập tin hợp đồng đã ký.");
        }

        if (fileBytes.Length > 25 * 1024 * 1024)
        {
            throw new BadRequestException("Kích thước tệp tin không được vượt quá 25MB.");
        }

        buffer.Position = 0;
        var documentSha256Hash = Convert.ToHexString(SHA256.HashData(fileBytes)).ToLowerInvariant();

        // Upload to storage
        var objectKey = $"companies/{agreement.CompanyId}/service-agreements/{agreement.ServiceAgreementId}/v{agreement.Version}/signed_{Guid.NewGuid()}{ext}";
        await _storage.UploadAsync(buffer, objectKey, string.IsNullOrWhiteSpace(request.ContentType) ? "application/pdf" : request.ContentType, ct);

        agreement.SignedDocumentStorageKey = objectKey;
        agreement.DocumentSha256Hash = documentSha256Hash;
        agreement.SignedAt = DateTime.UtcNow;
        agreement.SignerUserId = request.UserId;
        agreement.SignerNameSnapshot = user?.DisplayName ?? "Đại diện Doanh nghiệp";
        agreement.SignerEmailSnapshot = user?.Email;
        agreement.ConcurrencyToken = Guid.NewGuid();

        // Gửi thông báo cho Internal HR và Doanh nghiệp
        if (_notifier != null)
        {
            await _notifier.NotifyRoleAsync("INTERNAL_HR", new AppNotice(
                "JOB",
                "Doanh nghiệp đã tải lên hợp đồng đã ký",
                $"Doanh nghiệp {agreement.CompanyNameSnapshot} đã tải lên văn bản hợp đồng đã ký cho tin \"{job.Title}\". Vui lòng xem xét và công khai tin tuyển dụng.",
                "JOB",
                job.JobId,
                $"/hr/jobs?status=PENDING_AGREEMENT&highlight={job.JobId}"
            ), ct);

            await _notifier.NotifyCompanyAsync(agreement.CompanyId, new AppNotice(
                "JOB",
                "Đã tải lên hợp đồng đã ký",
                $"Văn bản hợp đồng đã ký cho tin \"{job.Title}\" đã được tải lên thành công và đang chờ HR duyệt.",
                "SERVICE_AGREEMENT",
                agreement.ServiceAgreementId,
                $"/client/agreements?jobId={job.JobId}"
            ), ct);
        }
        else
        {
            var hrRecipientId = agreement.CreatedByUserId != Guid.Empty ? agreement.CreatedByUserId : job.CreatedBy;
            await _notifications.AddAsync(new Notification
            {
                NotificationId = Guid.NewGuid(),
                UserId = hrRecipientId,
                NotificationType = "JOB",
                Title = "Doanh nghiệp đã tải lên hợp đồng đã ký",
                Message = $"Doanh nghiệp {agreement.CompanyNameSnapshot} đã tải lên văn bản hợp đồng đã ký cho tin \"{job.Title}\". Vui lòng xem xét và công khai tin tuyển dụng.",
                RelatedEntityType = "JOB",
                RelatedEntityId = job.JobId,
                Metadata = System.Text.Json.JsonSerializer.Serialize(new
                {
                    jobId = job.JobId,
                    agreementId = agreement.ServiceAgreementId,
                    status = "PENDING_AGREEMENT",
                    routeHint = $"/hr/jobs?status=PENDING_AGREEMENT&highlight={job.JobId}",
                    actionRoute = $"/hr/jobs?status=PENDING_AGREEMENT&highlight={job.JobId}"
                }),
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            }, ct);
        }

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
                documentSha256Hash,
                fileName = request.FileName
            }
        }, ct);

        await _uow.SaveChangesAsync(ct);
        return ServiceAgreementDto.FromEntity(agreement);
    }
}
