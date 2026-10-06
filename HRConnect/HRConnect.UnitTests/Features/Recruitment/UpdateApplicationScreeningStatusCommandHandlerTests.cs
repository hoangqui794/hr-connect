using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Recruitment.Commands.UpdateApplicationScreeningStatus;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;

namespace HRConnect.UnitTests.Features.Recruitment;

public sealed class UpdateApplicationScreeningStatusCommandHandlerTests
{
    private readonly Mock<IApplicationRepository> _applicationRepository = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepository = new();
    private readonly Mock<IServiceTypeRepository> _serviceTypeRepository = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditLogService> _auditLogService = new();
    private readonly Mock<ILogger<UpdateApplicationScreeningStatusCommandHandler>> _logger = new();

    private UpdateApplicationScreeningStatusCommandHandler CreateHandler() => new(
        _applicationRepository.Object,
        _companyUserRepository.Object,
        _serviceTypeRepository.Object,
        _unitOfWork.Object,
        _auditLogService.Object,
        _logger.Object);

    [Fact]
    public async Task Handle_WhenCompanyOwnsSubmittedApplication_ShouldShortlistAndAudit()
    {
        var companyId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var application = SetupApplication(companyId, ApplicationStates.Submitted, "CV_APPLICATION");
        SetupActiveCompanyUser(userId, companyId);

        var response = await CreateHandler().Handle(Command(
            application, ApplicationStates.Shortlisted, "Phù hợp với yêu cầu tuyển dụng.", userId,
            ScreeningActor.ClientCompany), CancellationToken.None);

        response.Data.PreviousStatus.Should().Be(ApplicationStates.Submitted);
        response.Data.CurrentStatus.Should().Be(ApplicationStates.Shortlisted);
        application.Status.Should().Be(ApplicationStates.Shortlisted);
        application.ApplicationStatusHistories.Should().ContainSingle(history =>
            history.OldStatus == ApplicationStates.Submitted && history.NewStatus == ApplicationStates.Shortlisted);
        _auditLogService.Verify(service => service.AddAsync(
            It.Is<AuditEntry>(entry => entry.Action == AuditActions.ApplicationScreened),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData("HEADHUNT_COD")]
    [InlineData("CV_SOURCING")]
    public async Task Handle_WhenInternalHrScreensPlatformSourcedService_ShouldShortlistWithoutCompanyMembership(
        string serviceTypeCode)
    {
        var userId = Guid.NewGuid();
        var application = SetupApplication(Guid.NewGuid(), ApplicationStates.Submitted, serviceTypeCode);

        var response = await CreateHandler().Handle(Command(
            application, ApplicationStates.Shortlisted, null, userId, ScreeningActor.InternalHr),
            CancellationToken.None);

        response.Data.CurrentStatus.Should().Be(ApplicationStates.Shortlisted);
        _companyUserRepository.Verify(
            r => r.GetByUserIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenServiceTypeNotLoadedOnJob_ShouldResolveItFromRepository()
    {
        var userId = Guid.NewGuid();
        var application = SetupApplication(Guid.NewGuid(), ApplicationStates.Submitted, "HEADHUNT_COD");
        var serviceType = application.Job.ServiceType;
        application.Job.ServiceType = null!;
        _serviceTypeRepository.Setup(r => r.GetByIdAsync(serviceType.ServiceTypeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(serviceType);

        var response = await CreateHandler().Handle(Command(
            application, ApplicationStates.Shortlisted, null, userId, ScreeningActor.InternalHr),
            CancellationToken.None);

        response.Data.CurrentStatus.Should().Be(ApplicationStates.Shortlisted);
    }

    [Fact]
    public async Task Handle_WhenInternalHrScreensCvApplication_ShouldForbid()
    {
        var application = SetupApplication(Guid.NewGuid(), ApplicationStates.Submitted, "CV_APPLICATION");

        var act = () => CreateHandler().Handle(Command(
            application, ApplicationStates.Shortlisted, null, Guid.NewGuid(), ScreeningActor.InternalHr),
            CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>().WithMessage("*CV_APPLICATION*Client Company*");
        application.Status.Should().Be(ApplicationStates.Submitted);
    }

    [Theory]
    [InlineData("HEADHUNT_COD")]
    [InlineData("CV_SOURCING")]
    public async Task Handle_WhenCompanyScreensPlatformSourcedService_ShouldForbid(string serviceTypeCode)
    {
        var companyId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var application = SetupApplication(companyId, ApplicationStates.Submitted, serviceTypeCode);
        SetupActiveCompanyUser(userId, companyId);

        var act = () => CreateHandler().Handle(Command(
            application, ApplicationStates.Shortlisted, null, userId, ScreeningActor.ClientCompany),
            CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>().WithMessage("*Internal HR*");
        application.Status.Should().Be(ApplicationStates.Submitted);
    }

    [Fact]
    public async Task Handle_WhenCompanyDoesNotOwnJob_ShouldHideApplication()
    {
        var userId = Guid.NewGuid();
        var application = SetupApplication(Guid.NewGuid(), ApplicationStates.Submitted, "CV_APPLICATION");
        SetupActiveCompanyUser(userId, Guid.NewGuid());

        var act = () => CreateHandler().Handle(Command(
            application, ApplicationStates.Shortlisted, null, userId, ScreeningActor.ClientCompany),
            CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_WhenTransitionIsNotAllowed_ShouldRejectRequest()
    {
        var companyId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var application = SetupApplication(companyId, ApplicationStates.Shortlisted, "CV_APPLICATION");
        SetupActiveCompanyUser(userId, companyId);

        var act = () => CreateHandler().Handle(Command(
            application, ApplicationStates.Rejected, "Không phù hợp.", userId, ScreeningActor.ClientCompany),
            CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*SHORTLISTED*sang REJECTED*");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("   ")]
    public async Task Handle_WhenRejectingWithoutReason_ShouldRejectRequest(string? reason)
    {
        var application = SetupApplication(Guid.NewGuid(), ApplicationStates.Submitted, "HEADHUNT_COD");

        var act = () => CreateHandler().Handle(Command(
            application, ApplicationStates.Rejected, reason, Guid.NewGuid(), ScreeningActor.InternalHr),
            CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>().WithMessage("*lý do*");
        application.Status.Should().Be(ApplicationStates.Submitted);
    }

    [Fact]
    public async Task Handle_WhenRejectingWithReason_ShouldStoreReason()
    {
        var application = SetupApplication(Guid.NewGuid(), ApplicationStates.Submitted, "CV_SOURCING");

        var response = await CreateHandler().Handle(Command(
            application, ApplicationStates.Rejected, "  Thiếu kinh nghiệm .NET.  ", Guid.NewGuid(),
            ScreeningActor.InternalHr), CancellationToken.None);

        response.Data.CurrentStatus.Should().Be(ApplicationStates.Rejected);
        application.StatusReason.Should().Be("Thiếu kinh nghiệm .NET.");
        application.ApplicationStatusHistories.Should().ContainSingle(h => h.Reason == "Thiếu kinh nghiệm .NET.");
    }

    [Fact]
    public async Task Handle_WhenConcurrencyTokenMissing_ShouldRejectRequest()
    {
        var application = SetupApplication(Guid.NewGuid(), ApplicationStates.Submitted, "HEADHUNT_COD");

        var act = () => CreateHandler().Handle(Command(
            application, ApplicationStates.Shortlisted, null, Guid.NewGuid(), ScreeningActor.InternalHr) with
        {
            ConcurrencyToken = null
        }, CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>().WithMessage("*concurrencyToken*");
    }

    [Fact]
    public async Task Handle_WhenConcurrencyTokenIsStale_ShouldConflict()
    {
        var application = SetupApplication(Guid.NewGuid(), ApplicationStates.Submitted, "HEADHUNT_COD");

        var act = () => CreateHandler().Handle(Command(
            application, ApplicationStates.Shortlisted, null, Guid.NewGuid(), ScreeningActor.InternalHr) with
        {
            ConcurrencyToken = Guid.NewGuid()
        }, CancellationToken.None);

        await act.Should().ThrowAsync<ConflictException>();
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    private static UpdateApplicationScreeningStatusCommand Command(
        HRConnect.Domain.Entities.Application application,
        string targetStatus,
        string? reason,
        Guid userId,
        ScreeningActor actor) => new(
            application.JobId,
            application.ApplicationId,
            targetStatus,
            reason,
            application.ConcurrencyToken,
            userId,
            actor);

    private void SetupActiveCompanyUser(Guid userId, Guid companyId) =>
        _companyUserRepository.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId, Status = "ACTIVE" });

    private HRConnect.Domain.Entities.Application SetupApplication(
        Guid companyId,
        string status,
        string serviceTypeCode)
    {
        var application = CreateApplication(companyId, status, serviceTypeCode);
        _applicationRepository.Setup(r => r.GetByIdAsync(application.ApplicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);
        _unitOfWork.Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        return application;
    }

    private static HRConnect.Domain.Entities.Application CreateApplication(
        Guid companyId,
        string status,
        string serviceTypeCode)
    {
        var jobId = Guid.NewGuid();
        var serviceType = new ServiceType { ServiceTypeId = Guid.NewGuid(), Code = serviceTypeCode, Name = serviceTypeCode };
        return new HRConnect.Domain.Entities.Application
        {
            ApplicationId = Guid.NewGuid(),
            JobId = jobId,
            Job = new Job
            {
                JobId = jobId,
                CompanyId = companyId,
                ServiceTypeId = serviceType.ServiceTypeId,
                ServiceType = serviceType
            },
            CandidateId = Guid.NewGuid(),
            Status = status,
            ConcurrencyToken = Guid.NewGuid(),
            AppliedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }
}
