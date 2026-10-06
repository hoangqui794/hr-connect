using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Interviews.Commands.RecordInterviewNoShow;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.Interviews;

public class RecordInterviewNoShowCommandHandlerTests
{
    private readonly Mock<IInterviewRepository> _interviewRepository = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepository = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditLogService> _auditLogServiceMock = new();

    private RecordInterviewNoShowCommandHandler CreateHandler() => new(
        _interviewRepository.Object,
        _companyUserRepository.Object,
        _unitOfWork.Object,
        _auditLogServiceMock.Object);

    [Fact]
    public async Task Handle_WhenScheduledInterviewHasPassed_RecordsNoShowWithoutChangingApplicationOutcome()
    {
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var interview = new Interview
        {
            InterviewId = Guid.NewGuid(),
            ApplicationId = Guid.NewGuid(),
            Status = "SCHEDULED",
            ScheduledAt = DateTime.UtcNow.AddMinutes(-5),
            ConcurrencyToken = Guid.NewGuid(),
            Application = new Domain.Entities.Application
            {
                Status = "INTERVIEW",
                Job = new Job { CompanyId = companyId }
            },
            InterviewStatusHistories = new List<InterviewStatusHistory>()
        };
        _interviewRepository.Setup(r => r.GetByIdForUpdateAsync(interview.InterviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);
        _companyUserRepository.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId });
        _unitOfWork.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var result = await CreateHandler().Handle(new RecordInterviewNoShowCommand(
            interview.InterviewId, "Ứng viên không tham dự.", interview.ConcurrencyToken, userId,
            IsClientCompanyUser: true), CancellationToken.None);

        result.Status.Should().Be("NO_SHOW");
        interview.Status.Should().Be("NO_SHOW");
        interview.Application.Status.Should().Be("INTERVIEW");
        interview.InterviewStatusHistories.Should().ContainSingle(h => h.NewStatus == "NO_SHOW");
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenInterviewIsStillInFuture_RejectsNoShow()
    {
        var interview = new Interview
        {
            InterviewId = Guid.NewGuid(),
            Status = "SCHEDULED",
            ScheduledAt = DateTime.UtcNow.AddMinutes(5),
            ConcurrencyToken = Guid.NewGuid()
        };
        _interviewRepository.Setup(r => r.GetByIdForUpdateAsync(interview.InterviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);

        var act = () => CreateHandler().Handle(new RecordInterviewNoShowCommand(
            interview.InterviewId, "Không tham gia", interview.ConcurrencyToken, Guid.NewGuid(),
            IsInternalHrOrAdmin: true), CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>().WithMessage("*sau thời gian phỏng vấn*");
    }
}
