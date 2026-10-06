using FluentAssertions;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.UnitTests.Persistence;

public class CandidateCvRelationshipTests
{
    private static ApplicationDbContext CreateContext() => new(
        new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    [Fact]
    public async Task Candidate_CanTrackAndPersistThreeCvsWithoutDeletingExistingCvs()
    {
        await using var context = CreateContext();
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            FullName = "Candidate",
            ProfileVisibility = "PRIVATE",
            Status = "ACTIVE"
        };
        context.Candidates.Add(candidate);
        context.CandidateCvs.AddRange(
            CreateCv(candidate.CandidateId, "CV A", true),
            CreateCv(candidate.CandidateId, "CV B", false),
            CreateCv(candidate.CandidateId, "CV C", false));

        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var loaded = await context.Candidates.Include(c => c.CandidateCvs).SingleAsync();

        loaded.CandidateCvs.Should().HaveCount(3);
        context.ChangeTracker.Entries<CandidateCv>().Should().OnlyContain(e => e.State == EntityState.Unchanged);
    }

    [Fact]
    public async Task CandidateRepository_ProfileDetailsLoadsOnlyActivePrimaryCv()
    {
        await using var context = CreateContext();
        var userId = Guid.NewGuid();
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            UserId = userId,
            FullName = "Candidate",
            ProfileVisibility = "PRIVATE",
            Status = "ACTIVE"
        };
        context.Candidates.Add(candidate);
        context.CandidateCvs.AddRange(
            CreateCv(candidate.CandidateId, "Primary", true),
            CreateCv(candidate.CandidateId, "Secondary", false),
            CreateCv(candidate.CandidateId, "Deleted", false, "DELETED"));
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        var loaded = await new CandidateRepository(context).GetByUserIdWithDetailsAsync(userId);

        loaded!.CandidateCvs.Should().ContainSingle();
        loaded.CandidateCvs.Single().Title.Should().Be("Primary");
    }

    private static CandidateCv CreateCv(Guid candidateId, string title, bool primary, string status = "ACTIVE") => new()
    {
        CvId = Guid.NewGuid(),
        CandidateId = candidateId,
        Title = title,
        CreationMethod = "FILE_UPLOAD",
        IsPrimary = primary,
        Status = status,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };
}
