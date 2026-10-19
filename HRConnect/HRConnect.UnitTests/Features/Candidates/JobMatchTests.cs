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
        var (_, privateCv) = SeedCandidate("PRIVATE");
        var (applied, appliedCv) = SeedCandidate();
        _context.Add(new JobApplication
        {
            ApplicationId = Guid.NewGuid(), JobId = job.JobId, CandidateId = applied.CandidateId, Status = "SUBMITTED",
            AppliedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow, ConcurrencyToken = Guid.NewGuid(),
        });
        _context.SaveChanges();
        _ai.Scores[goodCv.CvId] = new JobMatchScore(goodCv.CvId, 82.5m, null);
        _ai.Scores[lowCv.CvId] = new JobMatchScore(lowCv.CvId, 40m, null);

        var saved = await Runner().RunOnceAsync(5, 30);

        saved.Should().Be(2);
        _ai.Calls.Single().Should().BeEquivalentTo([goodCv.CvId, lowCv.CvId]);
        _ai.Calls.Single().Should().NotContain([privateCv.CvId, appliedCv.CvId]);
        var notification = _context.Notifications.Single();
        notification.UserId.Should().Be(good.UserId!.Value);
        notification.NotificationType.Should().Be("JOB_FIT");
        notification.RelatedEntityId.Should().Be(job.JobId);

        var forGood = await new JobMatchReader(_context).GetForCandidateAsync(good.CandidateId, 70m, 20, DateTime.UtcNow);
        forGood.Should().ContainSingle().Which.CompanyName.Should().Be("Công ty A");
        (await new JobMatchReader(_context).GetForCandidateAsync(low.CandidateId, 70m, 20, DateTime.UtcNow)).Should().BeEmpty();
    }

    [Fact]
    public async Task Run_ShouldNotRescoreTheSamePair_AndKeepFailedCvsFromRetrying()
    {
        SeedJob();
        var (_, cv) = SeedCandidate();
        _ai.Scores[cv.CvId] = new JobMatchScore(cv.CvId, null, "CV_HAS_NO_TEXT");

        await Runner().RunOnceAsync(5, 30);
        await Runner().RunOnceAsync(5, 30);

        _ai.Calls.Should().ContainSingle();
        _context.CandidateJobMatches.Single().Status.Should().Be(JobMatchStates.Failed);
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
}
