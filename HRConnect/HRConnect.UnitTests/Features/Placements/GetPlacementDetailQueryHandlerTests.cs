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
    private readonly Mock<IFinanceRepository> _financeRepositoryMock = new();
    private readonly Mock<ILogger<GetPlacementDetailQueryHandler>> _loggerMock = new();

    private GetPlacementDetailQueryHandler CreateHandler(bool withFinanceRepo = false) =>
        new(
            _placementRepositoryMock.Object,
            _companyUserRepositoryMock.Object,
            _loggerMock.Object,
            withFinanceRepo ? _financeRepositoryMock.Object : null);

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
    public async Task Handle_WhenCandidateReadsOwnPlacement_ShouldHideInternalOperationalNotes()
    {
        var placementId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();
        var internalUserId = Guid.NewGuid();
        var placement = new Placement
        {
            PlacementId = placementId,
            ApplicationId = Guid.NewGuid(),
            OfferId = Guid.NewGuid(),
            ActualStartDate = new DateOnly(2026, 11, 5),
            Status = "STARTED",
            ConfirmedAt = DateTime.UtcNow,
            ConfirmedBy = internalUserId,
            ConfirmationNote = "Internal confirmation note",
            ConfirmedByNavigation = new AppUser
            {
                UserId = internalUserId,
                DisplayName = "Internal recruiter"
            },
            Application = new Domain.Entities.Application
            {
                Candidate = new Candidate
                {
                    CandidateId = Guid.NewGuid(),
                    UserId = candidateUserId,
                    FullName = "Candidate Owner"
                },
                Job = new Job { Company = new Company() }
            },
            Offer = new Offer(),
            Probation = new Probation
            {
                ProbationId = Guid.NewGuid(),
                StartDate = new DateOnly(2026, 11, 5),
                Notes = "Internal probation note"
            },
            Warranty = new Warranty
            {
                WarrantyId = Guid.NewGuid(),
                StartDate = new DateOnly(2026, 11, 5),
                Status = "ACTIVE",
                ResultNote = "Internal warranty note"
            }
        };

        _placementRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(placementId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(placement);

        var result = await CreateHandler().Handle(
            new GetPlacementDetailQuery(placementId, candidateUserId, IsCandidate: true),
            CancellationToken.None);

        result.ConfirmedBy.Should().BeNull();
        result.ConfirmedByName.Should().BeNull();
        result.ConfirmationNote.Should().BeNull();
        result.Probation!.Notes.Should().BeNull();
        result.Warranty!.ResultNote.Should().BeNull();
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
            ReplacementSlotId = Guid.NewGuid(),
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
            },
            ReplacementSlot = new ReplacementSlot
            {
                OriginalPlacementId = Guid.NewGuid()
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
        result.IsReplacement.Should().BeTrue();
        result.ReplacementSlotId.Should().Be(placement.ReplacementSlotId);
        result.ReplacesPlacementId.Should().Be(placement.ReplacementSlot!.OriginalPlacementId);
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

    private static Placement PlacementWithMoney(Guid placementId, Guid companyId, Guid candidateUserId) => new()
    {
        PlacementId = placementId,
        Status = "STARTED",
        Application = new HRConnect.Domain.Entities.Application
        {
            Candidate = new Candidate { UserId = candidateUserId },
            Job = new Job { CompanyId = companyId, Company = new Company() }
        },
        Offer = new Offer(),
        ServiceFee = new ServiceFee { Amount = 36000000m, Status = "PAID" },
        Commissions =
        {
            new Commission { Amount = 1000000m, Status = "PAID", CreatedAt = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc) },
            new Commission { Amount = 12000000m, Status = "EARNED", CreatedAt = new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc) }
        }
    };

    [Fact]
    public async Task Handle_WhenInternalHr_ShouldReturnServiceFeeAndLatestCommission()
    {
        var placementId = Guid.NewGuid();
        _placementRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(placementId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(PlacementWithMoney(placementId, Guid.NewGuid(), Guid.NewGuid()));

        var result = await CreateHandler().Handle(
            new GetPlacementDetailQuery(placementId, Guid.NewGuid(), IsInternalHrOrAdmin: true), CancellationToken.None);

        result.Financial.Should().NotBeNull();
        result.Financial!.ServiceFeeAmount.Should().Be(36000000m);
        result.Financial.ServiceFeeStatus.Should().Be("PAID");
        result.Financial.CommissionAmount.Should().Be(12000000m);
        result.Financial.CommissionStatus.Should().Be("EARNED");
    }

    [Fact]
    public async Task Handle_WhenClient_ShouldReturnServiceFeeButNeverCommission()
    {
        var placementId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        _placementRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(placementId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(PlacementWithMoney(placementId, companyId, Guid.NewGuid()));
        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId, Status = "ACTIVE" });

        var result = await CreateHandler().Handle(
            new GetPlacementDetailQuery(placementId, userId, IsClientCompanyUser: true), CancellationToken.None);

        result.Financial.Should().NotBeNull();
        result.Financial!.ServiceFeeAmount.Should().Be(36000000m);
        result.Financial.ServiceFeeStatus.Should().Be("PAID");
        result.Financial.CommissionAmount.Should().BeNull();
        result.Financial.CommissionStatus.Should().BeNull();
    }

    [Fact]
    public async Task Handle_WhenCandidate_ShouldNotReturnFinancial()
    {
        var placementId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();
        _placementRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(placementId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(PlacementWithMoney(placementId, Guid.NewGuid(), candidateUserId));

        var result = await CreateHandler().Handle(
            new GetPlacementDetailQuery(placementId, candidateUserId, IsCandidate: true), CancellationToken.None);

        result.Financial.Should().BeNull();
    }

    [Fact]
    public async Task Handle_WhenNoServiceFeeOrCommission_ShouldNotReturnFinancial()
    {
        var placementId = Guid.NewGuid();
        _placementRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(placementId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Placement
            {
                PlacementId = placementId,
                Status = "STARTED",
                Application = new HRConnect.Domain.Entities.Application { Candidate = new Candidate(), Job = new Job { Company = new Company() } },
                Offer = new Offer()
            });

        var result = await CreateHandler().Handle(
            new GetPlacementDetailQuery(placementId, Guid.NewGuid(), IsInternalHrOrAdmin: true), CancellationToken.None);

        result.Financial.Should().BeNull();
    }

    [Fact]
    public async Task Handle_WhenResignedAndSlotOpened_ShouldReturnFinancialDetailsResignationAndReplacementForClient()
    {
        var placementId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var jobId = Guid.NewGuid();
        var warrantyId = Guid.NewGuid();
        var feeId = Guid.NewGuid();
        var slotId = Guid.NewGuid();
        var dueDate = new DateOnly(2026, 11, 20);
        var paidAt = new DateTime(2026, 11, 10, 8, 0, 0, DateTimeKind.Utc);
        var reportedAt = new DateTime(2026, 11, 12, 9, 30, 0, DateTimeKind.Utc);
        var expiresAt = new DateTime(2026, 12, 12, 9, 30, 0, DateTimeKind.Utc);

        var placement = new Placement
        {
            PlacementId = placementId,
            Status = "LEFT_DURING_WARRANTY",
            Application = new HRConnect.Domain.Entities.Application
            {
                JobId = jobId,
                Candidate = new Candidate { UserId = Guid.NewGuid(), FullName = "Nguyễn Văn B" },
                Job = new Job { JobId = jobId, CompanyId = companyId, Title = "Tech Lead", Company = new Company { CompanyName = "ACME" } },
            },
            Offer = new Offer(),
            ServiceFee = new ServiceFee
            {
                ServiceFeeId = feeId,
                Amount = 50_000_000m,
                Status = "PAID",
                DueDate = dueDate,
                PaidAt = paidAt,
            },
            Warranty = new Warranty
            {
                WarrantyId = warrantyId,
                StartDate = new DateOnly(2026, 10, 1),
                EndDate = new DateOnly(2026, 12, 1),
                Status = "VOIDED",
                ResultNote = "Client báo nghỉ, ngày làm việc cuối 2026-11-11: Chuyển công tác | Internal HR xác nhận: Đã đối chiếu",
                UpdatedAt = DateTime.UtcNow,
            },
        };

        _placementRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(placementId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(placement);
        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId, Status = "ACTIVE" });
        _financeRepositoryMock
            .Setup(r => r.GetWarrantyClaimAuditLogsAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([
                new AuditLog
                {
                    Action = "WARRANTY_CLAIM_REPORTED",
                    EntityType = "WARRANTY",
                    EntityId = warrantyId,
                    CreatedAt = reportedAt,
                }
            ]);
        _financeRepositoryMock
            .Setup(r => r.GetReplacementSlotsByOriginalPlacementIdsAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([
                new ReplacementSlot
                {
                    ReplacementSlotId = slotId,
                    JobId = jobId,
                    Status = "OPEN",
                    ExpiresAt = expiresAt,
                }
            ]);

        var result = await CreateHandler(withFinanceRepo: true).Handle(
            new GetPlacementDetailQuery(placementId, userId, IsClientCompanyUser: true), CancellationToken.None);

        result.Financial.Should().NotBeNull();
        result.Financial!.ServiceFeeId.Should().Be(feeId);
        result.Financial.ServiceFeeDueDate.Should().Be(dueDate);
        result.Financial.ServiceFeePaidAt.Should().Be(paidAt);
        result.Financial.CommissionAmount.Should().BeNull();

        result.Resignation.Should().NotBeNull();
        result.Resignation!.ReportedAt.Should().Be(reportedAt);
        result.Resignation.LastWorkingDate.Should().Be(new DateOnly(2026, 11, 11));
        result.Resignation.Reason.Should().Be("Chuyển công tác");
        result.Resignation.ReviewStatus.Should().Be("CONFIRMED");
        result.Resignation.ReviewNote.Should().Contain("xác nhận: Đã đối chiếu");
        result.Resignation.ResignedBy.Should().Be("CLIENT");

        result.Replacement.Should().NotBeNull();
        result.Replacement!.ReplacementSlotId.Should().Be(slotId);
        result.Replacement.Status.Should().Be("OPEN");
        result.Replacement.ExpiresAt.Should().Be(expiresAt);
    }

    [Fact]
    public async Task Handle_WhenCandidateWithResignation_ShouldHideFinancialReplacementAndHrNote()
    {
        var placementId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();
        var placement = new Placement
        {
            PlacementId = placementId,
            Status = "LEFT_DURING_WARRANTY",
            Application = new HRConnect.Domain.Entities.Application
            {
                Candidate = new Candidate { UserId = candidateUserId, FullName = "Ứng viên A" },
                Job = new Job { CompanyId = Guid.NewGuid(), Company = new Company() },
            },
            Offer = new Offer(),
            ServiceFee = new ServiceFee { ServiceFeeId = Guid.NewGuid(), Amount = 20_000_000m, Status = "PAID" },
            Warranty = new Warranty
            {
                WarrantyId = Guid.NewGuid(),
                Status = "VOIDED",
                ResultNote = "Client báo nghỉ, ngày làm việc cuối 2026-11-05: Lý do cá nhân | Internal HR xác nhận: Ghi chú nội bộ",
            },
        };

        _placementRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(placementId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(placement);

        var result = await CreateHandler(withFinanceRepo: true).Handle(
            new GetPlacementDetailQuery(placementId, candidateUserId, IsCandidate: true), CancellationToken.None);

        result.Financial.Should().BeNull();
        result.Replacement.Should().BeNull();
        result.Resignation.Should().NotBeNull();
        result.Resignation!.Reason.Should().Be("Lý do cá nhân");
        result.Resignation.ReviewNote.Should().BeNull();
    }
}
