using FluentAssertions;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.UnitTests.Repositories;

public sealed class CandidateIdentityClaimRepositoryTests
{
    [Fact]
    public void AdminCompletionEligibility_WhenHistoricalProfileMergedIntoRequester_IsAccepted()
    {
        var claim = CreateClaim();
        claim.RequesterCandidate.UserId = claim.RequesterUserId;
        claim.TargetCandidate!.Status = "ARCHIVED";
        claim.TargetCandidate.MergedIntoCandidateId = claim.RequesterCandidateId;

        IsEligible(claim).Should().BeTrue();
    }

    [Fact]
    public void AdminCompletionEligibility_WhenIdentitySwappedToHistoricalProfile_IsAccepted()
    {
        var claim = CreateClaim();
        claim.RequesterCandidate.UserId = null;
        claim.RequesterCandidate.Status = "ARCHIVED";
        claim.RequesterCandidate.MergedIntoCandidateId = claim.TargetCandidateId;
        claim.TargetCandidate!.UserId = claim.RequesterUserId;

        IsEligible(claim).Should().BeTrue();
    }

    [Fact]
    public void AdminCompletionEligibility_WhenBothProfilesRemainActive_IsRejected()
    {
        var claim = CreateClaim();
        claim.RequesterCandidate.UserId = claim.RequesterUserId;

        IsEligible(claim).Should().BeFalse();
    }

    [Fact]
    public void AdminCompletionEligibility_IsTranslatableByPostgreSqlProvider()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=localhost;Database=translation_only;Username=test;Password=test")
            .Options;
        using var context = new ApplicationDbContext(options);

        var sql = context.CandidateIdentityClaims
            .Where(CandidateIdentityClaimRepository.BuildAdminCompletedCandidateStatePredicate())
            .ToQueryString();

        sql.Should().Contain("target_candidate_id");
        sql.Should().Contain("merged_into_candidate_id");
    }

    private static bool IsEligible(CandidateIdentityClaim claim) =>
        CandidateIdentityClaimRepository.BuildAdminCompletedCandidateStatePredicate()
            .Compile()
            .Invoke(claim);

    private static CandidateIdentityClaim CreateClaim()
    {
        var requesterCandidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            Status = "ACTIVE",
            NormalizedEmail = "current@example.com"
        };
        var targetCandidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            Status = "ACTIVE",
            NormalizedEmail = "old@example.com"
        };
        return new CandidateIdentityClaim
        {
            ClaimId = Guid.NewGuid(),
            RequesterUserId = Guid.NewGuid(),
            RequesterCandidateId = requesterCandidate.CandidateId,
            TargetCandidateId = targetCandidate.CandidateId,
            AssertedEmail = "old@example.com",
            NormalizedEmail = "old@example.com",
            TokenHash = "hash",
            Status = "PENDING_ADMIN_REVIEW",
            RequesterCandidate = requesterCandidate,
            TargetCandidate = targetCandidate
        };
    }
}
