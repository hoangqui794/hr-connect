using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.CandidateDuplicates.Finalization;
using HRConnect.Domain.Entities;
using Moq;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.CandidateDuplicates;

public sealed class FinalizeIdentityReviewedSubmissionServiceTests
{
    private readonly Mock<ISubmissionRepository> _submissions = new();
    private readonly Mock<IApplicationRepository> _applications = new();
    private readonly Mock<IAffiliateProfileRepository> _affiliates = new();
    private readonly Mock<IAttributionRepository> _attributions = new();
    private readonly Mock<IFinanceRepository> _finance = new();
    private readonly Mock<INotificationRepository> _notifications = new();
    private readonly Mock<IMf03ScoringTrigger> _scoring = new();
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<ICandidateCompanyTransactionLock> _candidateCompanyLock = new();
    private readonly Mock<IAdminBusinessSettings> _businessSettings = new();

    [Fact]
    public async Task Finalize_EligibleHeldSubmission_CreatesApplicationAttributionAndScoringOnce()
    {
        var submission = CreateHeldSubmission();
        SetupNoExistingApplication(submission);
        _affiliates.Setup(x => x.GetByUserIdWithDetailsAsync(
                submission.SubmittedBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateEligibleAffiliate(submission.SubmittedBy));
        JobApplication? createdApplication = null;
        _applications.Setup(x => x.AddAsync(It.IsAny<JobApplication>(), It.IsAny<CancellationToken>()))
            .Callback<JobApplication, CancellationToken>((application, _) => createdApplication = application)
            .Returns(Task.CompletedTask);

        var result = await CreateService().FinalizeAsync(
            submission, Guid.NewGuid(), Guid.NewGuid(), DateTime.UtcNow, CancellationToken.None);

        result.Status.Should().Be("ACCEPTED");
        result.ApplicationId.Should().Be(createdApplication!.ApplicationId);
        result.AiStatus.Should().Be("PENDING");
        submission.Status.Should().Be("ACCEPTED");
        _unitOfWork.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _attributions.Verify(x => x.AddAsync(It.Is<Attribution>(attribution =>
            attribution.ApplicationId == createdApplication.ApplicationId &&
            attribution.WinningSubmissionId == submission.SubmissionId &&
            attribution.AttributionRule == "EARLIEST_CANDIDATE_CONFIRMED_VALID_SUBMISSION"),
            It.IsAny<CancellationToken>()), Times.Once);
        _scoring.Verify(x => x.TriggerScoringAsync(It.Is<Mf03TriggerPayload>(payload =>
            payload.ApplicationId == createdApplication.ApplicationId &&
            payload.CvId == submission.CvId), It.IsAny<CancellationToken>()), Times.Once);
        _audit.Verify(x => x.AddAsync(It.Is<AuditEntry>(entry =>
            entry.Action == AuditActions.SubmissionIdentityReviewFinalized &&
            entry.EntityId == submission.SubmissionId), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Finalize_WhenAlreadyAccepted_ReturnsReplayWithoutCreatingSideEffects()
    {
        var submission = CreateHeldSubmission();
        submission.Status = "ACCEPTED";
        var existing = new JobApplication
        {
            ApplicationId = Guid.NewGuid(),
            CandidateId = submission.CandidateId,
            JobId = submission.JobId,
            AcceptedSubmissionId = submission.SubmissionId,
            Status = "SUBMITTED"
        };
        _applications.Setup(x => x.GetByCandidateAndJobAsync(
                submission.CandidateId, submission.JobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);

        var result = await CreateService().FinalizeAsync(
            submission, Guid.NewGuid(), Guid.NewGuid(), DateTime.UtcNow, CancellationToken.None);

        result.Status.Should().Be("ALREADY_FINALIZED");
        result.ApplicationId.Should().Be(existing.ApplicationId);
        _applications.Verify(x => x.AddAsync(It.IsAny<JobApplication>(), It.IsAny<CancellationToken>()), Times.Never);
        _attributions.Verify(x => x.AddAsync(It.IsAny<Attribution>(), It.IsAny<CancellationToken>()), Times.Never);
        _scoring.Verify(x => x.TriggerScoringAsync(It.IsAny<Mf03TriggerPayload>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Finalize_WhenAffiliateIsNotEligible_ClosesSubmissionWithoutDownstreamWork()
    {
        var submission = CreateHeldSubmission();
        SetupNoExistingApplication(submission);
        _affiliates.Setup(x => x.GetByUserIdWithDetailsAsync(
                submission.SubmittedBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AffiliateProfile?)null);

        var result = await CreateService().FinalizeAsync(
            submission, Guid.NewGuid(), Guid.NewGuid(), DateTime.UtcNow, CancellationToken.None);

        result.Status.Should().Be("CANCELLED");
        result.ReasonCode.Should().Be("AFFILIATE_NOT_ELIGIBLE");
        submission.Status.Should().Be("CANCELLED");
        _submissions.Verify(x => x.Update(submission), Times.Once);
        _applications.Verify(x => x.AddAsync(It.IsAny<JobApplication>(), It.IsAny<CancellationToken>()), Times.Never);
        _scoring.Verify(x => x.TriggerScoringAsync(It.IsAny<Mf03TriggerPayload>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Finalize_WhenApplicationAlreadyExists_BlocksDuplicateDeterministically()
    {
        var submission = CreateHeldSubmission();
        var existing = new JobApplication
        {
            ApplicationId = Guid.NewGuid(),
            CandidateId = submission.CandidateId,
            JobId = submission.JobId,
            AcceptedSubmissionId = Guid.NewGuid(),
            Status = "SUBMITTED"
        };
        _applications.Setup(x => x.GetByCandidateAndJobAsync(
                submission.CandidateId, submission.JobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);
        _submissions.Setup(x => x.GetAcceptedSubmissionAsync(
                submission.CandidateId, submission.JobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Submission?)null);
        _affiliates.Setup(x => x.GetByUserIdWithDetailsAsync(
                submission.SubmittedBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateEligibleAffiliate(submission.SubmittedBy));

        var result = await CreateService().FinalizeAsync(
            submission, Guid.NewGuid(), Guid.NewGuid(), DateTime.UtcNow, CancellationToken.None);

        result.Status.Should().Be("BLOCKED_DUPLICATE");
        result.ReasonCode.Should().Be("CANDIDATE_ALREADY_SUBMITTED");
        submission.DuplicateOfSubmissionId.Should().Be(existing.AcceptedSubmissionId);
        _applications.Verify(x => x.AddAsync(It.IsAny<JobApplication>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private FinalizeIdentityReviewedSubmissionService CreateService() => new(
        _submissions.Object,
        _applications.Object,
        _affiliates.Object,
        _attributions.Object,
        _finance.Object,
        _notifications.Object,
        _scoring.Object,
        _audit.Object,
        _unitOfWork.Object,
        _candidateCompanyLock.Object,
        _businessSettings.Object);

    private void SetupNoExistingApplication(Submission submission)
    {
        _applications.Setup(x => x.GetByCandidateAndJobAsync(
                submission.CandidateId, submission.JobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((JobApplication?)null);
        _submissions.Setup(x => x.GetAcceptedSubmissionAsync(
                submission.CandidateId, submission.JobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Submission?)null);
    }

    private static Submission CreateHeldSubmission()
    {
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            FullName = "Candidate",
            Status = "ACTIVE",
            ProfileVisibility = "PRIVATE"
        };
        var company = new Company { CompanyId = Guid.NewGuid(), CompanyName = "Example Co" };
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            CompanyId = company.CompanyId,
            Company = company,
            Title = "Backend Developer",
            Status = "ACTIVE"
        };
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
            SubmittedAt = DateTime.UtcNow.AddMinutes(-5),
            UpdatedAt = DateTime.UtcNow.AddMinutes(-5)
        };
        submission.Consent = new SubmissionConsent
        {
            SubmissionId = submission.SubmissionId,
            Submission = submission,
            Status = "CONFIRMED",
            RespondedAt = DateTime.UtcNow.AddMinutes(-4)
        };
        return submission;
    }

    private static AffiliateProfile CreateEligibleAffiliate(Guid userId)
    {
        var role = new Role
        {
            RoleId = Guid.NewGuid(),
            Code = "AFFILIATE",
            Name = "Affiliate",
            IsActive = true
        };
        var user = new AppUser
        {
            UserId = userId,
            Email = "affiliate@example.com",
            PasswordHash = "hash",
            Status = "ACTIVE"
        };
        user.UserRoleUsers.Add(new UserRole
        {
            UserId = userId,
            RoleId = role.RoleId,
            User = user,
            Role = role,
            Status = "ACTIVE",
            AssignmentSource = "ADMIN"
        });
        return new AffiliateProfile
        {
            AffiliateId = Guid.NewGuid(),
            UserId = userId,
            User = user,
            Status = "ACTIVE"
        };
    }
}
