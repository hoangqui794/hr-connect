using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Recruitment.Commands.StartScreening;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.Recruitment;

public sealed class StartScreeningCommandHandlerTests
{
    private readonly Mock<IApplicationRepository> _applicationRepository = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepository = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditLogService> _auditLogService = new();
    private readonly Guid _companyId = Guid.NewGuid();
    private readonly Guid _clientUserId = Guid.NewGuid();

    public StartScreeningCommandHandlerTests()
    {
        _companyUserRepository.Setup(r => r.GetByUserIdAsync(_clientUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = _clientUserId, CompanyId = _companyId, Status = "ACTIVE" });
        _unitOfWork.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
    }

    private StartScreeningCommandHandler CreateHandler() => new(
        _applicationRepository.Object,
        _companyUserRepository.Object,
        Mock.Of<IServiceTypeRepository>(),
        _unitOfWork.Object,
        _auditLogService.Object);

    [Fact]
    public async Task InternalHr_OpeningSubmittedHeadhunt_ShouldMoveToScreeningOnce()
    {
        var app = Setup("HEADHUNT_COD", ApplicationStates.Submitted);
        var originalToken = app.ConcurrencyToken;
        var command = new StartScreeningCommand(app.JobId, app.ApplicationId, Guid.NewGuid(), ScreeningActor.InternalHr);

        var first = await CreateHandler().Handle(command, CancellationToken.None);
        var second = await CreateHandler().Handle(command, CancellationToken.None);

        first.Data.Changed.Should().BeTrue();
        first.Data.CurrentStatus.Should().Be(ApplicationStates.Screening);
        first.Data.ConcurrencyToken.Should().NotBe(originalToken);
        second.Data.Changed.Should().BeFalse();
        second.Data.CurrentStatus.Should().Be(ApplicationStates.Screening);
        app.ApplicationStatusHistories.Should().ContainSingle(h =>
            h.OldStatus == ApplicationStates.Submitted && h.NewStatus == ApplicationStates.Screening);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _auditLogService.Verify(a => a.AddAsync(
            It.Is<AuditEntry>(e => e.Action == AuditActions.ApplicationStatusChanged), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Client_OpeningSubmittedCvApplication_ShouldMoveToScreening()
    {
        var app = Setup("CV_APPLICATION", ApplicationStates.Submitted);

        var result = await CreateHandler().Handle(
            new StartScreeningCommand(app.JobId, app.ApplicationId, _clientUserId, ScreeningActor.ClientCompany),
            CancellationToken.None);

        result.Data.Changed.Should().BeTrue();
        app.Status.Should().Be(ApplicationStates.Screening);
    }

    [Fact]
    public async Task InternalHr_OpeningCvApplication_ShouldNotChangeStatus()
    {
        var app = Setup("CV_APPLICATION", ApplicationStates.Submitted);

        var result = await CreateHandler().Handle(
            new StartScreeningCommand(app.JobId, app.ApplicationId, Guid.NewGuid(), ScreeningActor.InternalHr),
            CancellationToken.None);

        result.Data.Changed.Should().BeFalse();
        app.Status.Should().Be(ApplicationStates.Submitted);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Client_OpeningUnshortlistedHeadhunt_ShouldNotFind()
    {
        var app = Setup("HEADHUNT_COD", ApplicationStates.Submitted);

        var act = () => CreateHandler().Handle(
            new StartScreeningCommand(app.JobId, app.ApplicationId, _clientUserId, ScreeningActor.ClientCompany),
            CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
        app.Status.Should().Be(ApplicationStates.Submitted);
    }

    [Fact]
    public async Task Client_FromAnotherCompany_ShouldNotFind()
    {
        var app = Setup("CV_APPLICATION", ApplicationStates.Submitted, companyId: Guid.NewGuid());

        var act = () => CreateHandler().Handle(
            new StartScreeningCommand(app.JobId, app.ApplicationId, _clientUserId, ScreeningActor.ClientCompany),
            CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    private HRConnect.Domain.Entities.Application Setup(string serviceType, string status, Guid? companyId = null)
    {
        var jobId = Guid.NewGuid();
        var app = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = Guid.NewGuid(),
            JobId = jobId,
            Job = new Job
            {
                JobId = jobId,
                CompanyId = companyId ?? _companyId,
                ServiceType = new ServiceType { Code = serviceType, Name = serviceType }
            },
            Status = status,
            ConcurrencyToken = Guid.NewGuid(),
            AppliedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _applicationRepository.Setup(r => r.GetByIdAsync(app.ApplicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);
        return app;
    }
}
