using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Interviews.Commands.ScheduleInterview;
using HRConnect.Application.Features.Recruitment.Commands.UpdateApplicationScreeningStatus;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;

namespace HRConnect.UnitTests.Features.Recruitment;

public sealed class Mf03ToMf04FlowTests
{
    [Fact]
    public async Task ClientCompany_CanScheduleInterviewAfterMf03ShortlistsCvApplication()
    {
        var applications = new Mock<IApplicationRepository>();
        var companyUsers = new Mock<ICompanyUserRepository>();
        var serviceTypes = new Mock<IServiceTypeRepository>();
        var notifications = new Mock<INotificationRepository>();
        var interviews = new Mock<IInterviewRepository>();
        var unitOfWork = new Mock<IUnitOfWork>();
        var audit = new Mock<IAuditLogService>();
        var companyId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var app = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = Guid.NewGuid(),
            JobId = Guid.NewGuid(),
            CandidateId = Guid.NewGuid(),
            Status = ApplicationStates.Submitted,
            ConcurrencyToken = Guid.NewGuid(),
            AppliedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Job = new Job
            {
                CompanyId = companyId,
                ServiceType = new ServiceType { Code = "CV_APPLICATION", Name = "CV Application" }
            },
            Candidate = new Candidate { CandidateId = Guid.NewGuid(), FullName = "Nguyen Van A" }
        };

        applications.Setup(r => r.GetByIdAsync(app.ApplicationId, It.IsAny<CancellationToken>())).ReturnsAsync(app);
        companyUsers.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId, Status = "ACTIVE" });
        notifications.Setup(r => r.ExistsAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        unitOfWork.Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        audit.Setup(r => r.AddAsync(It.IsAny<AuditEntry>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        interviews.Setup(r => r.AddAsync(It.IsAny<Interview>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var screening = new UpdateApplicationScreeningStatusCommandHandler(
            applications.Object, companyUsers.Object, serviceTypes.Object, notifications.Object,
            unitOfWork.Object, audit.Object, Mock.Of<ILogger<UpdateApplicationScreeningStatusCommandHandler>>());
        await screening.Handle(new UpdateApplicationScreeningStatusCommand(
            app.JobId, app.ApplicationId, ApplicationStates.Shortlisted, null, null,
            app.ConcurrencyToken, userId, ScreeningActor.ClientCompany), CancellationToken.None);

        var scheduling = new ScheduleInterviewCommandHandler(
            interviews.Object, applications.Object, companyUsers.Object, unitOfWork.Object,
            Mock.Of<ILogger<ScheduleInterviewCommandHandler>>(), audit.Object);
        var response = await scheduling.Handle(new ScheduleInterviewCommand(
            app.ApplicationId, DateTime.UtcNow.AddDays(2), 60, null, "ONLINE", null,
            "https://meet.example/interview", [], userId, IsClientCompanyUser: true,
            ApplicationConcurrencyToken: app.ConcurrencyToken), CancellationToken.None);

        response.Success.Should().BeTrue();
        app.Status.Should().Be(ApplicationStates.Interview);
        interviews.Verify(r => r.AddAsync(It.IsAny<Interview>(), It.IsAny<CancellationToken>()), Times.Once);
    }
}
