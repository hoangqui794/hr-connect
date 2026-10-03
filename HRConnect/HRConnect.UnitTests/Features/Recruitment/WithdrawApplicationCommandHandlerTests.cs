using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Recruitment.Commands.WithdrawApplication;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.Recruitment;

public class WithdrawApplicationCommandHandlerTests
{
    private readonly Mock<IApplicationRepository> _applicationRepository = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();

    private WithdrawApplicationCommandHandler CreateHandler() => new(_applicationRepository.Object, _unitOfWork.Object);

    [Fact]
    public async Task Handle_WhenCandidateWithdraws_CancelsScheduledInterviewAndWithdrawsActiveOffer()
    {
        var candidateUserId = Guid.NewGuid();
        var application = new Domain.Entities.Application
        {
            ApplicationId = Guid.NewGuid(),
            Status = "INTERVIEW",
            Candidate = new Candidate { UserId = candidateUserId },
            ConcurrencyToken = Guid.NewGuid(),
            Interviews = new List<Interview>
            {
                new()
                {
                    InterviewId = Guid.NewGuid(),
                    Status = "SCHEDULED",
                    ScheduledAt = DateTime.UtcNow.AddDays(1),
                    ConcurrencyToken = Guid.NewGuid(),
                    InterviewStatusHistories = new List<InterviewStatusHistory>()
                }
            },
            Offers = new List<Offer>
            {
                new() { OfferId = Guid.NewGuid(), Status = "SENT", ConcurrencyToken = Guid.NewGuid() }
            },
            ApplicationStatusHistories = new List<ApplicationStatusHistory>()
        };
        _applicationRepository.Setup(r => r.GetByIdAsync(application.ApplicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);
        _unitOfWork.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var result = await CreateHandler().Handle(new WithdrawApplicationCommand(
            application.ApplicationId, "Đã nhận công việc khác.", application.ConcurrencyToken, candidateUserId), CancellationToken.None);

        result.ApplicationStatus.Should().Be("WITHDRAWN");
        result.CancelledInterviewCount.Should().Be(1);
        result.WithdrawnOfferCount.Should().Be(1);
        application.Interviews.Single().Status.Should().Be("CANCELLED");
        application.Offers.Single().Status.Should().Be("WITHDRAWN");
        application.ApplicationStatusHistories.Should().ContainSingle(h => h.NewStatus == "WITHDRAWN");
    }

    [Fact]
    public async Task Handle_WhenAnotherCandidateTriesToWithdraw_RejectsRequest()
    {
        var application = new Domain.Entities.Application
        {
            ApplicationId = Guid.NewGuid(),
            Status = "SHORTLISTED",
            Candidate = new Candidate { UserId = Guid.NewGuid() },
            ConcurrencyToken = Guid.NewGuid()
        };
        _applicationRepository.Setup(r => r.GetByIdAsync(application.ApplicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);

        var act = () => CreateHandler().Handle(new WithdrawApplicationCommand(
            application.ApplicationId, null, application.ConcurrencyToken, Guid.NewGuid()), CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>();
    }
}
