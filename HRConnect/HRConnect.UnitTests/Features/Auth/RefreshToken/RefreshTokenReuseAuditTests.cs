using System.Net;
using System.Text.Json;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Auth.Commands.RefreshToken;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using HRConnect.Infrastructure.Services.Audit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using RefreshTokenEntity = HRConnect.Domain.Entities.RefreshToken;

namespace HRConnect.UnitTests.Features.Auth.RefreshToken;

/// <summary>
/// Runs the handler with the real AuditLogService, repository and unit of work, so an audit entry
/// that the audit service refuses cannot silently undo the session revocation.
/// </summary>
public class RefreshTokenReuseAuditTests
{
    private const string ReplayedToken = "replayed-token";
    private const string ReplayedTokenHash = "replayed-token-hash";

    [Theory]
    [InlineData("NONE")]
    [InlineData("AFFECTED_USER")]
    [InlineData("OTHER_USER")]
    public async Task Handle_WhenTokenIsReused_RevokesEverySessionWhateverBearerIsSent(string bearer)
    {
        var databaseName = Guid.NewGuid().ToString();
        var affectedUserId = Guid.NewGuid();
        var bystanderUserId = Guid.NewGuid();
        Guid? bearerUserId = bearer switch
        {
            "AFFECTED_USER" => affectedUserId,
            "OTHER_USER" => bystanderUserId,
            _ => null
        };
        var replayedTokenId = Guid.NewGuid();
        var activeTokenIds = new[] { Guid.NewGuid(), Guid.NewGuid() };
        var bystanderTokenId = Guid.NewGuid();
        await using (var seed = CreateDbContext(databaseName))
        {
            seed.RefreshTokens.Add(CreateToken(replayedTokenId, affectedUserId, ReplayedTokenHash, revoked: true));
            seed.RefreshTokens.AddRange(activeTokenIds.Select(id =>
                CreateToken(id, affectedUserId, $"active-{id}", revoked: false)));
            seed.RefreshTokens.Add(CreateToken(bystanderTokenId, bystanderUserId, "bystander", revoked: false));
            await seed.SaveChangesAsync();
        }

        await using (var db = CreateDbContext(databaseName))
        {
            var act = () => CreateHandler(db, bearerUserId)
                .Handle(new RefreshTokenCommand(ReplayedToken), CancellationToken.None);

            await act.Should().ThrowAsync<BadRequestException>();
        }

        await using var assertDb = CreateDbContext(databaseName);
        var tokens = await assertDb.RefreshTokens.AsNoTracking().ToDictionaryAsync(t => t.RefreshTokenId);
        tokens.Where(t => activeTokenIds.Contains(t.Key)).Should().OnlyContain(t =>
            t.Value.RevokedAt != null && t.Value.RevokeReason == "TOKEN_REUSE_DETECTED");
        tokens[bystanderTokenId].RevokedAt.Should().BeNull();

        var audit = await assertDb.AuditLogs.AsNoTracking().SingleAsync();
        audit.Action.Should().Be(AuditActions.RefreshTokenReuseDetected);
        audit.EntityId.Should().Be(replayedTokenId);
        audit.Source.Should().Be(AuditSources.Api);
        // Same rule as audit_log_actor_identity_check, which the in-memory provider does not enforce.
        (audit.ActorUserId.HasValue == (audit.ActorType == AuditActorTypes.User)).Should().BeTrue();
        // The actor is whoever owns the Bearer, never the owner of the replayed token by default.
        audit.ActorUserId.Should().Be(bearerUserId);
        audit.ActorType.Should().Be(bearerUserId.HasValue ? AuditActorTypes.User : AuditActorTypes.System);

        using var newValues = JsonDocument.Parse(audit.NewValues!);
        newValues.RootElement.GetProperty("affectedUserId").GetGuid().Should().Be(affectedUserId);
        newValues.RootElement.GetProperty("allSessionsRevoked").GetBoolean().Should().BeTrue();
        newValues.RootElement.GetProperty("detectedBy").GetString().Should().Be(AuditActorTypes.System);
    }

    private static RefreshTokenCommandHandler CreateHandler(ApplicationDbContext db, Guid? bearerUserId)
    {
        var requestContext = new Mock<IRequestContext>();
        requestContext.SetupGet(context => context.UserId).Returns(bearerUserId);
        requestContext.SetupGet(context => context.CorrelationId).Returns(Guid.NewGuid());
        requestContext.SetupGet(context => context.IpAddress).Returns(IPAddress.Loopback);
        var otpService = new Mock<IOtpService>();
        otpService.Setup(service => service.HashOtp(ReplayedToken)).Returns(ReplayedTokenHash);

        return new RefreshTokenCommandHandler(
            new RefreshTokenRepository(db),
            Mock.Of<IUserRepository>(),
            Mock.Of<IJwtTokenGenerator>(),
            otpService.Object,
            new AuditLogService(db, requestContext.Object),
            requestContext.Object,
            new UnitOfWork(db, requestContext.Object),
            Options.Create(new JwtSettings { ExpiryMinutes = 60, RefreshTokenExpiryDays = 7 }),
            NullLogger<RefreshTokenCommandHandler>.Instance);
    }

    private static RefreshTokenEntity CreateToken(Guid id, Guid userId, string hash, bool revoked) => new()
    {
        RefreshTokenId = id,
        UserId = userId,
        TokenHash = hash,
        ExpiresAt = DateTime.UtcNow.AddDays(2),
        CreatedAt = DateTime.UtcNow.AddDays(-1),
        RevokedAt = revoked ? DateTime.UtcNow.AddMinutes(-10) : null,
        RevokeReason = revoked ? "ROTATED" : null
    };

    private static ApplicationDbContext CreateDbContext(string databaseName) =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName)
            .Options);
}
