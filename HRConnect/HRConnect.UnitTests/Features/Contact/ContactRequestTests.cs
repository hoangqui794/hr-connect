using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Contact;
using HRConnect.Application.Features.Settings;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Contact;

/// <summary>BE-04 A: public contact form.</summary>
public class ContactRequestTests
{
    private readonly ApplicationDbContext _context = new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Mock<IEmailService> _email = new();

    private ContactRequestHandlers Handlers(string? notifyEmail = null) => new(
        new ContactRequestRepository(_context), new BusinessSettingsService(new SystemSettingRepository(_context)),
        new UnitOfWork(_context), _audit.Object, _email.Object,
        Options.Create(new ContactSettings { NotifyEmail = notifyEmail }), NullLogger<ContactRequestHandlers>.Instance);

    private static SubmitContactRequestCommand Submit(bool consent = true, string ip = "1.2.3.4", string service = "headhunt_cod") =>
        new("  Trần Thị B ", "B@Example.com", "0900000000", "Công ty B", service, "Cần tuyển 5 lập trình viên.", consent, ip);

    [Fact]
    public async Task Submit_ShouldStoreNormalizedRequest_WithoutRawIp()
    {
        var receipt = await Handlers().Handle(Submit(), default);

        receipt.Status.Should().Be(ContactRequestStates.New);
        var stored = _context.ContactRequests.Single();
        stored.FullName.Should().Be("Trần Thị B");
        stored.Email.Should().Be("b@example.com");
        stored.ServiceInterest.Should().Be("HEADHUNT_COD");
        stored.SourceIpHash.Should().NotContain("1.2.3.4").And.HaveLength(64);
    }

    [Fact]
    public async Task Submit_WithoutConsent_ShouldBeRejected()
    {
        var act = () => Handlers().Handle(Submit(consent: false), default);

        (await act.Should().ThrowAsync<BadRequestException>()).Which.ErrorCode.Should().Be("CONSENT_REQUIRED");
        _context.ContactRequests.Should().BeEmpty();
    }

    [Fact]
    public async Task Submit_UnknownService_ShouldBeRejected()
    {
        var act = () => Handlers().Handle(Submit(service: "VIP"), default);

        await act.Should().ThrowAsync<BadRequestException>();
    }

    [Fact]
    public async Task Submit_OverHourlyLimit_ShouldReturnRateLimited_PerIp()
    {
        var limit = await new BusinessSettingsService(new SystemSettingRepository(_context))
            .GetIntAsync(BusinessSettingKeys.ContactRateLimitPerHour);
        for (var i = 0; i < limit; i++) await Handlers().Handle(Submit(), default);

        var act = () => Handlers().Handle(Submit(), default);

        (await act.Should().ThrowAsync<TooManyRequestsException>()).Which.ErrorCode.Should().Be("CONTACT_RATE_LIMITED");
        await Handlers().Handle(Submit(ip: "5.6.7.8"), default); // another IP is not affected
    }

    [Fact]
    public async Task Update_ShouldChangeStatus_RecordHandler_AndAudit()
    {
        var receipt = await Handlers().Handle(Submit(), default);
        var userId = Guid.NewGuid();

        var dto = await Handlers().Handle(new UpdateContactRequestCommand(receipt.ContactRequestId, "contacted", "Đã gọi", userId), default);

        dto.Status.Should().Be(ContactRequestStates.Contacted);
        dto.HandledBy.Should().Be(userId);
        dto.Note.Should().Be("Đã gọi");
        _audit.Verify(a => a.AddAsync(It.Is<AuditEntry>(e => e.Action == AuditActions.ContactRequestUpdated), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Update_InvalidStatus_ShouldBeRejected()
    {
        var receipt = await Handlers().Handle(Submit(), default);

        var act = () => Handlers().Handle(new UpdateContactRequestCommand(receipt.ContactRequestId, "DONE", null, Guid.NewGuid()), default);

        await act.Should().ThrowAsync<BadRequestException>();
    }
}
