using FluentAssertions;
using FluentValidation.TestHelper;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.CandidateDuplicates.Resolve;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.CandidateDuplicates;

public sealed class ResolveCandidateDuplicateCaseCommandHandlerTests
{
    private readonly Mock<ICandidateDuplicateRepository> _duplicates = new();
    private readonly Mock<ICandidateRepository> _candidates = new();
    private readonly Mock<ISubmissionRepository> _submissions = new();
    private readonly Mock<IApplicationRepository> _applications = new();
    private readonly Mock<IAttributionRepository> _attributions = new();
    private readonly Mock<INotificationRepository> _notifications = new();
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();

    [Fact]
    public async Task Merge_SelectsEarliestConfirmedWinnerAndArchivesSource()
    {
        var fixture = CreateFixture();
        fixture.CandidateB.UserId = Guid.NewGuid();
        var early = CreateHeldSubmission(fixture.CandidateA, fixture.Job, DateTime.UtcNow.AddMinutes(-5));
        var late = CreateHeldSubmission(fixture.CandidateB, fixture.Job, DateTime.UtcNow.AddMinutes(-1));
        var lateApplication = CreateApplication(late);
        var lateAttribution = CreateAttribution(lateApplication, late);
        lateApplication.Attribution = lateAttribution;
        late.Applications.Add(lateApplication);
        late.Attribution = lateAttribution;
        SetupLocks(fixture, [early, late], [lateApplication]);

        var response = await CreateHandler().Handle(CreateCommand(fixture), CancellationToken.None);

        response.Status.Should().Be("MERGED");
        response.CanonicalCandidateId.Should().Be(fixture.CandidateB.CandidateId);
        response.SourceCandidateId.Should().Be(fixture.CandidateA.CandidateId);
        response.PendingFinalizationSubmissionIds.Should().Equal(early.SubmissionId);
        fixture.CandidateA.Status.Should().Be("ARCHIVED");
        fixture.CandidateA.MergedIntoCandidateId.Should().Be(fixture.CandidateB.CandidateId);
        late.Status.Should().Be("BLOCKED_DUPLICATE");
        late.DuplicateOfSubmissionId.Should().Be(early.SubmissionId);
        lateApplication.Status.Should().Be("CLOSED");
        lateAttribution.Status.Should().Be("SUPERSEDED");
        _unitOfWork.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(x => x.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Merge_WhenCompletedPayoutExists_PersistsFinanceBlockAndDoesNotMutateCandidates()
    {
        var fixture = CreateFixture();
        var held = CreateHeldSubmission(fixture.CandidateA, fixture.Job, DateTime.UtcNow.AddMinutes(-1));
        var application = CreateApplication(held);
        var attribution = CreateAttribution(application, held);
        var commission = new Commission
        {
            CommissionId = Guid.NewGuid(),
            AttributionId = attribution.AttributionId,
            Status = "PAYABLE",
            RuleSnapshot = "{}",
            CalculationSnapshot = "{}"
        };
        commission.Payouts.Add(new Payout
        {
            PayoutId = Guid.NewGuid(),
            CommissionId = commission.CommissionId,
            Status = "COMPLETED"
        });
        attribution.Commissions.Add(commission);
        application.Attribution = attribution;
        SetupLocks(fixture, [held], [application]);

        var action = () => CreateHandler().Handle(CreateCommand(fixture), CancellationToken.None);

        var exception = await action.Should().ThrowAsync<ConflictException>();
        exception.Which.ErrorCode.Should().Be("CANDIDATE_MERGE_PAID_COMMISSION");
        fixture.DuplicateCase.Status.Should().Be("BLOCKED_FINANCE");
        fixture.CandidateA.Status.Should().Be("ACTIVE");
        fixture.CandidateB.Status.Should().Be("ACTIVE");
        _unitOfWork.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(x => x.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Resolve_WhenConcurrencyTokenIsStale_RollsBackWithoutMutation()
    {
        var fixture = CreateFixture();
        _duplicates.Setup(x => x.GetByIdForUpdateAsync(
                fixture.DuplicateCase.DuplicateCaseId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(fixture.DuplicateCase);
        var command = CreateCommand(fixture) with { ConcurrencyToken = Guid.NewGuid() };

        var action = () => CreateHandler().Handle(command, CancellationToken.None);

        var exception = await action.Should().ThrowAsync<ConflictException>();
        exception.Which.ErrorCode.Should().Be("STALE_DUPLICATE_CASE");
        _unitOfWork.Verify(x => x.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _candidates.Verify(x => x.Update(It.IsAny<Candidate>()), Times.Never);
    }

    [Fact]
    public async Task Resolve_WithSameIdempotencyKey_ReturnsReplayWithoutApplyingAgain()
    {
        var fixture = CreateFixture();
        fixture.DuplicateCase.Status = "MERGED";
        fixture.DuplicateCase.Resolution = "MERGED";
        fixture.DuplicateCase.CanonicalCandidateId = fixture.CandidateA.CandidateId;
        fixture.DuplicateCase.ResolutionIdempotencyKey = "resolve-1";
        _duplicates.Setup(x => x.GetByIdForUpdateAsync(
                fixture.DuplicateCase.DuplicateCaseId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(fixture.DuplicateCase);

        var response = await CreateHandler().Handle(CreateCommand(fixture), CancellationToken.None);

        response.IdempotentReplay.Should().BeTrue();
        response.Status.Should().Be("MERGED");
        _candidates.Verify(x => x.Update(It.IsAny<Candidate>()), Times.Never);
        _unitOfWork.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Dismiss_ReturnsAllHeldSubmissionsForFinalization()
    {
        var fixture = CreateFixture();
        var heldA = CreateHeldSubmission(fixture.CandidateA, fixture.Job, DateTime.UtcNow.AddMinutes(-2));
        var heldB = CreateHeldSubmission(fixture.CandidateB, fixture.Job, DateTime.UtcNow.AddMinutes(-1));
        _duplicates.Setup(x => x.GetByIdForUpdateAsync(
                fixture.DuplicateCase.DuplicateCaseId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(fixture.DuplicateCase);
        _duplicates.Setup(x => x.GetRelatedSubmissionsForUpdateAsync(
                fixture.CandidateA.CandidateId,
                fixture.CandidateB.CandidateId,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync([heldA, heldB]);

        var response = await CreateHandler().Handle(
            CreateCommand(fixture) with { Decision = "DISMISS" }, CancellationToken.None);

        response.Status.Should().Be("DISMISSED");
        response.Resolution.Should().Be("NOT_DUPLICATE");
        response.PendingFinalizationSubmissionIds.Should().BeEquivalentTo(
            new[] { heldA.SubmissionId, heldB.SubmissionId });
    }

    [Fact]
    public void Validator_RejectsUnsupportedDecisionAndIncompleteSafetyFields()
    {
        var validator = new ResolveCandidateDuplicateCaseCommandValidator();
        var command = new ResolveCandidateDuplicateCaseCommand(
            Guid.Empty, Guid.Empty, "AUTO_MERGE", "short", Guid.Empty, "");

        var result = validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.DuplicateCaseId);
        result.ShouldHaveValidationErrorFor(x => x.AdminUserId);
        result.ShouldHaveValidationErrorFor(x => x.Decision);
        result.ShouldHaveValidationErrorFor(x => x.Reason);
        result.ShouldHaveValidationErrorFor(x => x.ConcurrencyToken);
        result.ShouldHaveValidationErrorFor(x => x.IdempotencyKey);
    }

    private ResolveCandidateDuplicateCaseCommandHandler CreateHandler() => new(
        _duplicates.Object,
        _candidates.Object,
        _submissions.Object,
        _applications.Object,
        _attributions.Object,
        _notifications.Object,
        _audit.Object,
        _unitOfWork.Object);

    private void SetupLocks(
        Fixture fixture,
        IReadOnlyList<Submission> submissions,
        IReadOnlyList<HRConnect.Domain.Entities.Application> applications)
    {
        _duplicates.Setup(x => x.GetByIdForUpdateAsync(
                fixture.DuplicateCase.DuplicateCaseId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(fixture.DuplicateCase);
        _duplicates.Setup(x => x.GetCandidatesForUpdateAsync(
                fixture.CandidateA.CandidateId,
                fixture.CandidateB.CandidateId,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync([fixture.CandidateA, fixture.CandidateB]);
        _duplicates.Setup(x => x.GetRelatedSubmissionsForUpdateAsync(
                fixture.CandidateA.CandidateId,
                fixture.CandidateB.CandidateId,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(submissions);
        _duplicates.Setup(x => x.GetCandidateApplicationsForUpdateAsync(
                fixture.CandidateA.CandidateId,
                fixture.CandidateB.CandidateId,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(applications);
    }

    private static ResolveCandidateDuplicateCaseCommand CreateCommand(Fixture fixture) => new(
        fixture.DuplicateCase.DuplicateCaseId,
        Guid.NewGuid(),
        "MERGE",
        "Đã đối chiếu đủ bằng chứng danh tính.",
        fixture.DuplicateCase.ConcurrencyToken,
        "resolve-1");

    private static Submission CreateHeldSubmission(Candidate candidate, Job job, DateTime respondedAt)
    {
        var submission = new Submission
        {
            SubmissionId = Guid.NewGuid(),
            CandidateId = candidate.CandidateId,
            Candidate = candidate,
            JobId = job.JobId,
            Job = job,
            CvId = Guid.NewGuid(),
            SubmittedBy = Guid.NewGuid(),
            Source = "AFFILIATE",
            Status = "PENDING_IDENTITY_REVIEW",
            SubmittedAt = respondedAt.AddMinutes(-10),
            UpdatedAt = respondedAt
        };
        submission.Consent = new SubmissionConsent
        {
            SubmissionId = submission.SubmissionId,
            Submission = submission,
            Status = "CONFIRMED",
            RespondedAt = respondedAt
        };
        return submission;
    }

    private static HRConnect.Domain.Entities.Application CreateApplication(Submission submission) => new()
    {
        ApplicationId = Guid.NewGuid(),
        CandidateId = submission.CandidateId,
        JobId = submission.JobId,
        AcceptedSubmissionId = submission.SubmissionId,
        Status = "SUBMITTED",
        CurrentStage = "SUBMITTED",
        AppliedAt = submission.SubmittedAt,
        UpdatedAt = submission.SubmittedAt
    };

    private static Attribution CreateAttribution(
        HRConnect.Domain.Entities.Application application,
        Submission submission) => new()
    {
        AttributionId = Guid.NewGuid(),
        ApplicationId = application.ApplicationId,
        AffiliateId = Guid.NewGuid(),
        WinningSubmissionId = submission.SubmissionId,
        WinningSubmission = submission,
        AttributionRule = "CANDIDATE_CONSENT_THEN_FIRST_ACCEPTED",
        Status = "ACTIVE",
        EstablishedAt = submission.SubmittedAt,
        UpdatedAt = submission.SubmittedAt
    };

    private static Fixture CreateFixture()
    {
        var company = new Company { CompanyId = Guid.NewGuid(), CompanyName = "Example Co" };
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            CompanyId = company.CompanyId,
            Company = company,
            Title = "Backend Developer",
            Status = "ACTIVE"
        };
        var first = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            FullName = "Candidate A",
            Status = "ACTIVE",
            ProfileVisibility = "PRIVATE",
            CreatedAt = DateTime.UtcNow.AddDays(-2)
        };
        var second = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            FullName = "Candidate B",
            Status = "ACTIVE",
            ProfileVisibility = "PRIVATE",
            CreatedAt = DateTime.UtcNow.AddDays(-1)
        };
        var ordered = string.CompareOrdinal(first.CandidateId.ToString("N"), second.CandidateId.ToString("N")) <= 0
            ? (first, second)
            : (second, first);
        var duplicateCase = new CandidateDuplicateCase
        {
            DuplicateCaseId = Guid.NewGuid(),
            CandidateAId = ordered.Item1.CandidateId,
            CandidateA = ordered.Item1,
            CandidateBId = ordered.Item2.CandidateId,
            CandidateB = ordered.Item2,
            JobId = job.JobId,
            Job = job,
            RiskLevel = "HIGH",
            Status = "AWAITING_CANDIDATE",
            ConcurrencyToken = Guid.NewGuid(),
            IdempotencyKey = Guid.NewGuid().ToString("N"),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        return new Fixture(ordered.Item1, ordered.Item2, job, duplicateCase);
    }

    private sealed record Fixture(
        Candidate CandidateA,
        Candidate CandidateB,
        Job Job,
        CandidateDuplicateCase DuplicateCase);
}
