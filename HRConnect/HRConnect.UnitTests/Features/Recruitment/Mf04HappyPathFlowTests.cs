using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Interviews.Commands.RecordInterviewResult;
using HRConnect.Application.Features.Interviews.Commands.ScheduleInterview;
using HRConnect.Application.Features.Offers.Commands.CreateOfferDraft;
using HRConnect.Application.Features.Offers.Commands.RespondToOffer;
using HRConnect.Application.Features.Offers.Commands.SendOffer;
using HRConnect.Application.Features.Finance.Common;
using HRConnect.Application.Features.Recruitment.Commands.ConfirmStartWork;
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
            IsClientCompanyUser: true), CancellationToken.None);

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
            NotApplicableFinance());
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

    // MF-05 finance has its own tests; this flow only checks the MF-04 states.
    private static IPlacementFinanceService NotApplicableFinance()
    {
        var finance = new Mock<IPlacementFinanceService>();
        finance.Setup(s => s.InitializeAsync(It.IsAny<Placement>(), It.IsAny<JobApplicationContext>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PlacementFinanceResult(false, null, null, null, null, null, null, Array.Empty<string>()));
        return finance.Object;
    }
}
