using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Recruitment.Commands.UpdateApplicationScreeningStatus;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;

namespace HRConnect.UnitTests.Features.Recruitment;

public sealed class UpdateApplicationScreeningStatusCommandHandlerTests
{
    private readonly Mock<IApplicationRepository> _applicationRepository = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepository = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditLogService> _auditLogService = new();
    private readonly Mock<ILogger<UpdateApplicationScreeningStatusCommandHandler>> _logger = new();

    private UpdateApplicationScreeningStatusCommandHandler CreateHandler() => new(
        _applicationRepository.Object,
        _companyUserRepository.Object,
        _unitOfWork.Object,
        _auditLogService.Object,
        _logger.Object);

    [Fact]
    public async Task Handle_WhenCompanyOwnsSubmittedApplication_ShouldShortlistAndAudit()
    {
        var companyId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var application = CreateApplication(companyId, ApplicationStates.Submitted);
        _applicationRepository.Setup(r => r.GetByIdAsync(application.ApplicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);
        _companyUserRepository.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId, Status = "ACTIVE" });
        _unitOfWork.Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var response = await CreateHandler().Handle(new UpdateApplicationScreeningStatusCommand(
            application.JobId,
            application.ApplicationId,
            ApplicationStates.Shortlisted,
            "Phù hợp với yêu cầu tuyển dụng.",
            application.ConcurrencyToken,
            userId), CancellationToken.None);

        response.Data.PreviousStatus.Should().Be(ApplicationStates.Submitted);
        response.Data.CurrentStatus.Should().Be(ApplicationStates.Shortlisted);
        application.Status.Should().Be(ApplicationStates.Shortlisted);
        application.ApplicationStatusHistories.Should().ContainSingle(history =>
            history.OldStatus == ApplicationStates.Submitted && history.NewStatus == ApplicationStates.Shortlisted);
        _auditLogService.Verify(service => service.AddAsync(
            It.Is<AuditEntry>(entry => entry.Action == AuditActions.ApplicationScreened),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenCompanyDoesNotOwnJob_ShouldHideApplication()
    {
        var application = CreateApplication(Guid.NewGuid(), ApplicationStates.Submitted);
        var userId = Guid.NewGuid();
        _applicationRepository.Setup(r => r.GetByIdAsync(application.ApplicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);
        _companyUserRepository.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = Guid.NewGuid(), Status = "ACTIVE" });

        var act = () => CreateHandler().Handle(new UpdateApplicationScreeningStatusCommand(
            application.JobId,
            application.ApplicationId,
            ApplicationStates.Shortlisted,
            null,
            application.ConcurrencyToken,
            userId), CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_WhenTransitionIsNotAllowed_ShouldRejectRequest()
    {
        var companyId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var application = CreateApplication(companyId, ApplicationStates.Shortlisted);
        _applicationRepository.Setup(r => r.GetByIdAsync(application.ApplicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);
        _companyUserRepository.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId, Status = "ACTIVE" });

        var act = () => CreateHandler().Handle(new UpdateApplicationScreeningStatusCommand(
            application.JobId,
            application.ApplicationId,
            ApplicationStates.Rejected,
            null,
            application.ConcurrencyToken,
            userId), CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*SHORTLISTED*sang REJECTED*");
    }

    private static HRConnect.Domain.Entities.Application CreateApplication(Guid companyId, string status)
    {
        var jobId = Guid.NewGuid();
        return new HRConnect.Domain.Entities.Application
        {
            ApplicationId = Guid.NewGuid(),
            JobId = jobId,
            Job = new Job { JobId = jobId, CompanyId = companyId },
            CandidateId = Guid.NewGuid(),
            Status = status,
            ConcurrencyToken = Guid.NewGuid(),
            AppliedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }
}
