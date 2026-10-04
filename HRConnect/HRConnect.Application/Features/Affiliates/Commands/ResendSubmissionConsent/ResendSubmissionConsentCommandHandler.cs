using System.Text.Json;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.SubmissionConsents;
using HRConnect.Application.Features.SubmissionConsents.Common;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Application.Features.Affiliates.Commands.ResendSubmissionConsent;

public sealed class ResendSubmissionConsentCommandHandler : IRequestHandler<ResendSubmissionConsentCommand, ResendSubmissionConsentResponse>
{
    private readonly ISubmissionConsentRepository _consents;
    private readonly IEmailOutboxRepository _outboxes;
    private readonly IEmailService _email;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _unitOfWork;
    private readonly SubmissionConsentSettings _settings;
    private readonly ILogger<ResendSubmissionConsentCommandHandler> _logger;
    private readonly ISubmissionConsentExpiryService _expiryService;

    public ResendSubmissionConsentCommandHandler(
        ISubmissionConsentRepository consents,
        IEmailOutboxRepository outboxes,
        IEmailService email,
        IAuditLogService audit,
        IUnitOfWork unitOfWork,
        IOptions<SubmissionConsentSettings> settings,
        ILogger<ResendSubmissionConsentCommandHandler> logger,
        ISubmissionConsentExpiryService expiryService)
    {
        _consents = consents;
        _outboxes = outboxes;
        _email = email;
        _audit = audit;
        _unitOfWork = unitOfWork;
        _settings = settings.Value;
        _logger = logger;
        _expiryService = expiryService;
    }

    public async Task<ResendSubmissionConsentResponse> Handle(ResendSubmissionConsentCommand request, CancellationToken cancellationToken)
    {
        var consent = await _consents.GetBySubmissionIdAsync(request.SubmissionId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy yêu cầu Candidate xác nhận cho Submission này.");
        if (consent.Submission.SubmittedBy != request.UserId)
            throw new ForbiddenException("Bạn không có quyền gửi lại yêu cầu xác nhận của Submission này.");
        if (consent.Status != "PENDING" || consent.Submission.Status != "PENDING_CONSENT")
            throw new ConflictException($"Submission không còn chờ xác nhận; trạng thái hiện tại là {consent.Submission.Status}.");

        var now = DateTime.UtcNow;
        if (consent.ExpiresAt <= now)
        {
            await _expiryService.ExpireAsync(
                consent, now, request.UserId, "CONSENT_RESEND", cancellationToken);
            throw new ConflictException("Yêu cầu đã hết hạn. Vui lòng tạo lượt nộp mới.");
        }

        var maxSends = Math.Clamp(_settings.MaxEmailSends, 1, 10);
        if (consent.EmailSendCount >= maxSends)
            throw new ConflictException($"Đã đạt giới hạn {maxSends} lần gửi email cho yêu cầu này.");

        var cooldown = TimeSpan.FromMinutes(Math.Clamp(_settings.ResendCooldownMinutes, 1, 60));
        var lastAttemptAt = consent.EmailSentAt ?? consent.UpdatedAt;
        if (consent.EmailSendCount > 0 && lastAttemptAt.Add(cooldown) > now)
            throw new ConflictException($"Vui lòng chờ đến {lastAttemptAt.Add(cooldown):O} trước khi gửi lại.");

        var rawToken = SubmissionConsentToken.Create();
        consent.TokenHash = SubmissionConsentToken.Hash(rawToken);
        consent.RequestedAt = now;
        consent.ExpiresAt = now.AddHours(Math.Clamp(_settings.ExpirationHours, 1, 168));
        consent.EmailSendCount += 1;
        consent.EmailSentAt = null;
        consent.LastEmailError = null;
        consent.UpdatedAt = now;
        consent.ConcurrencyToken = Guid.NewGuid();

        var outbox = new EmailOutbox
        {
            EmailOutboxId = Guid.NewGuid(),
            UserId = consent.Submission.Candidate.UserId,
            RecipientEmail = consent.RecipientEmail,
            TemplateCode = "AFFILIATE_SUBMISSION_CONSENT_RESEND",
            Subject = $"Nhắc lại: xác nhận hồ sơ ứng tuyển {consent.Submission.Job.Title}",
            Payload = JsonSerializer.Serialize(new { consent.ConsentId, consent.SubmissionId, consent.ExpiresAt }),
            Status = "PENDING",
            RetryCount = 0,
            CreatedAt = now
        };
        await _outboxes.AddAsync(outbox, cancellationToken);
        await _audit.AddAsync(new AuditEntry
        {
            Action = "SUBMISSION_CONSENT_EMAIL_RESENT",
            EntityType = "SUBMISSION",
            EntityId = consent.SubmissionId,
            ActorUserId = request.UserId,
            NewValues = new { consent.EmailSendCount, consent.ExpiresAt }
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var confirmationUrl = consent.Submission.Candidate.UserId.HasValue
            ? $"{_settings.ConfirmationUrlBase.TrimEnd('/')}#submissionId={consent.SubmissionId}"
            : $"{_settings.ConfirmationUrlBase.TrimEnd('/')}#token={Uri.EscapeDataString(rawToken)}";
        var email = HRConnect.Application.Common.Email.HrConnectEmailTemplates.SubmissionConsent(
            consent.Submission.Candidate.FullName, consent.Submission.Job.Title,
            consent.Submission.Job.Company.CompanyName, confirmationUrl, consent.ExpiresAt,
            consent.Submission.Candidate.UserId.HasValue, isReminder: true);
        outbox.Subject = email.Subject;
        var result = await _email.SendEmailAsync(
            consent.RecipientEmail, email.Subject, email.HtmlBody, CancellationToken.None);

        var deliveryStatus = result.IsSuccess ? "SENT" : "FAILED";
        if (result.IsSuccess)
        {
            consent.EmailSentAt = DateTime.UtcNow;
            outbox.Status = "SENT";
            outbox.SentAt = consent.EmailSentAt;
        }
        else
        {
            consent.LastEmailError = result.ErrorMessage;
            outbox.Status = "FAILED";
            outbox.RetryCount = 1;
            outbox.LastError = result.ErrorMessage;
            _logger.LogError("Gửi lại Candidate consent thất bại cho SubmissionId={SubmissionId}: {Error}",
                consent.SubmissionId, result.ErrorMessage);
        }
        consent.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(CancellationToken.None);

        return new ResendSubmissionConsentResponse
        {
            Message = result.IsSuccess ? "Đã gửi lại yêu cầu xác nhận đến Candidate." : "Đã tạo yêu cầu gửi lại nhưng nhà cung cấp email trả lỗi.",
            SubmissionId = consent.SubmissionId,
            Status = consent.Submission.Status,
            ExpiresAt = consent.ExpiresAt,
            EmailSendCount = consent.EmailSendCount,
            EmailDeliveryStatus = deliveryStatus
        };
    }

}
