using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Interviews.Commands.RecordInterviewResult;
using HRConnect.Application.Features.Interviews.Commands.ScheduleInterview;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Application.Features.Offers.Commands.CreateOfferDraft;
using HRConnect.Application.Features.Offers.Commands.RespondToOffer;
using HRConnect.Application.Features.Offers.Commands.SendOffer;
using HRConnect.Application.Features.Finance.Common;
using HRConnect.Application.Features.Placements.Commands.ReconcilePlacement;
using HRConnect.Application.Features.Placements.Commands.ResolveFlaggedReconciliation;
using HRConnect.Application.Features.Recruitment.Commands.ConfirmStartWork;
using HRConnect.Application.Features.Recruitment.Commands.MarkNotStarted;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;

namespace HRConnect.UnitTests.Features.Recruitment;

public sealed class Mf04HappyPathFlowTests
{
    [Fact]
    public async Task ShortlistedApplication_CanReachPlacedThroughCompleteMf04Flow()
    {
        var applications = new Mock<IApplicationRepository>();
        var interviews = new Mock<IInterviewRepository>();
        var offers = new Mock<IOfferRepository>();
        var placements = new Mock<IPlacementRepository>();
        var companyUsers = new Mock<ICompanyUserRepository>();
        var financeRepository = new Mock<IFinanceRepository>();
        var unitOfWork = new Mock<IUnitOfWork>();
        var audit = new Mock<IAuditLogService>();

        var companyId = Guid.NewGuid();
        var companyUserId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();
        var application = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = Guid.NewGuid(),
            JobId = Guid.NewGuid(),
            CandidateId = Guid.NewGuid(),
            Status = ApplicationStates.Shortlisted,
            ConcurrencyToken = Guid.NewGuid(),
            Job = new Job
            {
                CompanyId = companyId,
                Title = "Backend Developer"
            },
            Candidate = new Candidate
            {
                CandidateId = Guid.NewGuid(),
                UserId = candidateUserId,
                FullName = "Nguyen Van A"
            }
        };

        Interview? persistedInterview = null;
        Offer? persistedOffer = null;
        Placement? persistedPlacement = null;

        applications
            .Setup(repository => repository.GetByIdAsync(application.ApplicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);
        companyUsers
            .Setup(repository => repository.GetByUserIdAsync(companyUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser
            {
                UserId = companyUserId,
                CompanyId = companyId,
                Status = "ACTIVE"
            });
        interviews
            .Setup(repository => repository.AddAsync(It.IsAny<Interview>(), It.IsAny<CancellationToken>()))
            .Callback<Interview, CancellationToken>((interview, _) =>
            {
                persistedInterview = interview;
                interview.Application = application;
                application.Interviews.Add(interview);
            })
            .Returns(Task.CompletedTask);
        interviews
            .Setup(repository => repository.GetByIdForUpdateAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => persistedInterview);
        offers
            .Setup(repository => repository.GetByApplicationIdAsync(application.ApplicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => application.Offers.ToList());
        offers
            .Setup(repository => repository.AddAsync(It.IsAny<Offer>(), It.IsAny<CancellationToken>()))
            .Callback<Offer, CancellationToken>((offer, _) =>
            {
                persistedOffer = offer;
                offer.Application = application;
                application.Offers.Add(offer);
            })
            .Returns(Task.CompletedTask);
        offers
            .Setup(repository => repository.GetByIdWithApplicationAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => persistedOffer);
        offers
            .Setup(repository => repository.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => persistedOffer);
        placements
            .Setup(repository => repository.GetByApplicationIdAsync(application.ApplicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => persistedPlacement);
        placements
            .Setup(repository => repository.AddAsync(It.IsAny<Placement>(), It.IsAny<CancellationToken>()))
            .Callback<Placement, CancellationToken>((placement, _) =>
            {
                persistedPlacement = placement;
                application.Placement = placement;
            })
            .Returns(Task.CompletedTask);
        unitOfWork
            .Setup(work => work.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
        audit
            .Setup(service => service.AddAsync(It.IsAny<AuditEntry>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var scheduleHandler = new ScheduleInterviewCommandHandler(
            interviews.Object,
            applications.Object,
            companyUsers.Object,
            unitOfWork.Object,
            Mock.Of<ILogger<ScheduleInterviewCommandHandler>>(),
            audit.Object);
        var scheduled = await scheduleHandler.Handle(new ScheduleInterviewCommand(
            application.ApplicationId,
            DateTime.UtcNow.AddDays(1),
            60,
            1,
            "ONLINE",
            null,
            "https://meet.example/interview",
            [],
            companyUserId,
            IsClientCompanyUser: true,
            ApplicationConcurrencyToken: application.ConcurrencyToken), CancellationToken.None);

        scheduled.Success.Should().BeTrue();
        application.Status.Should().Be(ApplicationStates.Interview);
        persistedInterview.Should().NotBeNull();

        persistedInterview!.ScheduledAt = DateTime.UtcNow.AddMinutes(-1);
        var resultHandler = new RecordInterviewResultCommandHandler(
            interviews.Object,
            applications.Object,
            companyUsers.Object,
            unitOfWork.Object,
            Mock.Of<ILogger<RecordInterviewResultCommandHandler>>(),
            audit.Object);
        await resultHandler.Handle(new RecordInterviewResultCommand(
            persistedInterview.InterviewId,
            InterviewResults.Pass,
            "Đạt yêu cầu",
            true,
            "MAKE_OFFER",
            persistedInterview.ConcurrencyToken,
            companyUserId,
            IsClientCompanyUser: true), CancellationToken.None);

        application.Status.Should().Be(ApplicationStates.OfferPending);
        persistedInterview.Status.Should().Be(InterviewStates.Completed);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var createOfferHandler = new CreateOfferDraftCommandHandler(
            offers.Object,
            applications.Object,
            companyUsers.Object,
            unitOfWork.Object,
            Mock.Of<ILogger<CreateOfferDraftCommandHandler>>(),
            audit.Object);
        await createOfferHandler.Handle(new CreateOfferDraftCommand(
            application.ApplicationId,
            30_000_000,
            "VND",
            today.AddDays(7),
            today.AddDays(3),
            null,
            application.ConcurrencyToken,
            companyUserId,
            IsClientCompanyUser: true,
            SalaryBasis: OfferSalaryBasisCodes.Gross,
            SalaryPeriod: OfferSalaryPeriodCodes.Monthly), CancellationToken.None);

        persistedOffer.Should().NotBeNull();
        persistedOffer!.Status.Should().Be(OfferStates.Draft);

        var sendOfferHandler = new SendOfferCommandHandler(
            offers.Object,
            applications.Object,
            companyUsers.Object,
            unitOfWork.Object,
            Mock.Of<ILogger<SendOfferCommandHandler>>(),
            audit.Object);
        await sendOfferHandler.Handle(new SendOfferCommand(
            persistedOffer.OfferId,
            persistedOffer.ConcurrencyToken,
            companyUserId,
            IsClientCompanyUser: true), CancellationToken.None);

        persistedOffer.Status.Should().Be(OfferStates.Sent);

        var respondHandler = new RespondToOfferCommandHandler(
            offers.Object,
            applications.Object,
            unitOfWork.Object,
            Mock.Of<ILogger<RespondToOfferCommandHandler>>(),
            audit.Object);
        await respondHandler.Handle(new RespondToOfferCommand(
            persistedOffer.OfferId,
            OfferStates.Accepted,
            null,
            persistedOffer.ConcurrencyToken,
            candidateUserId), CancellationToken.None);

        persistedOffer.Status.Should().Be(OfferStates.Accepted);
        application.Status.Should().Be(ApplicationStates.OfferAccepted);

        var confirmStartHandler = new ConfirmStartWorkCommandHandler(
            applications.Object,
            offers.Object,
            placements.Object,
            companyUsers.Object,
            unitOfWork.Object,
            Mock.Of<ILogger<ConfirmStartWorkCommandHandler>>(),
            audit.Object,
            NotApplicableFinance(),
            financeRepository.Object,
            Mock.Of<IPlacementReconciliationRepository>());
        await confirmStartHandler.Handle(new ConfirmStartWorkCommand(
            application.ApplicationId,
            persistedOffer.OfferId,
            today,
            "Ứng viên đã nhận việc",
            null,
            "Engineering",
            application.ConcurrencyToken,
            companyUserId,
            IsClientCompanyUser: true), CancellationToken.None);

        application.Status.Should().Be(ApplicationStates.Placed);
        persistedPlacement.Should().NotBeNull();
        persistedPlacement!.Status.Should().Be(PlacementStates.Started);
        persistedPlacement.OfferId.Should().Be(persistedOffer.OfferId);
        persistedPlacement.Position.Should().Be("Backend Developer");
        unitOfWork.Verify(
            work => work.SaveChangesAsync(It.IsAny<CancellationToken>()),
            Times.Exactly(6));
    }

    [Fact]
    public async Task IncorrectNotStartedClaim_CanBeReopenedAndCorrectedWithoutDuplicateReconciliation()
    {
        var applications = new Mock<IApplicationRepository>();
        var offers = new Mock<IOfferRepository>();
        var placements = new Mock<IPlacementRepository>();
        var companyUsers = new Mock<ICompanyUserRepository>();
        var reconciliations = new Mock<IPlacementReconciliationRepository>();
        var notifications = new Mock<INotificationRepository>();
        var financeRepository = new Mock<IFinanceRepository>();
        var finance = new Mock<IPlacementFinanceService>();
        var warrantyProgress = new Mock<IWarrantyProgressService>();
        var settings = new Mock<IAdminBusinessSettings>();
        var delivery = new Mock<ICandidateRecruitmentDeliveryService>();
        var unitOfWork = new Mock<IUnitOfWork>();
        var audit = new Mock<IAuditLogService>();

        var companyId = Guid.NewGuid();
        var companyUserId = Guid.NewGuid();
        var internalHrId = Guid.NewGuid();
        var platformAdminId = Guid.NewGuid();
        var serviceTypeId = Guid.NewGuid();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var application = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = Guid.NewGuid(),
            JobId = Guid.NewGuid(),
            CandidateId = Guid.NewGuid(),
            Status = ApplicationStates.OfferAccepted,
            ConcurrencyToken = Guid.NewGuid(),
            Job = new Job
            {
                JobId = Guid.NewGuid(),
                CompanyId = companyId,
                Title = "Backend Developer",
                ServiceTypeId = serviceTypeId,
                ServiceType = new ServiceType
                {
                    ServiceTypeId = serviceTypeId,
                    Code = ServiceTypeCodes.HeadhuntCod,
                    Name = "Headhunt COD"
                }
            },
            Candidate = new Candidate
            {
                CandidateId = Guid.NewGuid(),
                UserId = Guid.NewGuid(),
                FullName = "Nguyen Van A",
                Email = "candidate@example.com"
            }
        };
        application.JobId = application.Job.JobId;

        var offer = new Offer
        {
            OfferId = Guid.NewGuid(),
            ApplicationId = application.ApplicationId,
            Application = application,
            Status = OfferStates.Accepted,
            CurrencyCode = "VND",
            RespondedAt = DateTime.UtcNow.AddDays(-1),
            ConcurrencyToken = Guid.NewGuid()
        };
        application.Offers.Add(offer);

        Placement? persistedPlacement = null;
        PlacementReconciliation? persistedReconciliation = null;

        applications
            .Setup(repository => repository.GetByIdAsync(application.ApplicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);
        offers
            .Setup(repository => repository.GetByIdAsync(offer.OfferId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);
        companyUsers
            .Setup(repository => repository.GetByUserIdAsync(companyUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser
            {
                UserId = companyUserId,
                CompanyId = companyId,
                Status = "ACTIVE"
            });
        placements
            .Setup(repository => repository.GetByApplicationIdAsync(application.ApplicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => persistedPlacement);
        placements
            .Setup(repository => repository.AddAsync(It.IsAny<Placement>(), It.IsAny<CancellationToken>()))
            .Callback<Placement, CancellationToken>((placement, _) =>
            {
                persistedPlacement = placement;
                application.Placement = placement;
            })
            .Returns(Task.CompletedTask);
        reconciliations
            .Setup(repository => repository.GetByApplicationIdAsync(
                application.ApplicationId,
                true,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => persistedReconciliation);
        reconciliations
            .Setup(repository => repository.AddAsync(It.IsAny<PlacementReconciliation>(), It.IsAny<CancellationToken>()))
            .Callback<PlacementReconciliation, CancellationToken>((item, _) =>
            {
                persistedReconciliation = item;
                item.Application = application;
            })
            .Returns(Task.CompletedTask);
        reconciliations
            .Setup(repository => repository.GetActivePlatformAdminUserIdsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<Guid>());
        notifications
            .Setup(repository => repository.AddAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        audit
            .Setup(service => service.AddAsync(It.IsAny<AuditEntry>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        unitOfWork
            .Setup(work => work.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
        delivery
            .Setup(service => service.DeliverApplicationOutcomeAsync(
                application,
                ApplicationCandidateDeliveryEvent.NotStartedReported,
                It.IsAny<string>(),
                It.IsAny<DateTime>(),
                null,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CandidateRecruitmentDeliveryOutcome(CandidateRecruitmentDeliveryChannel.InApp));
        finance
            .Setup(service => service.InitializeAsync(
                It.IsAny<Placement>(),
                It.IsAny<JobApplicationContext>(),
                companyUserId,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlacementFinanceResult(false, null, null, null, null, null, null, Array.Empty<string>()));

        var markNotStarted = new MarkNotStartedCommandHandler(
            applications.Object,
            placements.Object,
            companyUsers.Object,
            unitOfWork.Object,
            Mock.Of<ILogger<MarkNotStartedCommandHandler>>(),
            audit.Object,
            reconciliations.Object,
            delivery.Object);
        await markNotStarted.Handle(new MarkNotStartedCommand(
            application.ApplicationId,
            "Ứng viên không đến nhận việc",
            application.ConcurrencyToken,
            companyUserId,
            IsClientCompanyUser: true), CancellationToken.None);

        application.Status.Should().Be(ApplicationStates.NotStarted);
        persistedReconciliation.Should().NotBeNull();
        persistedReconciliation!.Status.Should().Be(PlacementReconciliationStates.Pending);
        persistedReconciliation.ClaimedOutcome.Should().Be(PlacementReconciliationOutcomes.NotStarted);
        reconciliations.Verify(repository => repository.AddAsync(
            It.IsAny<PlacementReconciliation>(),
            It.IsAny<CancellationToken>()), Times.Once);
        delivery.Verify(service => service.DeliverApplicationOutcomeAsync(
            application,
            ApplicationCandidateDeliveryEvent.NotStartedReported,
            "Ứng viên không đến nhận việc",
            It.IsAny<DateTime>(),
            null,
            It.IsAny<CancellationToken>()), Times.Once);

        var initialReconciliationId = persistedReconciliation.ReconciliationId;
        var initialReconciliationToken = persistedReconciliation.ConcurrencyToken;
        var reconcile = new ReconcilePlacementCommandHandler(
            reconciliations.Object,
            notifications.Object,
            audit.Object,
            unitOfWork.Object,
            warrantyProgress.Object,
            settings.Object);

        var staleRequest = () => reconcile.Handle(new ReconcilePlacementCommand(
            application.ApplicationId,
            PlacementReconciliationDecisions.Flag,
            PlacementReconciliationContactChannels.Both,
            "Ứng viên xác nhận đã đi làm",
            Guid.NewGuid(),
            internalHrId), CancellationToken.None);
        await staleRequest.Should().ThrowAsync<HRConnect.Application.Common.Exceptions.ConflictException>();
        persistedReconciliation.Status.Should().Be(PlacementReconciliationStates.Pending);

        await reconcile.Handle(new ReconcilePlacementCommand(
            application.ApplicationId,
            PlacementReconciliationDecisions.Flag,
            PlacementReconciliationContactChannels.Both,
            "Ứng viên xác nhận đã đi làm",
            initialReconciliationToken,
            internalHrId), CancellationToken.None);
        persistedReconciliation.Status.Should().Be(PlacementReconciliationStates.Flagged);

        var resolve = new ResolveFlaggedReconciliationCommandHandler(
            reconciliations.Object,
            applications.Object,
            audit.Object,
            unitOfWork.Object,
            warrantyProgress.Object,
            settings.Object);
        await resolve.Handle(new ResolveFlaggedReconciliationCommand(
            application.ApplicationId,
            PlacementReconciliationResolutionActions.ReopenForClientConfirmation,
            "Đã đối chiếu bằng chứng nhận việc",
            persistedReconciliation.ConcurrencyToken,
            platformAdminId), CancellationToken.None);

        application.Status.Should().Be(ApplicationStates.OfferAccepted);
        persistedReconciliation.Status.Should().Be(PlacementReconciliationStates.Confirmed);
        persistedReconciliation.ResolutionAction.Should().Be(
            PlacementReconciliationResolutionActions.ReopenForClientConfirmation);
        application.ApplicationStatusHistories.Should().Contain(history =>
            history.OldStatus == ApplicationStates.NotStarted &&
            history.NewStatus == ApplicationStates.OfferAccepted);
        finance.Verify(service => service.InitializeAsync(
            It.IsAny<Placement>(),
            It.IsAny<JobApplicationContext>(),
            It.IsAny<Guid>(),
            It.IsAny<CancellationToken>()), Times.Never);

        var reopenedReconciliationToken = persistedReconciliation.ConcurrencyToken;
        var confirmStart = new ConfirmStartWorkCommandHandler(
            applications.Object,
            offers.Object,
            placements.Object,
            companyUsers.Object,
            unitOfWork.Object,
            Mock.Of<ILogger<ConfirmStartWorkCommandHandler>>(),
            audit.Object,
            finance.Object,
            financeRepository.Object,
            reconciliations.Object);
        await confirmStart.Handle(new ConfirmStartWorkCommand(
            application.ApplicationId,
            offer.OfferId,
            today,
            "Ứng viên đã đi làm thực tế",
            null,
            "Engineering",
            application.ConcurrencyToken,
            companyUserId,
            IsClientCompanyUser: true), CancellationToken.None);

        application.Status.Should().Be(ApplicationStates.Placed);
        persistedPlacement.Should().NotBeNull();
        persistedReconciliation.ReconciliationId.Should().Be(initialReconciliationId);
        persistedReconciliation.Status.Should().Be(PlacementReconciliationStates.Pending);
        persistedReconciliation.ClaimedOutcome.Should().Be(PlacementReconciliationOutcomes.Started);
        persistedReconciliation.PlacementId.Should().Be(persistedPlacement!.PlacementId);
        persistedReconciliation.ContactChannel.Should().BeNull();
        persistedReconciliation.Note.Should().BeNull();
        persistedReconciliation.ResolutionAction.Should().BeNull();
        persistedReconciliation.ResolutionNote.Should().BeNull();
        persistedReconciliation.ReviewedBy.Should().BeNull();
        persistedReconciliation.ReviewedAt.Should().BeNull();
        persistedReconciliation.ConcurrencyToken.Should().NotBe(reopenedReconciliationToken);
        reconciliations.Verify(repository => repository.AddAsync(
            It.IsAny<PlacementReconciliation>(),
            It.IsAny<CancellationToken>()), Times.Once);
        finance.Verify(service => service.InitializeAsync(
            persistedPlacement,
            It.IsAny<JobApplicationContext>(),
            companyUserId,
            It.IsAny<CancellationToken>()), Times.Once);

        await reconcile.Handle(new ReconcilePlacementCommand(
            application.ApplicationId,
            PlacementReconciliationDecisions.Confirm,
            PlacementReconciliationContactChannels.Candidate,
            "Ứng viên xác nhận đã bắt đầu làm việc",
            persistedReconciliation.ConcurrencyToken,
            internalHrId), CancellationToken.None);

        persistedReconciliation.Status.Should().Be(PlacementReconciliationStates.Confirmed);
        application.ApplicationStatusHistories.Should().Contain(history =>
            history.OldStatus == ApplicationStates.OfferAccepted &&
            history.NewStatus == ApplicationStates.Placed);
    }

    // MF-05 finance has its own tests; this flow only checks the MF-04 states.
    private static IPlacementFinanceService NotApplicableFinance()
    {
        var finance = new Mock<IPlacementFinanceService>();
        finance.Setup(s => s.InitializeAsync(It.IsAny<Placement>(), It.IsAny<JobApplicationContext>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlacementFinanceResult(false, null, null, null, null, null, null, Array.Empty<string>()));
        return finance.Object;
    }
}
