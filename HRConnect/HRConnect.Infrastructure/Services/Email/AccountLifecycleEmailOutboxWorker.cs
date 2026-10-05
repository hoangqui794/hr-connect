using System.Text.Json;
using HRConnect.Application.Common.Email;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Services.Email;

/// <summary>
/// Delivers non-secret account lifecycle messages from the durable email outbox.
/// OTP rows are deliberately excluded: they are sent only by the originating request
/// or an explicit resend request, so an abandoned registration is never replayed.
/// </summary>
public sealed class AccountLifecycleEmailOutboxWorker : BackgroundService
{
    private const int MaxAttempts = 5;
    private static readonly string[] SupportedTemplates =
    [
        "AFFILIATE_REGISTRATION_UNDER_REVIEW",
        "CLIENT_REGISTRATION_UNDER_REVIEW",
        "AFFILIATE_REGISTRATION_APPROVED",
        "AFFILIATE_REGISTRATION_REJECTED",
        "CLIENT_REGISTRATION_APPROVED",
        "CLIENT_REGISTRATION_REJECTED"
    ];

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AccountLifecycleEmailOutboxWorker> _logger;

    public AccountLifecycleEmailOutboxWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<AccountLifecycleEmailOutboxWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await ProcessBatchAsync(stoppingToken);
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await ProcessBatchAsync(stoppingToken);
        }
    }

    internal async Task ProcessBatchAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        await using var scope = _scopeFactory.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var ids = await context.EmailOutboxes.AsNoTracking()
            .Where(row => SupportedTemplates.Contains(row.TemplateCode) &&
                          row.RetryCount < MaxAttempts &&
                          ((row.Status == "PENDING" || row.Status == "FAILED") &&
                           (row.NextRetryAt == null || row.NextRetryAt <= now) ||
                           row.Status == "PROCESSING" && row.NextRetryAt <= now))
            .OrderBy(row => row.CreatedAt)
            .Take(50)
            .Select(row => row.EmailOutboxId)
            .ToListAsync(cancellationToken);

        foreach (var id in ids)
        {
            await ProcessOneAsync(id, cancellationToken);
        }
    }

    private async Task ProcessOneAsync(Guid id, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        await using var scope = _scopeFactory.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();

        var claimed = await context.EmailOutboxes
            .Where(row => row.EmailOutboxId == id &&
                          SupportedTemplates.Contains(row.TemplateCode) &&
                          row.RetryCount < MaxAttempts &&
                          ((row.Status == "PENDING" || row.Status == "FAILED") &&
                           (row.NextRetryAt == null || row.NextRetryAt <= now) ||
                           row.Status == "PROCESSING" && row.NextRetryAt <= now))
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(row => row.Status, "PROCESSING")
                .SetProperty(row => row.NextRetryAt, now.AddMinutes(15))
                .SetProperty(row => row.LastError, (string?)null), cancellationToken);
        if (claimed != 1) return;

        var row = await context.EmailOutboxes.SingleAsync(item => item.EmailOutboxId == id, cancellationToken);
        try
        {
            var email = CreateEmail(row);
            var result = await emailService.SendEmailAsync(row.RecipientEmail, email.Subject, email.HtmlBody, cancellationToken);
            if (!result.IsSuccess)
                throw new InvalidOperationException(result.ErrorMessage ?? "Nhà cung cấp email từ chối yêu cầu gửi.");

            row.Status = "SENT";
            row.SentAt = DateTime.UtcNow;
            row.NextRetryAt = null;
            row.LastError = null;
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
        {
            row.RetryCount += 1;
            row.Status = "FAILED";
            row.LastError = ex.Message.Length > 2000 ? ex.Message[..2000] : ex.Message;
            row.NextRetryAt = row.RetryCount >= MaxAttempts
                ? null
                : DateTime.UtcNow.AddMinutes(Math.Min(60, Math.Pow(2, row.RetryCount)));
            await context.SaveChangesAsync(CancellationToken.None);
            _logger.LogWarning(ex,
                "Không gửi được email lifecycle {TemplateCode} cho outbox {OutboxId}; lần thử {RetryCount}/{MaxAttempts}.",
                row.TemplateCode, row.EmailOutboxId, row.RetryCount, MaxAttempts);
        }
    }

    private static HrConnectEmail CreateEmail(EmailOutbox row)
    {
        using var document = JsonDocument.Parse(row.Payload);
        var root = document.RootElement;
        var accountLabel = root.GetProperty("accountLabel").GetString() ?? "tài khoản";

        return row.TemplateCode.EndsWith("UNDER_REVIEW", StringComparison.Ordinal)
            ? HrConnectEmailTemplates.RegistrationUnderReview(accountLabel)
            : HrConnectEmailTemplates.RegistrationReviewResult(
                accountLabel,
                root.GetProperty("approved").GetBoolean(),
                root.TryGetProperty("reviewNote", out var note) ? note.GetString() : null);
    }
}
