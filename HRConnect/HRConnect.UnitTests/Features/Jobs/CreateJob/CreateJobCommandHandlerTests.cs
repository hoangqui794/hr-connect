using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Commands.CreateJob;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;

namespace HRConnect.UnitTests.Features.Jobs.CreateJob;

public class CreateJobCommandHandlerTests
{
    private readonly Mock<ICompanyUserRepository> _companyUserRepository = new();
    private readonly Mock<IJobRepository> _jobRepository = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly CreateJobCommandHandler _handler;

    public CreateJobCommandHandlerTests()
    {
        _handler = new CreateJobCommandHandler(
            _companyUserRepository.Object,
            _jobRepository.Object,
            _unitOfWork.Object,
            Mock.Of<ILogger<CreateJobCommandHandler>>());
    }

    [Fact]
    public async Task Handle_ShouldCreateDraftWithRequirementsAndStatusHistory()
    {
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var serviceTypeId = Guid.NewGuid();
        var command = new CreateJobCommand
        {
            UserId = userId,
            ServiceTypeId = serviceTypeId,
            Title = "  Senior .NET Developer  ",
            Benefits = "  KPI bonus, insurance and training  ",
            EmploymentType = " full_time ",
            MinExperienceYears = 3,
            MaxExperienceYears = 5,
            SalaryMin = 15_000_000,
            SalaryMax = null,
            SalaryNegotiable = true,
            SalaryNote = "  Thỏa thuận theo năng lực khi phỏng vấn.  ",
            CurrencyCode = "vnd",
            Visibility = "public",
            Requirements =
            [
                new CreateJobRequirementRequest
                {
                    RequirementType = "must_have",
                    Category = " Experience ",
                    Content = " 3 years of .NET experience ",
                    Weight = 0.8m
                }
            ],
            Skills = [new JobSkillRequest { SkillId = Guid.NewGuid(), IsMandatory = true, Weight = 0.9m }]
        };

        _companyUserRepository
            .Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateActiveCompanyUser(userId, companyId));
        _jobRepository
            .Setup(repository => repository.GetActiveServiceTypeCodeAsync(serviceTypeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ServiceTypeCodes.CvApplication);
        _jobRepository
            .Setup(repository => repository.AreSkillsActiveAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        Job? createdJob = null;
        _jobRepository
            .Setup(repository => repository.AddAsync(It.IsAny<Job>(), It.IsAny<CancellationToken>()))
            .Callback<Job, CancellationToken>((job, _) => createdJob = job)
            .Returns(Task.CompletedTask);

        var result = await _handler.Handle(command, CancellationToken.None);

        createdJob.Should().NotBeNull();
        createdJob!.CompanyId.Should().Be(companyId);
        createdJob.CreatedBy.Should().Be(userId);
        createdJob.ServiceTypeId.Should().Be(serviceTypeId);
        createdJob.Title.Should().Be("Senior .NET Developer");
        createdJob.Benefits.Should().Be("KPI bonus, insurance and training");
        createdJob.EmploymentType.Should().Be("FULL_TIME");
        createdJob.MinExperienceYears.Should().Be(3);
        createdJob.MaxExperienceYears.Should().Be(5);
        createdJob.SalaryMin.Should().Be(15_000_000);
        createdJob.SalaryMax.Should().BeNull();
        createdJob.SalaryNegotiable.Should().BeTrue();
        createdJob.SalaryNote.Should().Be("Thỏa thuận theo năng lực khi phỏng vấn.");
        createdJob.CurrencyCode.Should().Be("VND");
        createdJob.Status.Should().Be("DRAFT");
        createdJob.PostedAt.Should().BeNull();
        createdJob.ClosedAt.Should().BeNull();
        createdJob.JobRequirements.Should().ContainSingle();
        createdJob.JobRequirements.Single().RequirementType.Should().Be("MUST_HAVE");
        createdJob.JobRequirements.Single().Content.Should().Be("3 years of .NET experience");
        createdJob.JobSkills.Should().ContainSingle(skill => skill.IsMandatory && skill.Weight == 0.9m);
        createdJob.JobStatusHistories.Should().ContainSingle(history =>
            history.OldStatus == null &&
            history.NewStatus == "DRAFT" &&
            history.ChangedBy == userId);

        result.Success.Should().BeTrue();
        result.Data.JobId.Should().Be(createdJob.JobId);
        result.Data.Benefits.Should().Be("KPI bonus, insurance and training");
        result.Data.MinExperienceYears.Should().Be(3);
        result.Data.MaxExperienceYears.Should().Be(5);
        result.Data.SalaryNegotiable.Should().BeTrue();
        result.Data.SalaryNote.Should().Be("Thỏa thuận theo năng lực khi phỏng vấn.");
        result.Data.Status.Should().Be("DRAFT");
        result.Data.RequirementCount.Should().Be(1);
        result.Data.SkillCount.Should().Be(1);
        _unitOfWork.Verify(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldAllowDraftWithoutTitleOrRequirements()
    {
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var serviceTypeId = Guid.NewGuid();
        var command = new CreateJobCommand
        {
            UserId = userId,
            ServiceTypeId = serviceTypeId
        };

        _companyUserRepository
            .Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateActiveCompanyUser(userId, companyId));
        _jobRepository
            .Setup(repository => repository.GetActiveServiceTypeCodeAsync(serviceTypeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ServiceTypeCodes.CvApplication);

        Job? createdJob = null;
        _jobRepository
            .Setup(repository => repository.AddAsync(It.IsAny<Job>(), It.IsAny<CancellationToken>()))
            .Callback<Job, CancellationToken>((job, _) => createdJob = job)
            .Returns(Task.CompletedTask);

        await _handler.Handle(command, CancellationToken.None);

        createdJob.Should().NotBeNull();
        createdJob!.Title.Should().BeEmpty();
        createdJob.Benefits.Should().BeNull();
        createdJob.JobRequirements.Should().BeEmpty();
        createdJob.Status.Should().Be("DRAFT");
    }

    [Fact]
    public async Task Handle_ShouldRejectUserWithoutCompanyMembership()
    {
        var command = new CreateJobCommand
        {
            UserId = Guid.NewGuid(),
            ServiceTypeId = Guid.NewGuid()
        };

        _companyUserRepository
            .Setup(repository => repository.GetByUserIdAsync(command.UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CompanyUser?)null);

        var action = () => _handler.Handle(command, CancellationToken.None);

        await action.Should().ThrowAsync<ForbiddenException>();
        _jobRepository.Verify(
            repository => repository.AddAsync(It.IsAny<Job>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Handle_ShouldRejectUnverifiedCompany()
    {
        var userId = Guid.NewGuid();
        var companyUser = CreateActiveCompanyUser(userId, Guid.NewGuid());
        companyUser.Company.VerificationStatus = "UNDER_REVIEW";
        var command = new CreateJobCommand
        {
            UserId = userId,
            ServiceTypeId = Guid.NewGuid()
        };

        _companyUserRepository
            .Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(companyUser);

        var action = () => _handler.Handle(command, CancellationToken.None);

        await action.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task Handle_ShouldRejectInactiveOrUnknownServiceType()
    {
        var userId = Guid.NewGuid();
        var serviceTypeId = Guid.NewGuid();
        var command = new CreateJobCommand
        {
            UserId = userId,
            ServiceTypeId = serviceTypeId
        };

        _companyUserRepository
            .Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateActiveCompanyUser(userId, Guid.NewGuid()));
        _jobRepository
            .Setup(repository => repository.GetActiveServiceTypeCodeAsync(serviceTypeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((string?)null);

        var action = () => _handler.Handle(command, CancellationToken.None);

        await action.Should().ThrowAsync<BadRequestException>();
        _unitOfWork.Verify(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData(ServiceTypeCodes.CvApplication, JobVisibilities.PartnerOnly)]
    [InlineData(ServiceTypeCodes.CvSourcing, JobVisibilities.Public)]
    [InlineData(ServiceTypeCodes.HeadhuntCod, JobVisibilities.Public)]
    public async Task Handle_ShouldRejectVisibilityOutsideServiceTypeMatrix(string serviceTypeCode, string visibility)
    {
        var userId = Guid.NewGuid();
        var serviceTypeId = Guid.NewGuid();
        _companyUserRepository
            .Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateActiveCompanyUser(userId, Guid.NewGuid()));
        _jobRepository
            .Setup(repository => repository.GetActiveServiceTypeCodeAsync(serviceTypeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(serviceTypeCode);

        var action = () => _handler.Handle(new CreateJobCommand
        {
            UserId = userId,
            ServiceTypeId = serviceTypeId,
            Visibility = visibility
        }, CancellationToken.None);

        await action.Should().ThrowAsync<BadRequestException>();
        _jobRepository.Verify(repository => repository.AddAsync(
            It.IsAny<Job>(), It.IsAny<CancellationToken>()), Times.Never);
        _unitOfWork.Verify(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    private static CompanyUser CreateActiveCompanyUser(Guid userId, Guid companyId)
    {
        return new CompanyUser
        {
            CompanyUserId = Guid.NewGuid(),
            UserId = userId,
            CompanyId = companyId,
            Status = "ACTIVE",
            Company = new Company
            {
                CompanyId = companyId,
                CompanyName = "Verified Company",
                VerificationStatus = "VERIFIED"
            }
        };
    }
}
