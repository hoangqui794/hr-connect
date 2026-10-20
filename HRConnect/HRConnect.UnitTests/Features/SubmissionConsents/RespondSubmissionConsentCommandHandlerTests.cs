using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.SubmissionConsents.RespondSubmissionConsent;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.SubmissionConsents;

public sealed class RespondSubmissionConsentCommandHandlerTests
{
    private readonly Mock<ISubmissionConsentRepository> _consents = new();
    private readonly Mock<ISubmissionRepository> _submissions = new();
    private readonly Mock<IApplicationRepository> _applications = new();
    private readonly Mock<IAffiliateProfileRepository> _affiliates = new();
    private readonly Mock<IAttributionRepository> _attributions = new();
    private readonly Mock<IFinanceRepository> _finance = new();
    private readonly Mock<ICandidateCvRepository> _cvs = new();
    private readonly Mock<INotificationRepository> _notifications = new();
    private readonly Mock<IMf03ScoringTrigger> _scoring = new();
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<ICandidateCompanyTransactionLock> _candidateCompanyLock = new();
    private readonly Mock<IAdminBusinessSettings> _businessSettings = new();
    private readonly Mock<ICandidateDuplicateRepository> _duplicates = new();

    public RespondSubmissionConsentCommandHandlerTests()
    {
        _businessSettings.Setup(settings => settings.GetIntAsync(
                BusinessSettingKeys.Mf02ClientOwnershipDays,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(30);
    }

    [Fact]
    public async Task Confirm_CreatesApplicationAttributionAndMf03Work()
    {
        var fixture = CreateConsent();
        fixture.Submission.ReplacementSlotId = Guid.NewGuid();
        _finance.Setup(x => x.GetReplacementSlotForConsentForUpdateAsync(
                fixture.Submission.ReplacementSlotId.Value, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ReplacementSlot
            {
                ReplacementSlotId = fixture.Submission.ReplacementSlotId.Value,
                JobId = fixture.Job.JobId,
                Status = ReplacementSlotStates.Open,
                ExpiresAt = DateTime.UtcNow.AddDays(10)
            });
        var persistenceOrder = new List<string>();
        _consents.Setup(x => x.GetByTokenHashAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(fixture.Consent);
        _submissions.Setup(x => x.GetAcceptedSubmissionAsync(fixture.Candidate.CandidateId, fixture.Job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync((Submission?)null);
        _applications.Setup(x => x.GetByCandidateAndJobAsync(fixture.Candidate.CandidateId, fixture.Job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync((JobApplication?)null);
        _affiliates.Setup(x => x.GetByUserIdWithDetailsAsync(fixture.Submission.SubmittedBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateEligibleAffiliate(fixture.Submission.SubmittedBy));

        JobApplication? created = null;
        _unitOfWork.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .Callback(() => persistenceOrder.Add("submission"))
            .ReturnsAsync(1);
        _applications.Setup(x => x.AddAsync(It.IsAny<JobApplication>(), It.IsAny<CancellationToken>()))
            .Callback<JobApplication, CancellationToken>((value, _) =>
            {
                persistenceOrder.Add("application");
                created = value;
            })
            .Returns(Task.CompletedTask);

        var response = await Handler().Handle(new RespondSubmissionConsentCommand
        {
            Token = "valid-token",
            Decision = "CONFIRM",
            AllowFutureReuse = true,
            RequesterUserId = fixture.Candidate.UserId
        }, CancellationToken.None);

        response.SubmissionStatus.Should().Be("ACCEPTED");
        response.ApplicationId.Should().Be(created!.ApplicationId);
        created.ReplacementSlotId.Should().Be(fixture.Submission.ReplacementSlotId);
        fixture.Consent.Status.Should().Be("CONFIRMED");
        fixture.Cv.Status.Should().Be("ACTIVE");
        fixture.Cv.AffiliateReuseStatus.Should().Be("ALLOWED");
        response.AffiliateReuseStatus.Should().Be("ALLOWED");
        _audit.Verify(x => x.AddAsync(It.Is<AuditEntry>(entry =>
            entry.Action == AuditActions.AffiliateCvReuseGranted &&
            entry.EntityId == fixture.Cv.CvId), It.IsAny<CancellationToken>()), Times.Once);
        _attributions.Verify(x => x.AddAsync(It.Is<Attribution>(a => a.WinningSubmissionId == fixture.Submission.SubmissionId), It.IsAny<CancellationToken>()), Times.Once);
        _scoring.Verify(x => x.TriggerScoringAsync(It.Is<Mf03TriggerPayload>(p => p.ApplicationId == created.ApplicationId), It.IsAny<CancellationToken>()), Times.Once);
        _notifications.Verify(x => x.AddAsync(It.Is<Notification>(notification =>
            notification.UserId == fixture.Submission.SubmittedBy &&
            notification.NotificationType == "SUBMISSION_CONSENT_RESULT" &&
            notification.RelatedEntityId == fixture.Submission.SubmissionId &&
            notification.Title.Contains("đồng ý")), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        persistenceOrder.Should().Equal("submission", "application");
    }

    [Fact]
    public async Task Confirm_WhenSameJobIdentityReviewIsActive_HoldsSubmissionWithoutDownstreamSideEffects()
    {
        var fixture = CreateConsent();
        SetupPendingConfirmation(fixture);
        _affiliates.Setup(x => x.GetByUserIdWithDetailsAsync(
                fixture.Submission.SubmittedBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateEligibleAffiliate(fixture.Submission.SubmittedBy));
        var duplicateCase = CreateActiveDuplicateCase(fixture);
        _duplicates.Setup(x => x.GetActiveSameJobCaseForSubmissionAsync(
                fixture.Submission.SubmissionId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(duplicateCase);

        var response = await Handler().Handle(new RespondSubmissionConsentCommand
        {
            Token = "valid-token",
            Decision = "CONFIRM",
            AllowFutureReuse = true,
            RequesterUserId = fixture.Candidate.UserId
        }, CancellationToken.None);

        response.SubmissionStatus.Should().Be("PENDING_IDENTITY_REVIEW");
        response.AiStatus.Should().Be("NOT_QUEUED");
        response.RequiresIdentityReview.Should().BeTrue();
        response.DuplicateCaseId.Should().Be(duplicateCase.DuplicateCaseId);
        fixture.Consent.Status.Should().Be("CONFIRMED");
        fixture.Submission.Status.Should().Be("PENDING_IDENTITY_REVIEW");
        fixture.Cv.Status.Should().Be("ACTIVE");
        fixture.Cv.AffiliateReuseStatus.Should().Be("ALLOWED");
        _applications.Verify(x => x.AddAsync(It.IsAny<JobApplication>(), It.IsAny<CancellationToken>()), Times.Never);
        _attributions.Verify(x => x.AddAsync(It.IsAny<Attribution>(), It.IsAny<CancellationToken>()), Times.Never);
        _scoring.Verify(x => x.TriggerScoringAsync(It.IsAny<Mf03TriggerPayload>(), It.IsAny<CancellationToken>()), Times.Never);
        _audit.Verify(x => x.AddAsync(It.Is<AuditEntry>(entry =>
            entry.Action == AuditActions.SubmissionIdentityReviewHeld &&
            entry.EntityId == fixture.Submission.SubmissionId &&
            entry.CorrelationId == duplicateCase.DuplicateCaseId), It.IsAny<CancellationToken>()), Times.Once);
        _notifications.Verify(x => x.AddAsync(It.Is<Notification>(notification =>
            notification.UserId == fixture.Submission.SubmittedBy &&
            notification.Title.Contains("đối chiếu")), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Confirm_WhenHeldConsentIsRetried_ReturnsSameIdentityReviewWithoutNewWrites()
    {
        var fixture = CreateConsent();
        fixture.Consent.Status = "CONFIRMED";
        fixture.Submission.Status = "PENDING_IDENTITY_REVIEW";
        var duplicateCase = CreateActiveDuplicateCase(fixture);
        _consents.Setup(x => x.GetByTokenHashAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(fixture.Consent);
        _duplicates.Setup(x => x.GetActiveSameJobCaseForSubmissionAsync(
                fixture.Submission.SubmissionId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(duplicateCase);

        var response = await Handler().Handle(new RespondSubmissionConsentCommand
        {
            Token = "valid-token",
            Decision = "CONFIRM",
            RequesterUserId = fixture.Candidate.UserId
        }, CancellationToken.None);

        response.SubmissionStatus.Should().Be("PENDING_IDENTITY_REVIEW");
        response.AiStatus.Should().Be("NOT_QUEUED");
        response.RequiresIdentityReview.Should().BeTrue();
        response.DuplicateCaseId.Should().Be(duplicateCase.DuplicateCaseId);
        _applications.Verify(x => x.AddAsync(It.IsAny<JobApplication>(), It.IsAny<CancellationToken>()), Times.Never);
        _unitOfWork.Verify(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
        _unitOfWork.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData(ReplacementSlotStates.Filled, false)]
    [InlineData(ReplacementSlotStates.Cancelled, false)]
    [InlineData(ReplacementSlotStates.Expired, false)]
    [InlineData(ReplacementSlotStates.Open, true)]
    public async Task Confirm_WhenReplacementSlotIsUnavailable_ClosesSubmissionAndCreatesNoSideEffects(
        string slotStatus,
        bool deadlinePassed)
    {
        var fixture = CreateConsent();
        fixture.Submission.ReplacementSlotId = Guid.NewGuid();
        SetupPendingConfirmation(fixture);
        _affiliates.Setup(x => x.GetByUserIdWithDetailsAsync(
                fixture.Submission.SubmittedBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateEligibleAffiliate(fixture.Submission.SubmittedBy));
        _finance.Setup(x => x.GetReplacementSlotForConsentForUpdateAsync(
                fixture.Submission.ReplacementSlotId.Value, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ReplacementSlot
            {
                ReplacementSlotId = fixture.Submission.ReplacementSlotId.Value,
                JobId = fixture.Job.JobId,
                Status = slotStatus,
                ExpiresAt = deadlinePassed ? DateTime.UtcNow.AddMinutes(-1) : DateTime.UtcNow.AddDays(10)
            });

        var action = () => Handler().Handle(new RespondSubmissionConsentCommand
        {
            Token = "valid-token",
            Decision = "CONFIRM",
            RequesterUserId = fixture.Candidate.UserId
        }, CancellationToken.None);

        var conflict = await action.Should().ThrowAsync<ConflictException>();
        conflict.Which.ErrorCode.Should().Be(ReplacementSlotErrorCodes.Unavailable);
        conflict.Which.Details.Should().ContainKey("replacementSlotId")
            .WhoseValue.Should().Be(fixture.Submission.ReplacementSlotId);
        fixture.Consent.Status.Should().Be("CANCELLED");
        fixture.Submission.Status.Should().Be("CANCELLED");
        fixture.Cv.Status.Should().Be("ARCHIVED");
        _applications.Verify(x => x.AddAsync(It.IsAny<JobApplication>(), It.IsAny<CancellationToken>()), Times.Never);
        _attributions.Verify(x => x.AddAsync(It.IsAny<Attribution>(), It.IsAny<CancellationToken>()), Times.Never);
        _scoring.Verify(x => x.TriggerScoringAsync(It.IsAny<Mf03TriggerPayload>(), It.IsAny<CancellationToken>()), Times.Never);
        _notifications.Verify(x => x.AddAsync(It.Is<Notification>(notification =>
            notification.UserId == fixture.Submission.SubmittedBy &&
            notification.Title.Contains("thay thế")), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(x => x.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Decline_ClosesSubmissionWithoutApplicationOrMf03()
    {
        var fixture = CreateConsent(candidateHasAccount: false);
        _consents.Setup(x => x.GetByTokenHashAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(fixture.Consent);

        var response = await Handler().Handle(new RespondSubmissionConsentCommand
        {
            Token = "valid-token",
            Decision = "DECLINE"
        }, CancellationToken.None);

        response.SubmissionStatus.Should().Be("CONSENT_REJECTED");
        fixture.Consent.Status.Should().Be("DECLINED");
        fixture.Cv.Status.Should().Be("ARCHIVED");
        _applications.Verify(x => x.AddAsync(It.IsAny<JobApplication>(), It.IsAny<CancellationToken>()), Times.Never);
        _scoring.Verify(x => x.TriggerScoringAsync(It.IsAny<Mf03TriggerPayload>(), It.IsAny<CancellationToken>()), Times.Never);
        _notifications.Verify(x => x.AddAsync(It.Is<Notification>(notification =>
            notification.UserId == fixture.Submission.SubmittedBy &&
            notification.NotificationType == "SUBMISSION_CONSENT_RESULT" &&
            notification.Title.Contains("từ chối")), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Confirm_WhenConsentExpired_NotifiesAffiliateAndDoesNotCreateApplication()
    {
        var fixture = CreateConsent(candidateHasAccount: false);
        fixture.Consent.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
        _consents.Setup(x => x.GetByTokenHashAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(fixture.Consent);

        var action = () => Handler().Handle(new RespondSubmissionConsentCommand
        {
            Token = "valid-token",
            Decision = "CONFIRM"
        }, CancellationToken.None);

        await action.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*đã hết hạn*");
        fixture.Consent.Status.Should().Be("EXPIRED");
        fixture.Submission.Status.Should().Be("CONSENT_EXPIRED");
        _notifications.Verify(x => x.AddAsync(It.Is<Notification>(notification =>
            notification.UserId == fixture.Submission.SubmittedBy &&
            notification.NotificationType == "SUBMISSION_CONSENT_RESULT" &&
            notification.Title.Contains("hết hạn")), It.IsAny<CancellationToken>()), Times.Once);
        _applications.Verify(x => x.AddAsync(It.IsAny<JobApplication>(), It.IsAny<CancellationToken>()), Times.Never);
        _scoring.Verify(x => x.TriggerScoringAsync(It.IsAny<Mf03TriggerPayload>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ExistingCandidateAccount_RequiresMatchingAuthenticatedUser()
    {
        var fixture = CreateConsent();
        _consents.Setup(x => x.GetByTokenHashAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(fixture.Consent);

        var action = () => Handler().Handle(new RespondSubmissionConsentCommand
        {
            Token = "valid-token",
            Decision = "CONFIRM",
            RequesterUserId = Guid.NewGuid()
        }, CancellationToken.None);

        await action.Should().ThrowAsync<ForbiddenException>();
        _applications.Verify(x => x.AddAsync(It.IsAny<JobApplication>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task AuthenticatedCandidate_UsesSubmissionIdWithoutEmailToken()
    {
        var fixture = CreateConsent();
        _consents.Setup(x => x.GetBySubmissionIdAsync(fixture.Submission.SubmissionId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(fixture.Consent);
        _submissions.Setup(x => x.GetAcceptedSubmissionAsync(fixture.Candidate.CandidateId, fixture.Job.JobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Submission?)null);
        _applications.Setup(x => x.GetByCandidateAndJobAsync(fixture.Candidate.CandidateId, fixture.Job.JobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((JobApplication?)null);
        _affiliates.Setup(x => x.GetByUserIdWithDetailsAsync(fixture.Submission.SubmittedBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateEligibleAffiliate(fixture.Submission.SubmittedBy));
        _applications.Setup(x => x.AddAsync(It.IsAny<JobApplication>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var response = await Handler().Handle(new RespondSubmissionConsentCommand
        {
            SubmissionId = fixture.Submission.SubmissionId,
            Decision = "CONFIRM",
            RequesterUserId = fixture.Candidate.UserId
        }, CancellationToken.None);

        response.SubmissionStatus.Should().Be("ACCEPTED");
        _consents.Verify(x => x.GetBySubmissionIdAsync(fixture.Submission.SubmissionId, It.IsAny<CancellationToken>()), Times.Once);
        _consents.Verify(x => x.GetByTokenHashAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("SUSPENDED")]
    public async Task Confirm_WhenAffiliateIsMissingOrInactive_CancelsSubmission(string? affiliateStatus)
    {
        var fixture = CreateConsent();
        _consents.Setup(x => x.GetByTokenHashAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(fixture.Consent);
        _submissions.Setup(x => x.GetAcceptedSubmissionAsync(fixture.Candidate.CandidateId, fixture.Job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync((Submission?)null);
        _applications.Setup(x => x.GetByCandidateAndJobAsync(fixture.Candidate.CandidateId, fixture.Job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync((JobApplication?)null);
        _affiliates.Setup(x => x.GetByUserIdWithDetailsAsync(fixture.Submission.SubmittedBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(affiliateStatus == null
                ? null
                : CreateEligibleAffiliate(fixture.Submission.SubmittedBy, profileStatus: affiliateStatus));

        var action = () => Handler().Handle(new RespondSubmissionConsentCommand
        {
            Token = "valid-token",
            Decision = "CONFIRM",
            RequesterUserId = fixture.Candidate.UserId
        }, CancellationToken.None);

        await action.Should().ThrowAsync<ConflictException>()
            .WithMessage("Affiliate đã bị khóa, chưa được phê duyệt hoặc không còn hoạt động*");
        fixture.Consent.Status.Should().Be("CANCELLED");
        fixture.Submission.Status.Should().Be("CANCELLED");
        fixture.Cv.Status.Should().Be("ARCHIVED");
        _applications.Verify(x => x.AddAsync(It.IsAny<JobApplication>(), It.IsAny<CancellationToken>()), Times.Never);
        _attributions.Verify(x => x.AddAsync(It.IsAny<Attribution>(), It.IsAny<CancellationToken>()), Times.Never);
        _scoring.Verify(x => x.TriggerScoringAsync(It.IsAny<Mf03TriggerPayload>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Confirm_WhenAffiliateAppUserIsSuspended_CancelsSubmission()
    {
        var fixture = CreateConsent();
        SetupPendingConfirmation(fixture);
        _affiliates.Setup(x => x.GetByUserIdWithDetailsAsync(fixture.Submission.SubmittedBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateEligibleAffiliate(fixture.Submission.SubmittedBy, userStatus: "SUSPENDED"));

        var action = () => Handler().Handle(new RespondSubmissionConsentCommand
        {
            Token = "valid-token",
            Decision = "CONFIRM",
            RequesterUserId = fixture.Candidate.UserId
        }, CancellationToken.None);

        await AssertAffiliateRejectedAsync(action, fixture);
    }

    [Theory]
    [InlineData("REVOKED", true)]
    [InlineData("ACTIVE", false)]
    public async Task Confirm_WhenAffiliateRoleIsNotActive_CancelsSubmission(string assignmentStatus, bool roleIsActive)
    {
        var fixture = CreateConsent();
        SetupPendingConfirmation(fixture);
        _affiliates.Setup(x => x.GetByUserIdWithDetailsAsync(fixture.Submission.SubmittedBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateEligibleAffiliate(
                fixture.Submission.SubmittedBy,
                assignmentStatus: assignmentStatus,
                roleIsActive: roleIsActive));

        var action = () => Handler().Handle(new RespondSubmissionConsentCommand
        {
            Token = "valid-token",
            Decision = "CONFIRM",
            RequesterUserId = fixture.Candidate.UserId
        }, CancellationToken.None);

        await AssertAffiliateRejectedAsync(action, fixture);
    }

    [Theory]
    [InlineData("ARCHIVED", false)]
    [InlineData("ACTIVE", true)]
    public async Task Confirm_WhenCandidateIsNotEligible_CancelsSubmission(string status, bool merged)
    {
        var fixture = CreateConsent();
        fixture.Candidate.Status = status;
        fixture.Candidate.MergedIntoCandidateId = merged ? Guid.NewGuid() : null;
        _consents.Setup(x => x.GetByTokenHashAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(fixture.Consent);

        var action = () => Handler().Handle(new RespondSubmissionConsentCommand
        {
            Token = "valid-token",
            Decision = "CONFIRM",
            RequesterUserId = fixture.Candidate.UserId
        }, CancellationToken.None);

        await action.Should().ThrowAsync<ConflictException>()
            .WithMessage("Hồ sơ Candidate đã bị khóa, lưu trữ hoặc hợp nhất*");
        fixture.Consent.Status.Should().Be("CANCELLED");
        fixture.Submission.Status.Should().Be("CANCELLED");
        fixture.Cv.Status.Should().Be("ARCHIVED");
        _affiliates.Verify(x => x.GetByUserIdWithDetailsAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        _applications.Verify(x => x.AddAsync(It.IsAny<JobApplication>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Confirm_WithoutReuseChoice_PreservesCurrentReuseStatus()
    {
        var fixture = CreateConsent();
        fixture.Cv.AffiliateReuseStatus = "ALLOWED";
        var originalToken = fixture.Cv.AffiliateReuseConcurrencyToken;
        SetupPendingConfirmation(fixture);
        _affiliates.Setup(x => x.GetByUserIdWithDetailsAsync(
                fixture.Submission.SubmittedBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateEligibleAffiliate(fixture.Submission.SubmittedBy));
        _applications.Setup(x => x.AddAsync(It.IsAny<JobApplication>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var response = await Handler().Handle(new RespondSubmissionConsentCommand
        {
            Token = "valid-token",
            Decision = "CONFIRM",
            RequesterUserId = fixture.Candidate.UserId
        }, CancellationToken.None);

        response.AffiliateReuseStatus.Should().Be("ALLOWED");
        fixture.Cv.AffiliateReuseConcurrencyToken.Should().Be(originalToken);
        _audit.Verify(x => x.AddAsync(It.Is<AuditEntry>(entry =>
            entry.Action == AuditActions.AffiliateCvReuseGranted ||
            entry.Action == AuditActions.AffiliateCvReuseRevoked), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Confirm_WhenFutureReuseIsExplicitlyDisabled_RevokesExistingGrant()
    {
        var fixture = CreateConsent();
        fixture.Cv.AffiliateReuseStatus = "ALLOWED";
        var originalToken = fixture.Cv.AffiliateReuseConcurrencyToken;
        SetupPendingConfirmation(fixture);
        _affiliates.Setup(x => x.GetByUserIdWithDetailsAsync(
                fixture.Submission.SubmittedBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateEligibleAffiliate(fixture.Submission.SubmittedBy));
        _applications.Setup(x => x.AddAsync(It.IsAny<JobApplication>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var response = await Handler().Handle(new RespondSubmissionConsentCommand
        {
            Token = "valid-token",
            Decision = "CONFIRM",
            AllowFutureReuse = false,
            RequesterUserId = fixture.Candidate.UserId
        }, CancellationToken.None);

        response.AffiliateReuseStatus.Should().Be("REVOKED");
        fixture.Cv.AffiliateReuseConcurrencyToken.Should().NotBe(originalToken);
        _audit.Verify(x => x.AddAsync(It.Is<AuditEntry>(entry =>
            entry.Action == AuditActions.AffiliateCvReuseRevoked &&
            entry.EntityId == fixture.Cv.CvId), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Confirm_WhenCandidateIsOwnedByClient_BlocksBeforeCreatingApplication()
    {
        var fixture = CreateConsent(serviceCode: "HEADHUNT_COD");
        SetupPendingConfirmation(fixture);
        _affiliates.Setup(x => x.GetByUserIdWithDetailsAsync(
                fixture.Submission.SubmittedBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateEligibleAffiliate(fixture.Submission.SubmittedBy));
        _applications.Setup(x => x.ExistsForCandidateAndCompanySinceAsync(
                fixture.Candidate.CandidateId,
                fixture.Job.CompanyId,
                It.Is<DateTime>(since => since >= DateTime.UtcNow.AddDays(-30).AddMinutes(-1)),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var action = () => Handler().Handle(new RespondSubmissionConsentCommand
        {
            Token = "valid-token",
            Decision = "CONFIRM",
            RequesterUserId = fixture.Candidate.UserId
        }, CancellationToken.None);

        var conflict = await action.Should().ThrowAsync<ConflictException>();
        conflict.Which.ErrorCode.Should().Be("CANDIDATE_OWNED_BY_CLIENT");
        conflict.Which.Details.Should().ContainKey("ownershipDays").WhoseValue.Should().Be(30);
        fixture.Consent.Status.Should().Be("CANCELLED");
        fixture.Submission.Status.Should().Be("BLOCKED_CLIENT_OWNED");
        fixture.Cv.Status.Should().Be("ARCHIVED");
        _candidateCompanyLock.Verify(x => x.AcquireAsync(
            fixture.Candidate.CandidateId, fixture.Job.CompanyId, It.IsAny<CancellationToken>()), Times.Once);
        _applications.Verify(x => x.AddAsync(It.IsAny<JobApplication>(), It.IsAny<CancellationToken>()), Times.Never);
        _attributions.Verify(x => x.AddAsync(It.IsAny<Attribution>(), It.IsAny<CancellationToken>()), Times.Never);
        _scoring.Verify(x => x.TriggerScoringAsync(It.IsAny<Mf03TriggerPayload>(), It.IsAny<CancellationToken>()), Times.Never);
        _unitOfWork.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(x => x.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    private void SetupPendingConfirmation(Fixture fixture)
    {
        _consents.Setup(x => x.GetByTokenHashAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(fixture.Consent);
        _submissions.Setup(x => x.GetAcceptedSubmissionAsync(
                fixture.Candidate.CandidateId, fixture.Job.JobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Submission?)null);
        _applications.Setup(x => x.GetByCandidateAndJobAsync(
                fixture.Candidate.CandidateId, fixture.Job.JobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((JobApplication?)null);
    }

    private async Task AssertAffiliateRejectedAsync(Func<Task> action, Fixture fixture)
    {
        await action.Should().ThrowAsync<ConflictException>()
            .WithMessage("Affiliate đã bị khóa, chưa được phê duyệt hoặc không còn hoạt động*");
        fixture.Consent.Status.Should().Be("CANCELLED");
        fixture.Submission.Status.Should().Be("CANCELLED");
        fixture.Cv.Status.Should().Be("ARCHIVED");
        _applications.Verify(x => x.AddAsync(It.IsAny<JobApplication>(), It.IsAny<CancellationToken>()), Times.Never);
        _attributions.Verify(x => x.AddAsync(It.IsAny<Attribution>(), It.IsAny<CancellationToken>()), Times.Never);
        _scoring.Verify(x => x.TriggerScoringAsync(It.IsAny<Mf03TriggerPayload>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private static AffiliateProfile CreateEligibleAffiliate(
        Guid userId,
        string profileStatus = "ACTIVE",
        string userStatus = "ACTIVE",
        string assignmentStatus = "ACTIVE",
        bool roleIsActive = true)
    {
        var role = new Role
        {
            RoleId = Guid.NewGuid(),
            Code = "AFFILIATE_RECRUITER",
            Name = "Affiliate Recruiter",
            IsActive = roleIsActive
        };
        var user = new AppUser
        {
            UserId = userId,
            Email = "affiliate@example.com",
            PasswordHash = "hash",
            Status = userStatus
        };
        user.UserRoleUsers.Add(new UserRole
        {
            UserId = userId,
            RoleId = role.RoleId,
            User = user,
            Role = role,
            Status = assignmentStatus,
            AssignmentSource = "ADMIN"
        });
        return new AffiliateProfile
        {
            AffiliateId = Guid.NewGuid(),
            UserId = userId,
            Status = profileStatus,
            User = user
        };
    }

    private RespondSubmissionConsentCommandHandler Handler() => new(
        _consents.Object,
        _submissions.Object,
        _applications.Object,
        _affiliates.Object,
        _attributions.Object,
        _finance.Object,
        _cvs.Object,
        _notifications.Object,
        _scoring.Object,
        _audit.Object,
        _unitOfWork.Object,
        Mock.Of<ILogger<RespondSubmissionConsentCommandHandler>>(),
        _candidateCompanyLock.Object,
        _businessSettings.Object,
        _duplicates.Object);

    private static CandidateDuplicateCase CreateActiveDuplicateCase(Fixture fixture) => new()
    {
        DuplicateCaseId = Guid.NewGuid(),
        CandidateAId = fixture.Candidate.CandidateId,
        CandidateBId = Guid.NewGuid(),
        SubmissionId = fixture.Submission.SubmissionId,
        JobId = fixture.Job.JobId,
        RiskLevel = "HIGH",
        Status = "AWAITING_CANDIDATE",
        IdempotencyKey = Guid.NewGuid().ToString("N"),
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };

    private static Fixture CreateConsent(bool candidateHasAccount = true, string? serviceCode = null)
    {
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            UserId = candidateHasAccount ? Guid.NewGuid() : null,
            FullName = "Nguyen Van A",
            Email = "candidate@example.com",
            Status = "ACTIVE"
        };
        var cv = new CandidateCv
        {
            CvId = Guid.NewGuid(),
            CandidateId = candidate.CandidateId,
            Status = "PENDING_CONSENT",
            CreationMethod = "AFFILIATE_UPLOAD",
            AffiliateReuseStatus = "NOT_GRANTED",
            AffiliateReuseConcurrencyToken = Guid.NewGuid(),
            FileName = "cv.pdf"
        };
        var companyId = Guid.NewGuid();
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            CompanyId = companyId,
            Status = "ACTIVE",
            Title = "Backend Developer",
            Company = new Company { CompanyId = companyId, CompanyName = "Example Co" },
            ServiceType = serviceCode == null
                ? null!
                : new ServiceType { ServiceTypeId = Guid.NewGuid(), Code = serviceCode, Name = serviceCode }
        };
        var submission = new Submission
        {
            SubmissionId = Guid.NewGuid(),
            CandidateId = candidate.CandidateId,
            Candidate = candidate,
            CvId = cv.CvId,
            CandidateCv = cv,
            JobId = job.JobId,
            Job = job,
            SubmittedBy = Guid.NewGuid(),
            Source = "AFFILIATE",
            Status = "PENDING_CONSENT"
        };
        var consent = new SubmissionConsent
        {
            ConsentId = Guid.NewGuid(),
            SubmissionId = submission.SubmissionId,
            Submission = submission,
            RecipientEmail = candidate.Email,
            TokenHash = "hash",
            Status = "PENDING",
            RequestedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(24)
        };
        submission.Consent = consent;
        return new Fixture(consent, submission, candidate, cv, job);
    }

    private sealed record Fixture(SubmissionConsent Consent, Submission Submission, Candidate Candidate, CandidateCv Cv, Job Job);
}
