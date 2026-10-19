using System.Net;
using System.Security.Cryptography;
using System.Text;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Application.Features.Contact;

// BE-04 A: public contact form. A guest asks about a service; operations (Platform Admin, Internal HR)
// follow it up. Personal data is kept only with explicit consent (Decree 13/2023/ND-CP).

public static class ContactRequestStates
{
    public const string New = "NEW";
    public const string Contacted = "CONTACTED";
    public const string Closed = "CLOSED";

    public static readonly string[] All = [New, Contacted, Closed];
}

public static class ContactServiceInterests
{
    public static readonly string[] All = ["HEADHUNT_COD", "CV_SOURCING", "CV_APPLICATION", "OTHER"];
}

/// <summary>Where the contact notification goes (CONTACT_NOTIFY_EMAIL); empty means no email is sent.</summary>
public sealed class ContactSettings
{
    public string? NotifyEmail { get; set; }
}

public interface IContactRequestRepository
{
    Task AddAsync(ContactRequest request, CancellationToken cancellationToken = default);

    Task<int> CountFromIpSinceAsync(string sourceIpHash, DateTime since, CancellationToken cancellationToken = default);

    Task<ContactRequest?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<ContactRequest> Items, int TotalCount)> GetPageAsync(
        string? status, int page, int pageSize, CancellationToken cancellationToken = default);
}

public sealed record ContactRequestDto(
    Guid ContactRequestId, string FullName, string Email, string? Phone, string? CompanyName, string ServiceInterest,
    string Message, string Status, Guid? HandledBy, string? Note, DateTime CreatedAt, DateTime UpdatedAt);

public sealed record ContactRequestPageDto(IReadOnlyList<ContactRequestDto> Items, int TotalCount, int Page, int PageSize);

/// <summary>What the guest gets back: an acknowledgement, not the stored data.</summary>
public sealed record ContactRequestReceipt(Guid ContactRequestId, string Status, DateTime CreatedAt);

public sealed record SubmitContactRequestCommand(
    string FullName, string Email, string? Phone, string? CompanyName, string ServiceInterest, string Message,
    bool ConsentAccepted, string SourceIp) : IRequest<ContactRequestReceipt>;

public sealed record GetContactRequestsQuery(string? Status, int Page, int PageSize) : IRequest<ContactRequestPageDto>;

public sealed record UpdateContactRequestCommand(Guid ContactRequestId, string Status, string? Note, Guid UserId)
    : IRequest<ContactRequestDto>;

public sealed class ContactRequestHandlers :
    IRequestHandler<SubmitContactRequestCommand, ContactRequestReceipt>,
    IRequestHandler<GetContactRequestsQuery, ContactRequestPageDto>,
    IRequestHandler<UpdateContactRequestCommand, ContactRequestDto>
{
    private readonly IContactRequestRepository _requests;
    private readonly IAdminBusinessSettings _settings;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _audit;
    private readonly IEmailService _email;
    private readonly ContactSettings _contactSettings;
    private readonly ILogger<ContactRequestHandlers> _logger;

    public ContactRequestHandlers(
        IContactRequestRepository requests, IAdminBusinessSettings settings, IUnitOfWork unitOfWork, IAuditLogService audit,
        IEmailService email, IOptions<ContactSettings> contactSettings, ILogger<ContactRequestHandlers> logger)
    {
        _requests = requests;
        _settings = settings;
        _unitOfWork = unitOfWork;
        _audit = audit;
        _email = email;
        _contactSettings = contactSettings.Value;
        _logger = logger;
    }

    public async Task<ContactRequestReceipt> Handle(SubmitContactRequestCommand request, CancellationToken cancellationToken)
    {
        if (!request.ConsentAccepted)
        {
            throw new BadRequestException(
                "Cần đồng ý cho HR Connect xử lý dữ liệu cá nhân để liên hệ lại (Nghị định 13/2023).", "CONSENT_REQUIRED");
        }

        var fullName = Require(request.FullName, "Họ tên", 150);
        var email = Require(request.Email, "Email", 255).ToLowerInvariant();
        if (!email.Contains('@') || email.StartsWith('@') || email.EndsWith('@'))
        {
            throw new BadRequestException("Email không hợp lệ.");
        }

        var service = request.ServiceInterest?.Trim().ToUpperInvariant();
        if (service == null || !ContactServiceInterests.All.Contains(service))
        {
            throw new BadRequestException($"serviceInterest phải là {string.Join(", ", ContactServiceInterests.All)}.");
        }

        var message = Require(request.Message, "Nội dung", 2000);
        var phone = Optional(request.Phone, "Số điện thoại", 30);
        var company = Optional(request.CompanyName, "Tên công ty", 255);

        var now = DateTime.UtcNow;
        var ipHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(request.SourceIp ?? "unknown"))).ToLowerInvariant();
        var limit = await _settings.GetIntAsync(BusinessSettingKeys.ContactRateLimitPerHour, cancellationToken);
        if (await _requests.CountFromIpSinceAsync(ipHash, now.AddHours(-1), cancellationToken) >= limit)
        {
            throw new TooManyRequestsException($"Bạn đã gửi {limit} yêu cầu trong 1 giờ. Vui lòng thử lại sau.", "CONTACT_RATE_LIMITED");
        }

        var contact = new ContactRequest
        {
            ContactRequestId = Guid.NewGuid(),
            FullName = fullName,
            Email = email,
            Phone = phone,
            CompanyName = company,
            ServiceInterest = service,
            Message = message,
            ConsentAccepted = true,
            Status = ContactRequestStates.New,
            SourceIpHash = ipHash,
            CreatedAt = now,
            UpdatedAt = now,
        };
        await _requests.AddAsync(contact, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await NotifyOperationsAsync(contact, cancellationToken);
        return new ContactRequestReceipt(contact.ContactRequestId, contact.Status, contact.CreatedAt);
    }

    public async Task<ContactRequestPageDto> Handle(GetContactRequestsQuery request, CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var status = string.IsNullOrWhiteSpace(request.Status) ? null : request.Status.Trim().ToUpperInvariant();
        var (items, total) = await _requests.GetPageAsync(status, page, pageSize, cancellationToken);
        return new ContactRequestPageDto(items.Select(ToDto).ToList(), total, page, pageSize);
    }

    public async Task<ContactRequestDto> Handle(UpdateContactRequestCommand request, CancellationToken cancellationToken)
    {
        var status = request.Status?.Trim().ToUpperInvariant();
        if (status == null || !ContactRequestStates.All.Contains(status))
        {
            throw new BadRequestException($"status phải là {string.Join(", ", ContactRequestStates.All)}.");
        }

        var note = Optional(request.Note, "Ghi chú", 2000);
        var contact = await _requests.GetForUpdateAsync(request.ContactRequestId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy yêu cầu liên hệ.");

        var old = new { contact.Status, contact.Note };
        contact.Status = status;
        contact.Note = note ?? contact.Note;
        contact.HandledBy = request.UserId;
        contact.UpdatedAt = DateTime.UtcNow;

        await _audit.AddAsync(new AuditEntry
        {
            Action = AuditActions.ContactRequestUpdated,
            EntityType = "CONTACT_REQUEST",
            EntityId = contact.ContactRequestId,
            ActorUserId = request.UserId,
            OldValues = old,
            NewValues = new { contact.Status, contact.Note }
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return ToDto(contact);
    }

    /// <summary>Best effort: a failed email never loses the stored request.</summary>
    private async Task NotifyOperationsAsync(ContactRequest contact, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_contactSettings.NotifyEmail))
        {
            _logger.LogWarning("CONTACT_NOTIFY_EMAIL chưa cấu hình; yêu cầu liên hệ {Id} chỉ được lưu.", contact.ContactRequestId);
            return;
        }

        try
        {
            string E(string? value) => WebUtility.HtmlEncode(value ?? "—");
            var body = $"<p>Có yêu cầu liên hệ mới trên HR Connect.</p><ul>" +
                       $"<li>Họ tên: {E(contact.FullName)}</li><li>Email: {E(contact.Email)}</li><li>Điện thoại: {E(contact.Phone)}</li>" +
                       $"<li>Công ty: {E(contact.CompanyName)}</li><li>Dịch vụ quan tâm: {E(contact.ServiceInterest)}</li></ul>" +
                       $"<p>{E(contact.Message)}</p>";
            await _email.SendEmailAsync(_contactSettings.NotifyEmail!, $"[HR Connect] Yêu cầu liên hệ mới: {contact.FullName}", body, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Không gửi được email báo yêu cầu liên hệ {Id}.", contact.ContactRequestId);
        }
    }

    private static ContactRequestDto ToDto(ContactRequest c) => new(
        c.ContactRequestId, c.FullName, c.Email, c.Phone, c.CompanyName, c.ServiceInterest, c.Message, c.Status,
        c.HandledBy, c.Note, c.CreatedAt, c.UpdatedAt);

    private static string Require(string? value, string label, int max)
    {
        var text = value?.Trim();
        if (string.IsNullOrEmpty(text) || text.Length > max)
        {
            throw new BadRequestException($"{label} là bắt buộc và tối đa {max} ký tự.");
        }

        return text;
    }

    private static string? Optional(string? value, string label, int max)
    {
        var text = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        if (text?.Length > max)
        {
            throw new BadRequestException($"{label} tối đa {max} ký tự.");
        }

        return text;
    }
}
