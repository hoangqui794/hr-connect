using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Interviews.Commands.ScheduleInterview;
using HRConnect.Application.Features.Offers.Commands.SendOffer;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.Recruitment;

public class CandidateRecruitmentDeliveryHandlerIntegrationTests
{
    [Fact]
    public async Task ScheduleInterview_WithEmailOnlyCandidate_QueuesDeliveryAndReturnsEmailChannel()
    {
        var application = new JobApplication
        {
            ApplicationId = Guid.NewGuid(),
            Status = ApplicationStates.Shortlisted,
            ConcurrencyToken = Guid.NewGuid(),
            Candidate = new Candidate { FullName = "An", Email = "candidate@example.com" },
            Job = new Job { CompanyId = Guid.NewGuid(), Title = "Backend Developer" }
        };
        var userId = Guid.NewGuid();
        var delivery = new Mock<ICandidateRecruitmentDeliveryService>();
        var decision = new CandidateRecruitmentDeliveryDecision(
            CandidateRecruitmentDeliveryChannel.Email, null, "candidate@example.com");
        delivery.Setup(x => x.RequireReachable(application.Candidate)).Returns(decision);
        delivery.Setup(x => x.DeliverInterviewAsync(
                application,
                It.IsAny<Interview>(),
                InterviewCandidateDeliveryEvent.Scheduled,
                null,
                It.IsAny<DateTime>(),
                decision,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CandidateRecruitmentDeliveryOutcome(CandidateRecruitmentDeliveryChannel.Email));

        var applications = new Mock<IApplicationRepository>();
        applications.Setup(x => x.GetByIdAsync(application.ApplicationId, It.IsAny<CancellationToken>())).ReturnsAsync(application);
        var companyUsers = new Mock<ICompanyUserRepository>();
        companyUsers.Setup(x => x.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = application.Job.CompanyId, Status = "ACTIVE" });
        var interviews = new Mock<IInterviewRepository>();
        var unitOfWork = new Mock<IUnitOfWork>();
        unitOfWork.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var handler = new ScheduleInterviewCommandHandler(
            interviews.Object,
            applications.Object,
            companyUsers.Object,
            unitOfWork.Object,
            Mock.Of<ILogger<ScheduleInterviewCommandHandler>>(),
            Mock.Of<IAuditLogService>(),
            candidateDeliveryService: delivery.Object);

        var response = await handler.Handle(new ScheduleInterviewCommand(
            application.ApplicationId,
            DateTime.UtcNow.AddDays(1),
            60,
            1,
            "ONLINE",
            null,
            "https://meet.example.com/room",
            null,
            userId,
            IsClientCompanyUser: true,
            ApplicationConcurrencyToken: application.ConcurrencyToken), CancellationToken.None);

        response.Data.DeliveryChannel.Should().Be("EMAIL");
        delivery.Verify(x => x.DeliverInterviewAsync(
            application,
            It.IsAny<Interview>(),
            InterviewCandidateDeliveryEvent.Scheduled,
            null,
            It.IsAny<DateTime>(),
            decision,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SendOffer_WithEmailOnlyCandidate_QueuesDeliveryAndReturnsEmailChannel()
    {
        var application = new JobApplication
        {
            ApplicationId = Guid.NewGuid(),
            Status = ApplicationStates.OfferPending,
            Candidate = new Candidate { FullName = "An", Email = "candidate@example.com" },
            Job = new Job { CompanyId = Guid.NewGuid(), Title = "Backend Developer" }
        };
        var offer = new Offer
        {
            OfferId = Guid.NewGuid(),
            ApplicationId = application.ApplicationId,
            Application = application,
            Status = OfferStates.Draft,
            OfferVersion = 1,
            Salary = 30_000_000m,
            CurrencyCode = "VND",
            SalaryBasis = OfferSalaryBasisCodes.Gross,
            SalaryPeriod = OfferSalaryPeriodCodes.Monthly,
            ExpiryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)),
            ConcurrencyToken = Guid.NewGuid()
        };
        var userId = Guid.NewGuid();
        var decision = new CandidateRecruitmentDeliveryDecision(
            CandidateRecruitmentDeliveryChannel.Email, null, "candidate@example.com");
        var delivery = new Mock<ICandidateRecruitmentDeliveryService>();
        delivery.Setup(x => x.RequireReachable(application.Candidate)).Returns(decision);
        delivery.Setup(x => x.DeliverOfferAsync(
                offer,
                OfferCandidateDeliveryEvent.Sent,
                null,
                It.IsAny<DateTime>(),
                decision,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CandidateRecruitmentDeliveryOutcome(CandidateRecruitmentDeliveryChannel.Email));

        var offers = new Mock<IOfferRepository>();
        offers.Setup(x => x.GetByIdWithApplicationAsync(offer.OfferId, It.IsAny<CancellationToken>())).ReturnsAsync(offer);
        var applications = new Mock<IApplicationRepository>();
        var companyUsers = new Mock<ICompanyUserRepository>();
        companyUsers.Setup(x => x.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = application.Job.CompanyId, Status = "ACTIVE" });
        var unitOfWork = new Mock<IUnitOfWork>();
        unitOfWork.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var handler = new SendOfferCommandHandler(
            offers.Object,
            applications.Object,
            companyUsers.Object,
            unitOfWork.Object,
            Mock.Of<ILogger<SendOfferCommandHandler>>(),
            Mock.Of<IAuditLogService>(),
            candidateDeliveryService: delivery.Object);

        var response = await handler.Handle(new SendOfferCommand(
            offer.OfferId,
            offer.ConcurrencyToken,
            userId,
            IsClientCompanyUser: true), CancellationToken.None);

        response.DeliveryChannel.Should().Be("EMAIL");
        delivery.Verify(x => x.DeliverOfferAsync(
            offer,
            OfferCandidateDeliveryEvent.Sent,
            null,
            It.IsAny<DateTime>(),
            decision,
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
