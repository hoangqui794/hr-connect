using System.Net;
using FluentAssertions;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Services.Integration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace HRConnect.UnitTests.Services.Integration;

public class Mf03ScoringDispatcherTests
{
    [Fact]
    public async Task DispatchBatchAsync_FailedRequest_SchedulesExponentialRetry()
    {
        var fixture = await CreateFixtureAsync(dispatchCount: 0);

        await fixture.Dispatcher.DispatchBatchAsync(CancellationToken.None);

        await using var scope = fixture.Provider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var result = await db.AiMatchResults.SingleAsync();
        result.Status.Should().Be("PENDING");
        result.DispatchCount.Should().Be(1);
        result.FailureCode.Should().Be("MF03_DISPATCH_FAILED");
        result.NextAttemptAt.Should().BeAfter(DateTime.UtcNow.AddSeconds(20));
        result.NextAttemptAt.Should().BeBefore(DateTime.UtcNow.AddSeconds(40));
        result.CompletedAt.Should().BeNull();
        fixture.Handler.RequestCount.Should().Be(1);
        (await db.AuditLogs.SingleAsync()).Action.Should().Be("AI_SCORING_RETRY_SCHEDULED");
    }

    [Fact]
    public async Task DispatchBatchAsync_FifthFailedRequest_MarksAttemptFailed()
    {
        var fixture = await CreateFixtureAsync(dispatchCount: 4);

        await fixture.Dispatcher.DispatchBatchAsync(CancellationToken.None);

        await using var scope = fixture.Provider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var result = await db.AiMatchResults.SingleAsync();
        result.Status.Should().Be("FAILED");
        result.DispatchCount.Should().Be(5);
        result.FailureCode.Should().Be("MF03_DISPATCH_RETRY_EXHAUSTED");
        result.NextAttemptAt.Should().BeNull();
        result.CompletedAt.Should().NotBeNull();
        fixture.Handler.RequestCount.Should().Be(1);
        (await db.AuditLogs.SingleAsync()).Action.Should().Be("AI_SCORING_FAILED");
    }

    [Fact]
    public async Task DispatchBatchAsync_FutureRetry_IsNotDispatchedEarly()
    {
        var fixture = await CreateFixtureAsync(
            dispatchCount: 1,
            nextAttemptAt: DateTime.UtcNow.AddMinutes(5));

        await fixture.Dispatcher.DispatchBatchAsync(CancellationToken.None);

        await using var scope = fixture.Provider.CreateAsyncScope();
        var result = await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>()
            .AiMatchResults.SingleAsync();
        result.Status.Should().Be("PENDING");
        result.DispatchCount.Should().Be(1);
        fixture.Handler.RequestCount.Should().Be(0);
    }

    [Fact]
    public async Task DispatchBatchAsync_StaleProcessingAfterMaxAttempts_FailsWithoutRedispatch()
    {
        var fixture = await CreateFixtureAsync(
            status: "PROCESSING",
            dispatchCount: 5,
            lastDispatchedAt: DateTime.UtcNow.AddMinutes(-20));

        await fixture.Dispatcher.DispatchBatchAsync(CancellationToken.None);

        await using var scope = fixture.Provider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var result = await db.AiMatchResults.SingleAsync();
        result.Status.Should().Be("FAILED");
        result.FailureCode.Should().Be("MF03_PROCESSING_TIMEOUT_RETRY_EXHAUSTED");
        result.CompletedAt.Should().NotBeNull();
        fixture.Handler.RequestCount.Should().Be(0);
        (await db.AuditLogs.SingleAsync()).Action.Should().Be("AI_SCORING_FAILED");
    }

    [Theory]
    [InlineData(1, 30)]
    [InlineData(2, 60)]
    [InlineData(3, 120)]
    [InlineData(4, 240)]
    [InlineData(10, 900)]
    public void CalculateDelay_UsesCappedExponentialBackoff(int dispatchCount, int expectedSeconds)
    {
        Mf03RetryPolicy.CalculateDelay(dispatchCount, 30, 900)
            .Should().Be(TimeSpan.FromSeconds(expectedSeconds));
    }

    private static async Task<DispatcherFixture> CreateFixtureAsync(
        string status = "PENDING",
        int dispatchCount = 0,
        DateTime? nextAttemptAt = null,
        DateTime? lastDispatchedAt = null)
    {
        var services = new ServiceCollection();
        var databaseName = Guid.NewGuid().ToString();
        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseInMemoryDatabase(databaseName));
        var provider = services.BuildServiceProvider();

        await using (var scope = provider.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var submission = new Submission
            {
                SubmissionId = Guid.NewGuid(),
                CandidateId = Guid.NewGuid(),
                CvId = Guid.NewGuid(),
                JobId = Guid.NewGuid(),
                SubmittedBy = Guid.NewGuid(),
                Source = "CANDIDATE",
                Status = "ACCEPTED"
            };
            var application = new HRConnect.Domain.Entities.Application
            {
                ApplicationId = Guid.NewGuid(),
                CandidateId = submission.CandidateId,
                JobId = submission.JobId,
                AcceptedSubmissionId = submission.SubmissionId,
                Status = "SUBMITTED",
                Submission = submission
            };
            db.AiMatchResults.Add(new AiMatchResult
            {
                MatchResultId = Guid.NewGuid(),
                ApplicationId = application.ApplicationId,
                AttemptNo = 1,
                ExternalReference = Guid.NewGuid().ToString(),
                Status = status,
                RequestedAt = DateTime.UtcNow.AddMinutes(-30),
                ProcessingStartedAt = status == "PROCESSING" ? DateTime.UtcNow.AddMinutes(-20) : null,
                LastDispatchedAt = lastDispatchedAt,
                DispatchCount = dispatchCount,
                NextAttemptAt = nextAttemptAt,
                Application = application
            });
            await db.SaveChangesAsync();
        }

        var handler = new StubHttpMessageHandler(HttpStatusCode.ServiceUnavailable);
        var client = new HttpClient(handler) { BaseAddress = new Uri("http://mf03.test") };
        var factory = new StubHttpClientFactory(client);
        var settings = Options.Create(new Mf03IntegrationSettings
        {
            ProcessingTimeoutMinutes = 15,
            BatchSize = 10,
            MaxDispatchAttempts = 5,
            InitialRetryDelaySeconds = 30,
            MaxRetryDelaySeconds = 900
        });
        var dispatcher = new Mf03ScoringDispatcher(
            provider.GetRequiredService<IServiceScopeFactory>(),
            factory,
            settings,
            NullLogger<Mf03ScoringDispatcher>.Instance);
        return new DispatcherFixture(provider, dispatcher, handler);
    }

    private sealed record DispatcherFixture(
        ServiceProvider Provider,
        Mf03ScoringDispatcher Dispatcher,
        StubHttpMessageHandler Handler);

    private sealed class StubHttpClientFactory(HttpClient client) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => client;
    }

    private sealed class StubHttpMessageHandler(HttpStatusCode statusCode) : HttpMessageHandler
    {
        public int RequestCount { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            RequestCount++;
            return Task.FromResult(new HttpResponseMessage(statusCode));
        }
    }
}
