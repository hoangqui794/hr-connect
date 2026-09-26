using System.Net;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Admin.AuditLogs;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.Admin.AuditLogs;

public class GetAuditLogDetailQueryHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsTraceMetadataAndJsonValues()
    {
        var actor = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "admin@example.com",
            DisplayName = "Admin",
            PasswordHash = "hash",
            Status = "ACTIVE"
        };
        var log = new AuditLog
        {
            AuditLogId = 7,
            ActorUserId = actor.UserId,
            ActorUser = actor,
            Action = "CV_UPDATED",
            EntityType = "CANDIDATE_CV",
            EntityId = Guid.NewGuid(),
            OldValues = "{\"title\":\"Old\"}",
            NewValues = "{\"title\":\"New\"}",
            CorrelationId = Guid.NewGuid(),
            IpAddress = IPAddress.Loopback,
            UserAgent = "unit-test",
            CreatedAt = DateTime.UtcNow
        };
        var repository = new Mock<IAuditLogRepository>();
        repository.Setup(r => r.GetByIdAsync(7, It.IsAny<CancellationToken>())).ReturnsAsync(log);
        var handler = new GetAuditLogDetailQueryHandler(repository.Object);

        var result = await handler.Handle(new GetAuditLogDetailQuery(7), CancellationToken.None);

        result.Data.ActorEmail.Should().Be("admin@example.com");
        result.Data.OldValues!.Value.GetProperty("title").GetString().Should().Be("Old");
        result.Data.NewValues!.Value.GetProperty("title").GetString().Should().Be("New");
        result.Data.IpAddress.Should().Be("127.0.0.1");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task Handle_WhenIdIsInvalid_ThrowsBadRequest(long auditLogId)
    {
        var repository = new Mock<IAuditLogRepository>();
        var handler = new GetAuditLogDetailQueryHandler(repository.Object);

        var action = () => handler.Handle(new GetAuditLogDetailQuery(auditLogId), CancellationToken.None);

        await action.Should().ThrowAsync<BadRequestException>();
        repository.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Handle_WhenLogDoesNotExist_ThrowsNotFound()
    {
        var repository = new Mock<IAuditLogRepository>();
        repository.Setup(r => r.GetByIdAsync(99, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AuditLog?)null);
        var handler = new GetAuditLogDetailQueryHandler(repository.Object);

        var action = () => handler.Handle(new GetAuditLogDetailQuery(99), CancellationToken.None);

        await action.Should().ThrowAsync<NotFoundException>();
    }
}
