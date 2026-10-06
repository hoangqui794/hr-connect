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

    [Fact]
    public async Task GetLibraryDetail_ReturnsOnlyAllowedCvs()
    {
        await using var context = CreateContext();
        var affiliateUserId = AddAffiliate(context);
        var candidate = Candidate("Candidate");
        context.Candidates.Add(candidate);
        var allowedCv = AddAcceptedAffiliateCv(context, candidate, affiliateUserId, "ALLOWED");
        AddAcceptedAffiliateCv(context, candidate, affiliateUserId, "REVOKED");
        await context.SaveChangesAsync();

        var detail = await new SubmissionRepository(context)
            .GetAffiliateCandidateLibraryDetailAsync(affiliateUserId, candidate.CandidateId);

        detail.Should().NotBeNull();
        detail!.Cvs.Should().ContainSingle(cv => cv.CvId == allowedCv.CvId);
    }

    [Fact]
    public async Task GetLibraryDetail_WhenEveryCvIsRevoked_ReturnsNotFoundShape()
    {
        await using var context = CreateContext();
        var affiliateUserId = AddAffiliate(context);
        var candidate = Candidate("Candidate");
        context.Candidates.Add(candidate);
        AddAcceptedAffiliateCv(context, candidate, affiliateUserId, "REVOKED");
        await context.SaveChangesAsync();

        var detail = await new SubmissionRepository(context)
            .GetAffiliateCandidateLibraryDetailAsync(affiliateUserId, candidate.CandidateId);

        detail.Should().BeNull();
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

    private static Guid AddAffiliate(ApplicationDbContext context)
    {
        var userId = Guid.NewGuid();
        context.AppUsers.Add(new AppUser
        {
            UserId = userId,
            Email = $"affiliate-{userId:N}@example.com",
            PasswordHash = "hash",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        return userId;
    }

    private static CandidateCv AddAcceptedAffiliateCv(
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
        return cv;
    }
}
