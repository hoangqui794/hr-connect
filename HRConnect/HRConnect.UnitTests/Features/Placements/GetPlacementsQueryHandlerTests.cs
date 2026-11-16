using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Placements.Queries.GetPlacements;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Placements;

public class GetPlacementsQueryHandlerTests
{
    private readonly Mock<IPlacementRepository> _placementRepositoryMock = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock = new();
    private readonly Mock<ILogger<GetPlacementsQueryHandler>> _loggerMock = new();

    private GetPlacementsQueryHandler CreateHandler() =>
        new(
            _placementRepositoryMock.Object,
            _companyUserRepositoryMock.Object,
            _loggerMock.Object);

    [Fact]
    public async Task Handle_WhenClientUserNotBelongingToAnyCompany_ShouldThrowForbiddenException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CompanyUser?)null);

        var query = new GetPlacementsQuery(
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
    public async Task Handle_WhenUserHasNoPermission_ShouldThrowForbiddenException()
    {
        // Arrange
        var query = new GetPlacementsQuery(
            CurrentUserId: Guid.NewGuid(),
            IsClientCompanyUser: false,
            IsInternalHrOrAdmin: false
        );

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*không có quyền xem*");
    }

    [Fact]
    public async Task Handle_WhenClientCompanyUser_ShouldScopeToCompanyAndReturnPlacements()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId, Status = "ACTIVE" });

        var placementList = new List<Placement>
        {
            new()
            {
                PlacementId = Guid.NewGuid(),
                ApplicationId = Guid.NewGuid(),
                OfferId = Guid.NewGuid(),
                ActualStartDate = new DateOnly(2026, 10, 1),
                Position = "Backend Developer",
                Department = "Engineering",
                Status = "STARTED",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                Application = new Domain.Entities.Application
                {
                    ApplicationId = Guid.NewGuid(),
                    Candidate = new Candidate
                    {
                        CandidateId = Guid.NewGuid(),
                        FullName = "John Doe",
                        Email = "john@example.com"
                    },
                    Job = new Job
                    {
                        JobId = Guid.NewGuid(),
                        Title = "Backend Developer",
                        CompanyId = companyId,
                        Company = new Company { CompanyName = "Tech Corp" }
                    }
                }
            }
        };

        _placementRepositoryMock
            .Setup(r => r.GetPlacementsAsync(
                companyId,
                It.IsAny<Guid?>(),
                It.IsAny<Guid?>(),
                It.IsAny<string?>(),
                "Backend",
                It.IsAny<DateOnly?>(),
                It.IsAny<DateOnly?>(),
                1,
                10,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((placementList, 1));

        var query = new GetPlacementsQuery(
            CurrentUserId: userId,
            Keyword: "Backend",
            Page: 1,
            PageSize: 10,
            IsClientCompanyUser: true
        );

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Items.Should().HaveCount(1);
        result.TotalCount.Should().Be(1);
        result.TotalPages.Should().Be(1);
        result.Items[0].Candidate.FullName.Should().Be("John Doe");
        result.Items[0].Job.CompanyName.Should().Be("Tech Corp");
    }

    [Fact]
    public async Task Handle_WhenInternalHrOrAdmin_ShouldAllowCompanyFilter()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var targetCompanyId = Guid.NewGuid();

        _placementRepositoryMock
            .Setup(r => r.GetPlacementsAsync(
                targetCompanyId,
                It.IsAny<Guid?>(),
                It.IsAny<Guid?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<DateOnly?>(),
                It.IsAny<DateOnly?>(),
                1,
                20,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((new List<Placement>(), 0));

        var query = new GetPlacementsQuery(
            CurrentUserId: userId,
            CompanyId: targetCompanyId,
            Page: -1, // should clamp to 1
            PageSize: 20,
            IsInternalHrOrAdmin: true
        );

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Items.Should().BeEmpty();
        result.Page.Should().Be(1);
        result.PageSize.Should().Be(20);

        _placementRepositoryMock.Verify(r => r.GetPlacementsAsync(
            targetCompanyId,
            null,
            null,
            null,
            null,
            null,
            null,
            1,
            20,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenPlacementHasWarrantyFeeReplacementAndResignation_ShouldMapEnrichedFields()
    {
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId, Status = "ACTIVE" });

        var claimedPlacement = new Placement
        {
            PlacementId = Guid.NewGuid(),
            ApplicationId = Guid.NewGuid(),
            OfferId = Guid.NewGuid(),
            ActualStartDate = new DateOnly(2026, 10, 1),
            Status = "LEFT_DURING_WARRANTY",
            ReplacementSlotId = Guid.NewGuid(),
            UpdatedAt = new DateTime(2026, 10, 20, 0, 0, 0, DateTimeKind.Utc),
            CreatedAt = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc),
            Warranty = new Warranty
            {
                EndDate = new DateOnly(2026, 11, 1),
                Status = "VOIDED",
                ResultNote = "Client báo nghỉ, ngày làm việc cuối 2026-10-15: Ứng viên tự xin nghỉ | Internal HR xác nhận: Đã kiểm tra"
            },
            ServiceFee = new ServiceFee { Status = "PAID" },
            Application = new Domain.Entities.Application
            {
                Candidate = new Candidate { CandidateId = Guid.NewGuid(), FullName = "Nguyen Van B", Email = "b@example.com" },
                Job = new Job
                {
                    JobId = Guid.NewGuid(),
                    Title = "Senior QA",
                    CompanyId = companyId,
                    Company = new Company { CompanyName = "Tech Corp" },
                    ServiceType = new ServiceType { Code = "HEADHUNT_COD" }
                }
            }
        };

        var normalPlacement = new Placement
        {
            PlacementId = Guid.NewGuid(),
            ApplicationId = Guid.NewGuid(),
            OfferId = Guid.NewGuid(),
            ActualStartDate = new DateOnly(2026, 10, 5),
            Status = "STARTED",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Application = new Domain.Entities.Application
            {
                Candidate = new Candidate { CandidateId = Guid.NewGuid(), FullName = "Le Thi C", Email = "c@example.com" },
                Job = new Job { JobId = Guid.NewGuid(), Title = "Tester", CompanyId = companyId, Company = new Company { CompanyName = "Tech Corp" } }
            }
        };

        _placementRepositoryMock
            .Setup(r => r.GetPlacementsAsync(
                companyId, null, null, null, null, null, null, 1, 10, It.IsAny<CancellationToken>()))
            .ReturnsAsync(([claimedPlacement, normalPlacement], 2));

        var result = await CreateHandler().Handle(
            new GetPlacementsQuery(CurrentUserId: userId, IsClientCompanyUser: true),
            CancellationToken.None);

        var first = result.Items[0];
        first.WarrantyEndDate.Should().Be(new DateOnly(2026, 11, 1));
        first.WarrantyStatus.Should().Be("VOIDED");
        first.ServiceFeeStatus.Should().Be("PAID");
        first.IsReplacement.Should().BeTrue();
        first.ServiceTypeCode.Should().Be("HEADHUNT_COD");
        first.EndDate.Should().Be(new DateOnly(2026, 10, 15));
        first.ResignationReason.Should().Be("Ứng viên tự xin nghỉ");
        first.ResignedBy.Should().Be("CLIENT");

        var second = result.Items[1];
        second.WarrantyEndDate.Should().BeNull();
        second.WarrantyStatus.Should().BeNull();
        second.ServiceFeeStatus.Should().BeNull();
        second.IsReplacement.Should().BeFalse();
        second.ServiceTypeCode.Should().BeNull();
        second.EndDate.Should().BeNull();
        second.ResignationReason.Should().BeNull();
        second.ResignedBy.Should().BeNull();
    }
}
