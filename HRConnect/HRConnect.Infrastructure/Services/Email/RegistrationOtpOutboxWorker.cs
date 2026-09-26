using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Infrastructure.Services.Email;

/// <summary>
/// Recovers registration OTP outbox rows left PENDING when the API process stops
/// after committing the registration but before completing email delivery.
/// A fresh OTP is generated at delivery time, so raw OTP values are never persisted.
/// </summary>
public sealed class RegistrationOtpOutboxWorker : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan PendingGracePeriod = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan ProcessingLease = TimeSpan.FromMinutes(5);
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RegistrationOtpOutboxWorker> _logger;

    public RegistrationOtpOutboxWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<RegistrationOtpOutboxWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessBatchAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Registration OTP outbox worker failed.");
            }

            await Task.Delay(PollInterval, stoppingToken);
        }
    }

    internal async Task ProcessBatchAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var ids = await db.EmailOutboxes.AsNoTracking()
            .Where(item =>
                item.TemplateCode.EndsWith("REGISTRATION_OTP") &&
                item.RetryCount < 3 &&
                ((item.Status == "PENDING" && item.CreatedAt <= DateTime.UtcNow - PendingGracePeriod) ||
                 (item.Status == "PROCESSING" && item.NextRetryAt < DateTime.UtcNow)))
            .OrderBy(item => item.CreatedAt)
            .Select(item => item.EmailOutboxId)
            .Take(20)
            .ToListAsync(cancellationToken);

        foreach (var id in ids)
        {
            await ProcessOneAsync(scope.ServiceProvider, id, cancellationToken);
        }
    }

    private async Task ProcessOneAsync(
        IServiceProvider services,
        Guid outboxId,
        CancellationToken cancellationToken)
    {
        var db = services.GetRequiredService<ApplicationDbContext>();
        var now = DateTime.UtcNow;
        var claimed = await db.EmailOutboxes
            .Where(item => item.EmailOutboxId == outboxId &&
                           item.RetryCount < 3 &&
                           ((item.Status == "PENDING" && item.CreatedAt <= now - PendingGracePeriod) ||
                            (item.Status == "PROCESSING" && item.NextRetryAt < now)))
            .ExecuteUpdateAsync(update => update
                .SetProperty(item => item.Status, "PROCESSING")
                .SetProperty(item => item.NextRetryAt, now + ProcessingLease), cancellationToken);
        if (claimed != 1)
        {
            return;
        }

        var outbox = await db.EmailOutboxes.FirstAsync(item => item.EmailOutboxId == outboxId, cancellationToken);
        if (!outbox.UserId.HasValue)
        {
            outbox.Status = "FAILED";
            outbox.LastError = "Registration OTP outbox has no user id.";
            await db.SaveChangesAsync(cancellationToken);
            return;
        }

        var settings = services.GetRequiredService<IOptions<AuthenticationSettings>>().Value.Otp;
        var otpService = services.GetRequiredService<IOtpService>();
        var emailService = services.GetRequiredService<IEmailService>();
        var rawOtp = otpService.GenerateNumericOtp(settings.Length);
        var token = new UserToken
        {
            TokenId = Guid.NewGuid(),
            UserId = outbox.UserId.Value,
            TokenType = "EMAIL_OTP",
            TokenHash = otpService.HashOtp(rawOtp),
            ExpiresAt = now.AddMinutes(settings.ExpirationMinutes),
            AttemptCount = 0,
            CreatedAt = now
        };

        await db.UserTokens
            .Where(item => item.UserId == outbox.UserId && item.TokenType == "EMAIL_OTP" && item.UsedAt == null)
            .ExecuteUpdateAsync(update => update.SetProperty(item => item.UsedAt, now), cancellationToken);
        await db.UserTokens.AddAsync(token, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        try
        {
            var body = $"<p>Mã xác thực đăng ký HR Connect mới của bạn là " +
                       $"<strong style='font-size:28px;letter-spacing:5px'>{rawOtp}</strong>.</p>" +
                       $"<p>Mã có hiệu lực trong {settings.ExpirationMinutes} phút.</p>";
            var result = await emailService.SendEmailAsync(
                outbox.RecipientEmail,
                outbox.Subject ?? "Mã xác thực đăng ký HR Connect",
                body,
                cancellationToken);
            if (!result.IsSuccess)
            {
                throw new InvalidOperationException(result.ErrorMessage ?? "Email provider rejected the message.");
            }

            outbox.Status = "SENT";
            outbox.SentAt = DateTime.UtcNow;
            outbox.NextRetryAt = null;
            outbox.LastError = null;
        }
        catch (Exception ex)
        {
            token.UsedAt = DateTime.UtcNow;
            outbox.RetryCount++;
            outbox.Status = outbox.RetryCount >= 3 ? "FAILED" : "PENDING";
            outbox.NextRetryAt = outbox.Status == "PENDING" ? DateTime.UtcNow.AddMinutes(2) : null;
            outbox.LastError = ex.Message;
            _logger.LogError(ex, "Failed to recover registration OTP outbox {OutboxId}.", outboxId);
        }

        await db.SaveChangesAsync(CancellationToken.None);
    }
}
