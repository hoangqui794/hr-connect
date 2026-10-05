using FluentAssertions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Admin.Approvals.GetApprovalList;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Admin.Approvals;

public class GetApprovalListQueryHandlerTests
{
    private readonly Mock<IApprovalRepository> _approvalRepositoryMock;
    private readonly GetApprovalListQueryHandler _handler;

    public GetApprovalListQueryHandlerTests()
    {
        _approvalRepositoryMock = new Mock<IApprovalRepository>();
        _handler = new GetApprovalListQueryHandler(_approvalRepositoryMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldReturnPaginatedList_WithDefaults()
    {
        // Arrange
        var items = new List<ApprovalListItemDto>
        {
            new()
            {
                ApprovalId = Guid.NewGuid(),
                Type = "AFFILIATE",
                UserId = Guid.NewGuid(),
                Email = "affiliate@example.com",
                DisplayName = "Nguyen Van A",
                Status = "UNDER_REVIEW",
                SubmittedAt = DateTime.UtcNow
            },
            new()
            {
                ApprovalId = Guid.NewGuid(),
                Type = "CLIENT",
                UserId = Guid.NewGuid(),
                Email = "client@example.com",
                DisplayName = "Tran Thi B",
                CompanyName = "ABC Corp",
                Status = "UNDER_REVIEW",
                SubmittedAt = DateTime.UtcNow
            }
        };

        _approvalRepositoryMock.Setup(r => r.GetApprovalsAsync(
                null,
                null,
                null,
                "submittedAt",
                "desc",
                1,
                20,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((items, 2));

        var query = new GetApprovalListQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Items.Should().HaveCount(2);
        result.Data.Total.Should().Be(2);
        result.Data.Page.Should().Be(1);
        result.Data.PageSize.Should().Be(20);
        result.Data.TotalPages.Should().Be(1);
    }

    [Fact]
    public async Task Handle_ShouldNormalizeParameters_WhenCustomParametersProvided()
    {
        // Arrange
        _approvalRepositoryMock.Setup(r => r.GetApprovalsAsync(
                "AFFILIATE",
                "UNDER_REVIEW",
                "test",
                "status",
                "asc",
                2,
                10,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((new List<ApprovalListItemDto>(), 15));

        var query = new GetApprovalListQuery(
            Type: "affiliate",
            Status: "under_review",
            Search: "  test  ",
            Page: 2,
            PageSize: 10,
            SortBy: "STATUS",
            SortDirection: "ASC"
        );

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Data.Page.Should().Be(2);
        result.Data.PageSize.Should().Be(10);
        result.Data.Total.Should().Be(15);
        result.Data.TotalPages.Should().Be(2);
    }

    [Theory]
    [InlineData("UNDER_REVIEW", true)]
    [InlineData("approved", true)]
    [InlineData("REJECTED", true)]
    [InlineData("PENDING", false)]
    [InlineData("UNKNOWN", false)]
    public void Validator_ShouldAcceptOnlyAdminReviewStatuses(string status, bool expectedValid)
    {
        var validator = new GetApprovalListQueryValidator();

        var result = validator.Validate(new GetApprovalListQuery(Status: status));

        result.IsValid.Should().Be(expectedValid);
    }

    [Fact]
    public void Validator_ShouldRejectInvalidPaginationSortingAndOversizedSearch()
    {
        var validator = new GetApprovalListQueryValidator();
        var query = new GetApprovalListQuery(
            Search: new string('x', 101),
            Page: 0,
            PageSize: 101,
            SortBy: "email",
            SortDirection: "sideways");

        var result = validator.Validate(query);

        result.IsValid.Should().BeFalse();
        result.Errors.Select(error => error.PropertyName).Should().BeEquivalentTo(
            nameof(GetApprovalListQuery.Search),
            nameof(GetApprovalListQuery.Page),
            nameof(GetApprovalListQuery.PageSize),
            nameof(GetApprovalListQuery.SortBy),
            nameof(GetApprovalListQuery.SortDirection));
    }
}
