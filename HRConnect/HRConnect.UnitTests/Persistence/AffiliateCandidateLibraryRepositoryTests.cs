using FluentAssertions;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.UnitTests.Persistence;

public sealed class AffiliateCandidateLibraryRepositoryTests
{
    [Fact]
    public async Task GetLibrary_ReturnsOnlyCandidatesWithAnAllowedReusableCv()
    {
        await using var context = CreateContext();
        var affiliateUserId = Guid.NewGuid();
        context.AppUsers.Add(new AppUser
        {
            UserId = affiliateUserId,
            Email = "affiliate@example.com",
            PasswordHash = "hash",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        var allowedCandidate = Candidate("Allowed Candidate");
        var revokedCandidate = Candidate("Revoked Candidate");
        context.Candidates.AddRange(allowedCandidate, revokedCandidate);
        AddAcceptedAffiliateCv(context, allowedCandidate, affiliateUserId, "ALLOWED");
        AddAcceptedAffiliateCv(context, revokedCandidate, affiliateUserId, "REVOKED");
        await context.SaveChangesAsync();

        var (items, totalCount) = await new SubmissionRepository(context)
            .GetAffiliateCandidateLibraryAsync(
                affiliateUserId, null, "lastSubmittedAt", "desc", 1, 20);

        totalCount.Should().Be(1);
        items.Should().ContainSingle(item =>
            item.CandidateId == allowedCandidate.CandidateId && item.ActiveCvCount == 1);
    }

    private static ApplicationDbContext CreateContext() => new(
        new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static Candidate Candidate(string name) => new()
    {
        CandidateId = Guid.NewGuid(),
        FullName = name,
        ProfileVisibility = "PRIVATE",
        Status = "ACTIVE",
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };

    private static void AddAcceptedAffiliateCv(
        ApplicationDbContext context,
        Candidate candidate,
        Guid affiliateUserId,
        string reuseStatus)
    {
        var cv = new CandidateCv
        {
            CvId = Guid.NewGuid(),
            CandidateId = candidate.CandidateId,
            Candidate = candidate,
            Title = "CV",
            CreationMethod = "AFFILIATE_UPLOAD",
            UploadedByUserId = affiliateUserId,
            AffiliateReuseStatus = reuseStatus,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.CandidateCvs.Add(cv);
        context.Submissions.Add(new Submission
        {
            SubmissionId = Guid.NewGuid(),
            CandidateId = candidate.CandidateId,
            Candidate = candidate,
            CvId = cv.CvId,
            CandidateCv = cv,
            JobId = Guid.NewGuid(),
            SubmittedBy = affiliateUserId,
            Source = "AFFILIATE",
            Status = "ACCEPTED",
            SubmittedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
    }
}
