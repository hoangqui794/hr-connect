using FluentAssertions;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Candidates.JobMatches;
using HRConnect.Application.Features.Settings;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using HRConnect.Infrastructure.Services.JobMatching;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.Candidates;

/// <summary>BE-04 C: who gets scored, what is saved and when the candidate is notified.</summary>
public class JobMatchTests
{
    private readonly ApplicationDbContext _context = new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private readonly FakeAi _ai = new();

    private sealed class FakeAi : IJobMatchAiClient
    {
        public Dictionary<Guid, JobMatchScore> Scores { get; } = new();
        public List<IReadOnlyList<Guid>> Calls { get; } = new();

        public Task<IReadOnlyList<JobMatchScore>> ScoreAsync(Guid jobId, IReadOnlyList<Guid> cvIds, CancellationToken cancellationToken = default)
        {
            Calls.Add(cvIds);
            return Task.FromResult<IReadOnlyList<JobMatchScore>>(cvIds.Where(Scores.ContainsKey).Select(id => Scores[id]).ToList());
        }
    }

    private BusinessSettingsService Settings() => new(new SystemSettingRepository(_context));

    private JobMatchRunner Runner() => new(_context, _ai, Settings(), NullLogger<JobMatchRunner>.Instance);

    private Job SeedJob(bool candidateCanView = true)
    {
        var now = DateTime.UtcNow;
        var role = new Role { RoleId = Guid.NewGuid(), Code = "CANDIDATE", Name = "Candidate", IsActive = true };
        var serviceType = new ServiceType { ServiceTypeId = Guid.NewGuid(), Code = "CV_APPLICATION", Name = "CV" };
        var company = new Company { CompanyId = Guid.NewGuid(), CompanyName = "Công ty A", VerificationStatus = "VERIFIED", CreatedAt = now, UpdatedAt = now };
        var job = new Job
        {
            JobId = Guid.NewGuid(), CompanyId = company.CompanyId, ServiceTypeId = serviceType.ServiceTypeId, CreatedBy = Guid.NewGuid(),
            Title = "Backend .NET", Location = "Hà Nội", CurrencyCode = "VND", Quantity = 1, Status = "ACTIVE", PostedAt = now,
            CreatedAt = now, UpdatedAt = now, ConcurrencyToken = Guid.NewGuid(),
        };
        _context.AddRange(role, serviceType, company, job, new ServiceTypeAllowedRole
        {
            ServiceTypeId = serviceType.ServiceTypeId, RoleId = role.RoleId, CanView = candidateCanView, CanSubmit = true, CreatedAt = now, UpdatedAt = now,
        });
        _context.SaveChanges();
        return job;
    }

    private (Candidate Candidate, CandidateCv Cv) SeedCandidate(string visibility = "PUBLIC")
    {
        var now = DateTime.UtcNow;
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(), UserId = Guid.NewGuid(), FullName = "Ứng viên", NormalizedEmail = $"{Guid.NewGuid():N}@example.com",
            ProfileVisibility = visibility, Status = "ACTIVE", CreatedAt = now, UpdatedAt = now,
        };
        var cv = new CandidateCv
        {
            CvId = Guid.NewGuid(), CandidateId = candidate.CandidateId, Title = "CV", CreationMethod = "UPLOAD", IsPrimary = true,
            Status = "ACTIVE", CreatedAt = now, UpdatedAt = now,
        };
        _context.AddRange(candidate, cv);
        _context.SaveChanges();
        return (candidate, cv);
    }

    [Fact]
    public async Task Run_ShouldScoreOnlyEligibleCandidates_AndNotifyGoodMatches()
    {
        var job = SeedJob();
        var (good, goodCv) = SeedCandidate();
        var (low, lowCv) = SeedCandidate();
        var (privateCandidate, privateCv) = SeedCandidate("PRIVATE");
        var (applied, appliedCv) = SeedCandidate();
        _context.Add(new JobApplication
        {
            ApplicationId = Guid.NewGuid(), JobId = job.JobId, CandidateId = applied.CandidateId, Status = "SUBMITTED",
            AppliedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow, ConcurrencyToken = Guid.NewGuid(),
        });
        _context.SaveChanges();
        _ai.Scores[goodCv.CvId] = new JobMatchScore(goodCv.CvId, 82.5m, null);
        _ai.Scores[lowCv.CvId] = new JobMatchScore(lowCv.CvId, 40m, null);
        _ai.Scores[privateCv.CvId] = new JobMatchScore(privateCv.CvId, 78m, null);

        var saved = await Runner().RunOnceAsync(5, 30);

        saved.Should().Be(3);
        _ai.Calls.Single().Should().BeEquivalentTo([goodCv.CvId, lowCv.CvId, privateCv.CvId]);
        _ai.Calls.Single().Should().NotContain(appliedCv.CvId);
        _context.Notifications.Select(n => n.UserId).Should().BeEquivalentTo([good.UserId!.Value, privateCandidate.UserId!.Value]);
        _context.Notifications.Should().OnlyContain(n => n.NotificationType == "JOB_FIT" && n.RelatedEntityId == job.JobId);

        var forGood = await new JobMatchReader(_context).GetForCandidateAsync(good.CandidateId, 70m, 20, DateTime.UtcNow);
        forGood.Items.Should().ContainSingle().Which.CompanyName.Should().Be("Công ty A");
        forGood.Meta.HasPrimaryCv.Should().BeTrue();
        (await new JobMatchReader(_context).GetForCandidateAsync(low.CandidateId, 70m, 20, DateTime.UtcNow)).Items.Should().BeEmpty();
    }

    [Fact]
    public async Task Run_ShouldNotImmediatelyRetryTheSameFailedInput()
    {
        SeedJob();
        var (_, cv) = SeedCandidate();
        _ai.Scores[cv.CvId] = new JobMatchScore(cv.CvId, null, "CV_HAS_NO_TEXT");

        await Runner().RunOnceAsync(5, 30);
        await Runner().RunOnceAsync(5, 30);

        _ai.Calls.Should().ContainSingle();
        _context.CandidateJobMatches.Single().Status.Should().Be(JobMatchStates.Failed);
        _context.CandidateJobMatches.Single().RetryCount.Should().Be(1);
        _context.CandidateJobMatches.Single().NextRetryAt.Should().BeAfter(DateTime.UtcNow);
        _context.Notifications.Should().BeEmpty();
    }

    [Fact]
    public async Task Run_ShouldCapNotificationsPerDay()
    {
        var (candidate, cv) = SeedCandidate();
        var limit = await Settings().GetIntAsync(BusinessSettingKeys.JobMatchMaxNotificationsPerDay);
        for (var i = 0; i < limit + 2; i++) SeedJob();
        _ai.Scores[cv.CvId] = new JobMatchScore(cv.CvId, 95m, null);

        await Runner().RunOnceAsync(limit + 2, 30);

        _context.CandidateJobMatches.Count().Should().Be(limit + 2);
        _context.Notifications.Count(n => n.UserId == candidate.UserId).Should().Be(limit);
    }

    [Fact]
    public async Task Run_ShouldSkipJobsCandidatesCannotView()
    {
        SeedJob(candidateCanView: false);
        SeedCandidate();

        (await Runner().RunOnceAsync(5, 30)).Should().Be(0);
        _ai.Calls.Should().BeEmpty();
    }

    [Fact]
    public async Task Run_ShouldRescoreWhenCandidateInputChanges()
    {
        SeedJob();
        var (candidate, cv) = SeedCandidate();
        _ai.Scores[cv.CvId] = new JobMatchScore(cv.CvId, 80m, null);

        (await Runner().RunOnceAsync(5, 30)).Should().Be(1);
        candidate.TargetRole = "Backend Engineer";
        candidate.UpdatedAt = DateTime.UtcNow.AddMinutes(1);
        await _context.SaveChangesAsync();

        (await Runner().RunOnceAsync(5, 30)).Should().Be(1);
        _context.CandidateJobMatches.Count().Should().Be(2);
        _context.CandidateJobMatches.Select(m => m.InputFingerprint).Distinct().Should().HaveCount(2);
    }

    [Fact]
    public async Task Run_ShouldContinuePastAlreadyScoredCandidates_WhenBatchLimitIsSmall()
    {
        var job = SeedJob();
        var first = SeedCandidate();
        var second = SeedCandidate();
        var ordered = new[] { first, second }.OrderBy(x => x.Candidate.CandidateId).ToArray();
        var alreadyScored = ordered[0];
        var waiting = ordered[1];
        _context.CandidateJobMatches.Add(new CandidateJobMatch
        {
            CandidateJobMatchId = Guid.NewGuid(), CandidateId = alreadyScored.Candidate.CandidateId,
            JobId = job.JobId, CvId = alreadyScored.Cv.CvId, AttemptNo = 1, RetryCount = 1,
            InputFingerprint = HybridJobMatchScorer.BuildFingerprint(alreadyScored.Candidate, alreadyScored.Cv, job),
            ScoringVersion = HybridJobMatchScorer.Version, MatchScore = 80m, Status = JobMatchStates.Generated,
            GeneratedAt = DateTime.UtcNow, ExpiresAt = DateTime.UtcNow.AddDays(7), CreatedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();
        _ai.Scores[waiting.Cv.CvId] = new JobMatchScore(waiting.Cv.CvId, 85m, null);

        (await Runner().RunOnceAsync(5, 1)).Should().Be(1);

        _ai.Calls.Should().ContainSingle();
        _ai.Calls.Single().Should().Equal(waiting.Cv.CvId);
        _context.CandidateJobMatches.Should().Contain(m => m.CandidateId == waiting.Candidate.CandidateId);
    }

    [Fact]
    public async Task Dismiss_ShouldBeOwnedAndIdempotent()
    {
        var job = SeedJob();
        var (candidate, cv) = SeedCandidate();
        var other = SeedCandidate().Candidate;
        var match = new CandidateJobMatch
        {
            CandidateJobMatchId = Guid.NewGuid(), CandidateId = candidate.CandidateId, JobId = job.JobId, CvId = cv.CvId,
            AttemptNo = 1, RetryCount = 1, Status = JobMatchStates.Generated, GeneratedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };
        _context.CandidateJobMatches.Add(match);
        await _context.SaveChangesAsync();
        var writer = new JobMatchWriter(_context);

        (await writer.DismissAsync(other.CandidateId, match.CandidateJobMatchId, DateTime.UtcNow)).Should().BeFalse();
        (await writer.DismissAsync(candidate.CandidateId, match.CandidateJobMatchId, DateTime.UtcNow)).Should().BeTrue();
        (await writer.DismissAsync(candidate.CandidateId, match.CandidateJobMatchId, DateTime.UtcNow)).Should().BeTrue();
        match.Status.Should().Be(JobMatchStates.Dismissed);
        match.DismissedAt.Should().NotBeNull();
    }

    [Fact]
    public void HybridScore_ShouldUseStructuredSignals_AndExplainTheResult()
    {
        var now = DateTime.UtcNow;
        var skill = new Skill { SkillId = Guid.NewGuid(), SkillName = ".NET", NormalizedName = "dotnet", IsActive = true, CreatedAt = now };
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(), FullName = "A", ProfileVisibility = "PRIVATE", Status = "ACTIVE",
            TargetRole = "Backend .NET Developer", YearsOfExperience = 3, PreferredLocations = "[\"Hà Nội\"]",
            ExpectedSalaryMin = 20_000_000, ExpectedSalaryMax = 30_000_000, ExpectedSalaryCurrency = "VND"
        };
        candidate.CandidateSkills.Add(new CandidateSkill { CandidateId = candidate.CandidateId, SkillId = skill.SkillId, Skill = skill });
        var job = new Job
        {
            JobId = Guid.NewGuid(), Title = ".NET Backend Developer", Location = "Hà Nội", CurrencyCode = "VND",
            MinExperienceYears = 2, SalaryMin = 22_000_000, SalaryMax = 28_000_000, PostedAt = now, CreatedAt = now, UpdatedAt = now
        };
        job.JobSkills.Add(new JobSkill { JobId = job.JobId, SkillId = skill.SkillId, Skill = skill, IsMandatory = true });
        var tier = new MatchTierConfig { TierCode = "HIGH", DisplayName = "Rất phù hợp", MinScore = 80, MaxScore = 100, IsActive = true };

        var result = HybridJobMatchScorer.Evaluate(candidate, job, 80m, [tier], now);

        result.Score.Should().BeGreaterThan(85m);
        result.TierCode.Should().Be("HIGH");
        result.MatchingReasons.Should().Contain(reason => reason.Contains("Kỹ năng"));
        result.MissingRequirements.Should().BeEmpty();
    }
}
