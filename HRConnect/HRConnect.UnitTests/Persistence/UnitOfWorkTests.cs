using FluentAssertions;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using HRConnect.Application.Common.Exceptions;

namespace HRConnect.UnitTests.Persistence;

public class UnitOfWorkTests
{
    [Fact]
    public async Task SaveChangesAsync_WhenSubmissionConsentWasChangedConcurrently_ReturnsConflict()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var consentId = Guid.NewGuid();
        await using (var seed = new ApplicationDbContext(options))
        {
            seed.SubmissionConsents.Add(new SubmissionConsent
            {
                ConsentId = consentId,
                SubmissionId = Guid.NewGuid(),
                RecipientEmail = "candidate@example.com",
                TokenHash = "initial-token-hash",
                Status = "PENDING",
                RequestedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddHours(24),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            await seed.SaveChangesAsync();
        }

        await using var firstContext = new ApplicationDbContext(options);
        await using var secondContext = new ApplicationDbContext(options);
        var first = await firstContext.SubmissionConsents.SingleAsync(x => x.ConsentId == consentId);
        var second = await secondContext.SubmissionConsents.SingleAsync(x => x.ConsentId == consentId);

        first.TokenHash = "first-request-token";
        first.ConcurrencyToken = Guid.NewGuid();
        await new UnitOfWork(firstContext).SaveChangesAsync();

        second.TokenHash = "second-request-token";
        second.ConcurrencyToken = Guid.NewGuid();
        var saveSecond = () => new UnitOfWork(secondContext).SaveChangesAsync();

        var exception = await saveSecond.Should().ThrowAsync<ConflictException>();
        exception.Which.ErrorCode.Should().Be("CONCURRENT_UPDATE");

        await using var verification = new ApplicationDbContext(options);
        (await verification.SubmissionConsents.SingleAsync(x => x.ConsentId == consentId))
            .TokenHash.Should().Be("first-request-token");
    }

    [Fact]
    public async Task CommitTransactionAsync_WhenSaveFails_ClearsRejectedGraph_BeforeBlockedDuplicateAuditIsSaved()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        await using var context = new FailOnceDbContext(options);
        var unitOfWork = new UnitOfWork(context);
        var candidateId = Guid.NewGuid();
        var jobId = Guid.NewGuid();
        var cvId = Guid.NewGuid();
        var submittedBy = Guid.NewGuid();

        context.Submissions.Add(CreateSubmission(
            candidateId, jobId, cvId, submittedBy, "ACCEPTED"));
        context.Applications.Add(new HRConnect.Domain.Entities.Application
        {
            ApplicationId = Guid.NewGuid(),
            CandidateId = candidateId,
            JobId = jobId,
            AcceptedSubmissionId = context.Submissions.Local.Single().SubmissionId,
            Status = "SUBMITTED",
            CurrentStage = "SUBMITTED",
            AppliedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });

        Func<Task> commit = () => unitOfWork.CommitTransactionAsync();
        await commit.Should().ThrowAsync<DbUpdateException>();

        context.ChangeTracker.Entries().Should().BeEmpty();

        var blocked = CreateSubmission(
            candidateId, jobId, cvId, submittedBy, "BLOCKED_DUPLICATE");
        context.Submissions.Add(blocked);
        await unitOfWork.SaveChangesAsync();

        var storedSubmissions = await context.Submissions.AsNoTracking().ToListAsync();
        storedSubmissions.Should().ContainSingle()
            .Which.SubmissionId.Should().Be(blocked.SubmissionId);
        (await context.Applications.AsNoTracking().AnyAsync()).Should().BeFalse();
    }

    [Fact]
    public async Task CommitTransactionAsync_WhenPostgreSqlRejectsUniqueRow_AllowsFreshSaveAfterRollback()
    {
        await using var context = await TryCreatePostgreSqlContextAsync();
        if (context == null) return;

        var existingRole = await context.Roles.AsNoTracking().FirstOrDefaultAsync();
        if (existingRole == null) return;

        var unitOfWork = new UnitOfWork(context);
        await unitOfWork.BeginTransactionAsync();
        context.Roles.Add(new Role
        {
            RoleId = Guid.NewGuid(),
            Code = existingRole.Code,
            Name = "Duplicate role",
            IsSystem = false,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });

        Func<Task> commit = () => unitOfWork.CommitTransactionAsync();
        await commit.Should().ThrowAsync<DbUpdateException>();
        context.ChangeTracker.Entries().Should().BeEmpty();

        var auditRole = new Role
        {
            RoleId = Guid.NewGuid(),
            Code = $"ROLLBACK_AUDIT_{Guid.NewGuid():N}",
            Name = "Rollback audit probe",
            IsSystem = false,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        context.Roles.Add(auditRole);
        await unitOfWork.SaveChangesAsync();
        (await context.Roles.AsNoTracking().AnyAsync(r => r.RoleId == auditRole.RoleId)).Should().BeTrue();

        context.Roles.Remove(auditRole);
        await unitOfWork.SaveChangesAsync();
    }

    private static Submission CreateSubmission(
        Guid candidateId,
        Guid jobId,
        Guid cvId,
        Guid submittedBy,
        string status)
    {
        return new Submission
        {
            SubmissionId = Guid.NewGuid(),
            CandidateId = candidateId,
            JobId = jobId,
            CvId = cvId,
            SubmittedBy = submittedBy,
            Source = "CANDIDATE",
            Status = status,
            SubmittedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private static async Task<ApplicationDbContext?> TryCreatePostgreSqlContextAsync()
    {
        var connectionStrings = new[]
        {
            Environment.GetEnvironmentVariable("POSTGRES_CONNECTION_STRING"),
            "Host=localhost;Port=5432;Database=HRConnect;Username=postgres;Password=devpassword;",
            "Host=localhost;Port=5432;Database=hr_connect;Username=postgres;Password=postgres;"
        };

        foreach (var connectionString in connectionStrings.Where(s => !string.IsNullOrWhiteSpace(s)))
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql(connectionString)
                .Options;
            var context = new ApplicationDbContext(options);

            try
            {
                if (await context.Database.CanConnectAsync()) return context;
            }
            catch (Exception ex) when (ex is Npgsql.NpgsqlException or System.Net.Sockets.SocketException or InvalidOperationException)
            {
                // Try the next local development connection string.
            }

            await context.DisposeAsync();
        }

        return null;
    }

    private sealed class FailOnceDbContext(DbContextOptions<ApplicationDbContext> options)
        : ApplicationDbContext(options)
    {
        private bool _failNextSave = true;

        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            if (_failNextSave)
            {
                _failNextSave = false;
                throw new DbUpdateException("Simulated unique-constraint failure.");
            }

            return base.SaveChangesAsync(cancellationToken);
        }
    }
}
