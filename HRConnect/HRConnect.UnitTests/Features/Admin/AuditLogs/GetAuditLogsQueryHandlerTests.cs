using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Admin.AuditLogs;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.Admin.AuditLogs;

public class GetAuditLogsQueryHandlerTests
{
    private readonly Mock<IAuditLogRepository> _repository = new();

    [Fact]
    public async Task Handle_NormalizesFiltersAndClampsPagination()
    {
        var createdAt = DateTime.UtcNow;
        var log = new AuditLog
        {
            AuditLogId = 11,
            Action = "CV_UPDATED",
            EntityType = "CANDIDATE_CV",
            CreatedAt = createdAt
        };
        _repository.Setup(repository => repository.GetListAsync(
                null,
                "CV_UPDATED",
                "CANDIDATE_CV",
                null,
                null,
                null,
                null,
                1,
                100,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((new List<AuditLog> { log }, 101));
        var handler = new GetAuditLogsQueryHandler(_repository.Object);

        var result = await handler.Handle(new GetAuditLogsQuery(
            Action: "  cv_updated ",
            EntityType: " candidate_cv ",
            Page: 0,
            PageSize: 500), CancellationToken.None);

        result.Data.Items.Should().ContainSingle();
        result.Data.Items[0].AuditLogId.Should().Be(11);
        result.Data.Page.Should().Be(1);
        result.Data.PageSize.Should().Be(100);
        result.Data.Total.Should().Be(101);
        result.Data.TotalPages.Should().Be(2);
    }

    [Fact]
    public async Task Handle_WhenTimeRangeIsReversed_ThrowsBadRequest()
    {
        var handler = new GetAuditLogsQueryHandler(_repository.Object);
        var query = new GetAuditLogsQuery(
            FromUtc: new DateTime(2026, 9, 26, 12, 0, 0, DateTimeKind.Utc),
            ToUtc: new DateTime(2026, 9, 25, 12, 0, 0, DateTimeKind.Utc));

        var action = () => handler.Handle(query, CancellationToken.None);

        await action.Should().ThrowAsync<BadRequestException>();
        _repository.VerifyNoOtherCalls();
    }
}
