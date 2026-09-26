using System.Reflection;
using FluentAssertions;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.UnitTests.Persistence;

public class Mf04SchemaReconcileTests
{
    private static readonly string[] Mf04Permissions =
    [
        "interview.record_result",
        "application.decide_backup",
        "offer.send",
        "offer.withdraw",
        "placement.confirm",
        "application.mark_not_started"
    ];

    [Fact]
    public void EmbeddedSeed_ContainsMf04Permissions_AndAssignsToRoles()
    {
        var field = typeof(DatabaseSeeder).GetField(
            "EmbeddedPermissionSeedSql",
            BindingFlags.NonPublic | BindingFlags.Static);

        field.Should().NotBeNull();
        var sql = field!.GetRawConstantValue().Should().BeOfType<string>().Subject;

        foreach (var perm in Mf04Permissions)
        {
            sql.Should().Contain($"'{perm}'");
        }

        AssertRoleContainsPermissions(sql, "CLIENT_COMPANY_USER", Mf04Permissions);
        AssertRoleContainsPermissions(sql, "INTERNAL_HR", Mf04Permissions);
        AssertRoleContainsPermissions(sql, "PLATFORM_ADMIN", Mf04Permissions);
    }

    [Fact]
    public void PermissionFile_ContainsMf04Permissions_AndAssignsToRoles()
    {
        var permissionFile = FindPermissionFile();
        permissionFile.Should().NotBeNull();

        var sql = File.ReadAllText(permissionFile!);

        foreach (var perm in Mf04Permissions)
        {
            sql.Should().Contain($"'{perm}'");
        }

        AssertRoleContainsPermissions(sql, "CLIENT_COMPANY_USER", Mf04Permissions);
        AssertRoleContainsPermissions(sql, "INTERNAL_HR", Mf04Permissions);
        AssertRoleContainsPermissions(sql, "PLATFORM_ADMIN", Mf04Permissions);
    }

    [Fact]
    public async Task ModelBuilder_MapsMf04EntitiesAndPropertiesProperly()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        await using var context = new ApplicationDbContext(options);
        var model = context.Model;

        // 1. Application planned_start_date & concurrency_token
        var appEntity = model.FindEntityType(typeof(Domain.Entities.Application));
        appEntity.Should().NotBeNull();
        appEntity!.FindProperty("PlannedStartDate").Should().NotBeNull();
        var appConcurrency = appEntity.FindProperty("ConcurrencyToken");
        appConcurrency.Should().NotBeNull();
        appConcurrency!.IsConcurrencyToken.Should().BeTrue();

        // 2. Interview recorded_by, recorded_at, concurrency_token
        var interviewEntity = model.FindEntityType(typeof(Interview));
        interviewEntity.Should().NotBeNull();
        interviewEntity!.FindProperty("RecordedBy").Should().NotBeNull();
        interviewEntity.FindProperty("RecordedAt").Should().NotBeNull();
        var interviewConcurrency = interviewEntity.FindProperty("ConcurrencyToken");
        interviewConcurrency.Should().NotBeNull();
        interviewConcurrency!.IsConcurrencyToken.Should().BeTrue();

        // 3. Offer concurrency_token
        var offerEntity = model.FindEntityType(typeof(Offer));
        offerEntity.Should().NotBeNull();
        var offerConcurrency = offerEntity!.FindProperty("ConcurrencyToken");
        offerConcurrency.Should().NotBeNull();
        offerConcurrency!.IsConcurrencyToken.Should().BeTrue();

        // 4. InterviewParticipant entity
        var participantEntity = model.FindEntityType(typeof(InterviewParticipant));
        participantEntity.Should().NotBeNull();
        participantEntity!.FindProperty("Role").Should().NotBeNull();

        // 5. InterviewStatusHistory entity
        var historyEntity = model.FindEntityType(typeof(InterviewStatusHistory));
        historyEntity.Should().NotBeNull();

        // 6. Placement confirmed_by, confirmed_at, confirmation_note
        var placementEntity = model.FindEntityType(typeof(Placement));
        placementEntity.Should().NotBeNull();
        placementEntity!.FindProperty("ConfirmedBy").Should().NotBeNull();
        placementEntity.FindProperty("ConfirmedAt").Should().NotBeNull();
        placementEntity.FindProperty("ConfirmationNote").Should().NotBeNull();

        // 7. Verify persistence of new entities
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "interviewer@test.com",
            PasswordHash = "hash",
            Status = "ACTIVE"
        };
        context.AppUsers.Add(user);

        var interview = new Interview
        {
            InterviewId = Guid.NewGuid(),
            ApplicationId = Guid.NewGuid(),
            InterviewRound = 1,
            Status = "SCHEDULED",
            RecordedBy = user.UserId,
            RecordedAt = DateTime.UtcNow,
            ConcurrencyToken = Guid.NewGuid()
        };
        context.Interviews.Add(interview);

        var participant = new InterviewParticipant
        {
            InterviewParticipantId = Guid.NewGuid(),
            InterviewId = interview.InterviewId,
            UserId = user.UserId,
            Role = "INTERVIEWER",
            CreatedAt = DateTime.UtcNow
        };
        context.InterviewParticipants.Add(participant);

        var history = new InterviewStatusHistory
        {
            InterviewStatusHistoryId = Guid.NewGuid(),
            InterviewId = interview.InterviewId,
            OldStatus = null,
            NewStatus = "SCHEDULED",
            ChangedBy = user.UserId,
            ChangedAt = DateTime.UtcNow
        };
        context.InterviewStatusHistories.Add(history);

        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        var loadedParticipant = await context.InterviewParticipants.FindAsync(participant.InterviewParticipantId);
        loadedParticipant.Should().NotBeNull();
        loadedParticipant!.Role.Should().Be("INTERVIEWER");

        var loadedHistory = await context.InterviewStatusHistories.FindAsync(history.InterviewStatusHistoryId);
        loadedHistory.Should().NotBeNull();
        loadedHistory!.NewStatus.Should().Be("SCHEDULED");
    }

    private static void AssertRoleContainsPermissions(string sql, string roleCode, string[] permissions)
    {
        var roleEnd = sql.IndexOf($"WHERE r.code = '{roleCode}'", StringComparison.Ordinal);
        roleEnd.Should().BeGreaterThan(0, $"role {roleCode} should exist in seed script");

        var roleStart = sql.LastIndexOf("JOIN public.permission p", roleEnd, StringComparison.Ordinal);
        roleStart.Should().BeGreaterThanOrEqualTo(0);

        var section = sql[roleStart..roleEnd];
        foreach (var perm in permissions)
        {
            section.Should().Contain($"'{perm}'", $"role {roleCode} should have permission {perm}");
        }
    }

    private static string? FindPermissionFile()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null)
        {
            var directPath = Path.Combine(directory.FullName, "Permission.md");
            if (File.Exists(directPath)) return directPath;

            var solutionPath = Path.Combine(directory.FullName, "HRConnect", "Permission.md");
            if (File.Exists(solutionPath)) return solutionPath;

            directory = directory.Parent;
        }

        return null;
    }
}
