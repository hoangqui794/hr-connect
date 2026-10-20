using HRConnect.Application.Common.Interfaces;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace HRConnect.UnitTests.Persistence;

/// <summary>REALTIME-01 (test 20/10): notifications saved inside a transaction are pushed only after the commit.</summary>
public class NotificationPushInterceptorTests
{
    private sealed class RecordingPublisher : INotificationPublisher
    {
        public List<Guid> Pushed { get; } = [];

        public Task PublishAsync(IReadOnlyList<Notification> notifications, CancellationToken cancellationToken = default)
        {
            Pushed.AddRange(notifications.Select(n => n.NotificationId));
            return Task.CompletedTask;
        }
    }

    /// <summary>InMemory has no transactions: the facade reports whichever transaction the test sets.</summary>
    private sealed class TxContext : ApplicationDbContext
    {
        private readonly Mock<DatabaseFacade> _facade;

        public TxContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
            _facade = new Mock<DatabaseFacade>(this) { CallBase = true };
            _facade.SetupGet(f => f.CurrentTransaction).Returns(() => Transaction);
        }

        public IDbContextTransaction? Transaction { get; set; }

        public override DatabaseFacade Database => _facade.Object;
    }

    private readonly RecordingPublisher _publisher = new();
    private readonly NotificationPushInterceptor _interceptor;
    private readonly TxContext _context;

    public NotificationPushInterceptorTests()
    {
        _interceptor = new NotificationPushInterceptor(_publisher, NullLogger<NotificationPushInterceptor>.Instance);
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .AddInterceptors(_interceptor)
            .Options;
        _context = new TxContext(options);
    }

    private Notification Add()
    {
        var n = new Notification
        {
            NotificationId = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            NotificationType = "AFFILIATE",
            Title = "Khiếu nại đã có kết quả",
            Message = "E2E",
            Metadata = "{}",
            CreatedAt = DateTime.UtcNow,
        };
        _context.Notifications.Add(n);
        return n;
    }

    [Fact]
    public async Task Save_WithoutTransaction_PushesRightAway()
    {
        var n = Add();

        await _context.SaveChangesAsync();

        _publisher.Pushed.Should().Equal(n.NotificationId);
    }

    [Fact]
    public async Task Save_InsideTransaction_WaitsForCommit()
    {
        _context.Transaction = Mock.Of<IDbContextTransaction>();
        var first = Add();
        await _context.SaveChangesAsync();
        var second = Add();
        await _context.SaveChangesAsync();

        _publisher.Pushed.Should().BeEmpty("the rows are not committed, so the unread count would still be the old one");

        await _interceptor.TransactionCommittedAsync(null!, null!);

        _publisher.Pushed.Should().Equal(first.NotificationId, second.NotificationId);
    }

    [Fact]
    public async Task Save_InsideTransaction_RolledBack_PushesNothing()
    {
        _context.Transaction = Mock.Of<IDbContextTransaction>();
        Add();
        await _context.SaveChangesAsync();

        await _interceptor.TransactionRolledBackAsync(null!, null!);
        await _interceptor.TransactionCommittedAsync(null!, null!);

        _publisher.Pushed.Should().BeEmpty();
    }
}
