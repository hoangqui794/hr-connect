using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Placements.Queries.GetPlacementDetail;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Placements;

public class GetPlacementDetailQueryHandlerTests
{
    private readonly Mock<IPlacementRepository> _placementRepositoryMock = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock = new();
    private readonly Mock<ILogger<GetPlacementDetailQueryHandler>> _loggerMock = new();

    private GetPlacementDetailQueryHandler CreateHandler() =>
        new(
            _placementRepositoryMock.Object,
            _companyUserRepositoryMock.Object,
            _loggerMock.Object);

    [Fact]
    public async Task Handle_WhenPlacementNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var placementId = Guid.NewGuid();
        _placementRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(placementId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Placement?)null);

        var query = new GetPlacementDetailQuery(
            PlacementId: placementId,
            CurrentUserId: Guid.NewGuid(),
            IsInternalHrOrAdmin: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_WhenClientUserNotBelongingToAnyCompany_ShouldThrowForbiddenException()
    {
        // Arrange
        var placementId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        _placementRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(placementId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Placement { PlacementId = placementId });

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CompanyUser?)null);

        var query = new GetPlacementDetailQuery(
            PlacementId: placementId,
            CurrentUserId: userId,
            IsClientCompanyUser: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*không thuộc doanh nghiệp*");
    }

    [Fact]
    public async Task Handle_WhenClientUserOfDifferentCompany_ShouldThrowForbiddenException()
    {
        // Arrange
        var placementId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var jobCompanyId = Guid.NewGuid();
        var userCompanyId = Guid.NewGuid();

        var placement = new Placement
        {
            PlacementId = placementId,
            Application = new Domain.Entities.Application
            {
                Job = new Job { CompanyId = jobCompanyId }
            }
        };

        _placementRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(placementId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(placement);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = userCompanyId, Status = "ACTIVE" });

        var query = new GetPlacementDetailQuery(
            PlacementId: placementId,
            CurrentUserId: userId,
            IsClientCompanyUser: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*doanh nghiệp khác*");
    }

    [Fact]
    public async Task Handle_WhenCandidateAccessingDifferentCandidatePlacement_ShouldThrowForbiddenException()
    {
        // Arrange
        var placementId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid(); // different user

        var placement = new Placement
        {
            PlacementId = placementId,
            Application = new Domain.Entities.Application
            {
                Candidate = new Candidate { UserId = candidateUserId }
            }
        };

        _placementRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(placementId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(placement);

        var query = new GetPlacementDetailQuery(
            PlacementId: placementId,
            CurrentUserId: userId,
            IsCandidate: true
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*không có quyền xem*");
    }

    [Fact]
    public async Task Handle_WhenUserHasNoPermissions_ShouldThrowForbiddenException()
    {
        // Arrange
        var placementId = Guid.NewGuid();
        _placementRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(placementId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Placement { PlacementId = placementId });

        var query = new GetPlacementDetailQuery(
            PlacementId: placementId,
            CurrentUserId: Guid.NewGuid(),
            IsClientCompanyUser: false,
            IsInternalHrOrAdmin: false,
            IsCandidate: false
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task Handle_WhenValidClientUser_ShouldReturnReadOnlyPlacementActions()
    {
        // Arrange
        var placementId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();

        var placement = new Placement
        {
            PlacementId = placementId,
            ApplicationId = Guid.NewGuid(),
            OfferId = Guid.NewGuid(),
            ActualStartDate = new DateOnly(2026, 10, 1),
            Position = "Tech Lead",
            Department = "R&D",
            Status = "STARTED",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Application = new Domain.Entities.Application
            {
                Candidate = new Candidate
                {
                    CandidateId = Guid.NewGuid(),
                    FullName = "Jane Doe",
                    Email = "jane@example.com",
                    Phone = "0987654321"
                },
                Job = new Job
                {
                    JobId = Guid.NewGuid(),
                    Title = "Tech Lead",
                    CompanyId = companyId,
                    Company = new Company { CompanyName = "Acme Corp" }
                }
            },
            Offer = new Offer
            {
                OfferId = Guid.NewGuid(),
                Salary = 45000000,
                CurrencyCode = "VND",
                Status = "ACCEPTED"
            },
            Probation = new Probation
            {
                ProbationId = Guid.NewGuid(),
                StartDate = new DateOnly(2026, 10, 1),
                EndDate = new DateOnly(2026, 12, 1),
                Result = "PENDING"
            },
            Warranty = new Warranty
            {
                WarrantyId = Guid.NewGuid(),
                StartDate = new DateOnly(2026, 10, 1),
                EndDate = new DateOnly(2026, 11, 1),
                Status = "ACTIVE"
            }
        };

        _placementRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(placementId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(placement);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId, Status = "ACTIVE" });

        var query = new GetPlacementDetailQuery(
            PlacementId: placementId,
            CurrentUserId: userId,
            IsClientCompanyUser: true
        );

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.PlacementId.Should().Be(placementId);
        result.Position.Should().Be("Tech Lead");
        result.Candidate.FullName.Should().Be("Jane Doe");
        result.Job.CompanyName.Should().Be("Acme Corp");
        result.Offer.Salary.Should().Be(45000000);
        result.Probation.Should().NotBeNull();
        result.Probation!.Result.Should().Be("PENDING");
        result.Warranty.Should().NotBeNull();
        result.Warranty!.Status.Should().Be("ACTIVE");
        result.AllowedActions.Should().Contain("VIEW_PLACEMENT");
        result.AllowedActions.Should().NotContain(["MANAGE_PLACEMENT", "MARK_NOT_STARTED"]);
        result.AllowedActions.Should().Contain("VIEW_PROBATION");
        result.AllowedActions.Should().Contain("VIEW_WARRANTY");
    }

    [Fact]
    public async Task Handle_WhenInternalHrReadsPlacement_ShouldReturnReadOnlyActions()
    {
        var placementId = Guid.NewGuid();
        _placementRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(placementId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Placement
            {
                PlacementId = placementId,
                Status = "STARTED",
                Application = new HRConnect.Domain.Entities.Application
                {
                    Candidate = new Candidate(),
                    Job = new Job { Company = new Company() }
                },
                Offer = new Offer()
            });

        var result = await CreateHandler().Handle(new GetPlacementDetailQuery(
            placementId,
            Guid.NewGuid(),
            IsInternalHrOrAdmin: true), CancellationToken.None);

        result.AllowedActions.Should().ContainSingle().Which.Should().Be("VIEW_PLACEMENT");
    }
}
