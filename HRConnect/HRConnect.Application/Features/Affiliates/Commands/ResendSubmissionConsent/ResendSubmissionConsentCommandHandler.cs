using System.Net;
using System.Text.Json;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.SubmissionConsents;
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

    public ResendSubmissionConsentCommandHandler(
        ISubmissionConsentRepository consents,
        IEmailOutboxRepository outboxes,
        IEmailService email,
        IAuditLogService audit,
        IUnitOfWork unitOfWork,
        IOptions<SubmissionConsentSettings> settings,
        ILogger<ResendSubmissionConsentCommandHandler> logger)
    {
        _consents = consents;
        _outboxes = outboxes;
        _email = email;
        _audit = audit;
        _unitOfWork = unitOfWork;
        _settings = settings.Value;
        _logger = logger;
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
            consent.Status = "EXPIRED";
            consent.Submission.Status = "CONSENT_EXPIRED";
            consent.UpdatedAt = now;
            consent.Submission.UpdatedAt = now;
            if (consent.Submission.CandidateCv is { Status: "PENDING_CONSENT" } candidateCv)
            {
                candidateCv.Status = "ARCHIVED";
                candidateCv.UpdatedAt = now;
            }
            await _unitOfWork.SaveChangesAsync(cancellationToken);
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
        var result = await _email.SendEmailAsync(
            consent.RecipientEmail,
            outbox.Subject!,
            BuildEmail(consent.Submission.Candidate.FullName, consent.Submission.Job.Title,
                consent.Submission.Job.Company.CompanyName, confirmationUrl, consent.ExpiresAt,
                consent.Submission.Candidate.UserId.HasValue),
            CancellationToken.None);

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

    private static string BuildEmail(string name, string job, string company, string url, DateTime expiresAt, bool requiresLogin) => $"""
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:24px;color:#1f2937">
          <h2 style="color:#315c2b">Nhắc lại yêu cầu xác nhận hồ sơ</h2>
          <p>Xin chào <strong>{WebUtility.HtmlEncode(name)}</strong>,</p>
          <p>Affiliate Recruiter đang chờ bạn xác nhận hồ sơ cho vị trí <strong>{WebUtility.HtmlEncode(job)}</strong> tại <strong>{WebUtility.HtmlEncode(company)}</strong>.</p>
          <p>CV không được đính kèm trong email. {(requiresLogin ? "Hãy đăng nhập đúng tài khoản Candidate trên HR Connect để xem và xác nhận." : "Bạn có thể xem và xác nhận qua liên kết bảo mật bên dưới.")}</p>
          <p style="margin:28px 0"><a href="{WebUtility.HtmlEncode(url)}" style="background:#315c2b;color:white;padding:12px 20px;border-radius:6px;text-decoration:none">Xem và xác nhận</a></p>
          <p style="font-size:13px;color:#6b7280">Liên kết hết hạn lúc {expiresAt:dd/MM/yyyy HH:mm} UTC.</p>
        </div>
        """;
}
