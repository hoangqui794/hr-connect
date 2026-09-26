using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Candidates.Commands.ApplyJob;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public class ApplyJobCommandHandlerTests
{
    private readonly Mock<ICandidateRepository> _candidateRepositoryMock;
    private readonly Mock<IJobRepository> _jobRepositoryMock;
    private readonly Mock<ICandidateCvRepository> _candidateCvRepositoryMock;
    private readonly Mock<ICvStorageService> _cvStorageServiceMock;
    private readonly Mock<ISubmissionRepository> _submissionRepositoryMock;
    private readonly Mock<IApplicationRepository> _applicationRepositoryMock;
    private readonly Mock<IMf03ScoringTrigger> _scoringTriggerMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IAuditLogService> _auditLogServiceMock;
    private readonly Mock<ILogger<ApplyJobCommandHandler>> _loggerMock;
    private readonly ApplyJobCommandHandler _handler;

    public ApplyJobCommandHandlerTests()
    {
        _candidateRepositoryMock = new Mock<ICandidateRepository>();
        _jobRepositoryMock = new Mock<IJobRepository>();
        _candidateCvRepositoryMock = new Mock<ICandidateCvRepository>();
        _cvStorageServiceMock = new Mock<ICvStorageService>();
        _submissionRepositoryMock = new Mock<ISubmissionRepository>();
        _applicationRepositoryMock = new Mock<IApplicationRepository>();
        _scoringTriggerMock = new Mock<IMf03ScoringTrigger>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _auditLogServiceMock = new Mock<IAuditLogService>();
        _loggerMock = new Mock<ILogger<ApplyJobCommandHandler>>();

        _handler = new ApplyJobCommandHandler(
            _candidateRepositoryMock.Object,
            _jobRepositoryMock.Object,
            _candidateCvRepositoryMock.Object,
            _cvStorageServiceMock.Object,
            _submissionRepositoryMock.Object,
            _applicationRepositoryMock.Object,
            _scoringTriggerMock.Object,
            _unitOfWorkMock.Object,
            _auditLogServiceMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_WithValidRequest_CreatesAcceptedSubmissionAndApplication_AndTriggersMf03()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var jobId = Guid.NewGuid();
        var cvId = Guid.NewGuid();
        var serviceTypeId = Guid.NewGuid();

        var candidate = new Candidate { CandidateId = candidateId, UserId = userId, FullName = "Candidate One" };
        var job = new Job { JobId = jobId, Status = JobStatuses.Active, ServiceTypeId = serviceTypeId };
        var cv = new CandidateCv { CvId = cvId, CandidateId = candidateId, Status = "ACTIVE", SourceFileUrl = "candidates/1/cvs/1.pdf" };

        _candidateRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        _jobRepositoryMock.Setup(r => r.GetByIdAsync(jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(job);

        _jobRepositoryMock.Setup(r => r.CanAnyRoleSubmitJobAsync(serviceTypeId, It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _candidateCvRepositoryMock.Setup(r => r.GetByIdAsync(cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(cv);

        _submissionRepositoryMock.Setup(r => r.GetAcceptedSubmissionAsync(candidateId, jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Submission?)null);

        _applicationRepositoryMock.Setup(r => r.GetByCandidateAndJobAsync(candidateId, jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((HRConnect.Domain.Entities.Application?)null);

        Submission? createdSubmission = null;
        _submissionRepositoryMock.Setup(r => r.AddAsync(It.IsAny<Submission>(), It.IsAny<CancellationToken>()))
            .Callback<Submission, CancellationToken>((s, ct) => createdSubmission = s)
            .Returns(Task.CompletedTask);

        HRConnect.Domain.Entities.Application? createdApp = null;
        _applicationRepositoryMock.Setup(r => r.AddAsync(It.IsAny<HRConnect.Domain.Entities.Application>(), It.IsAny<CancellationToken>()))
            .Callback<HRConnect.Domain.Entities.Application, CancellationToken>((a, ct) => createdApp = a)
            .Returns(Task.CompletedTask);

        var command = new ApplyJobCommand
        {
            JobId = jobId,
            UserId = userId,
            CvId = cvId,
            RoleCodes = new[] { "CANDIDATE" }
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.CandidateId.Should().Be(candidateId);
        result.Data.JobId.Should().Be(jobId);
        result.Data.CvId.Should().Be(cvId);
        result.Data.Status.Should().Be("ACCEPTED");
        result.Data.AiStatus.Should().Be("PENDING");

        // Verify Submission
        createdSubmission.Should().NotBeNull();
        createdSubmission!.CandidateId.Should().Be(candidateId);
        createdSubmission.JobId.Should().Be(jobId);
        createdSubmission.CvId.Should().Be(cvId);
        createdSubmission.Source.Should().Be("CANDIDATE");
        createdSubmission.Status.Should().Be("ACCEPTED");

        // Verify Application
        createdApp.Should().NotBeNull();
        createdApp!.CandidateId.Should().Be(candidateId);
        createdApp.JobId.Should().Be(jobId);
        createdApp.AcceptedSubmissionId.Should().Be(createdSubmission.SubmissionId);
        createdApp.Status.Should().Be("SUBMITTED");

        // Verify Save & MF-03 trigger
        _unitOfWorkMock.Verify(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _scoringTriggerMock.Verify(t => t.TriggerScoringAsync(
            It.Is<Mf03TriggerPayload>(p => p.ApplicationId == createdApp.ApplicationId && p.CvId == cvId && p.JobId == jobId),
            It.IsAny<CancellationToken>()), Times.Once);
        _auditLogServiceMock.Verify(a => a.AddAsync(
            It.Is<AuditEntry>(entry => entry.Action == AuditActions.ApplicationSubmitted && entry.EntityId == createdApp.ApplicationId),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenCandidateNotFoundForUserId_ThrowsNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        _candidateRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Candidate?)null);

        var command = new ApplyJobCommand { JobId = Guid.NewGuid(), UserId = userId };

        // Act
        Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy thông tin hồ sơ ứng viên*");
    }

    [Fact]
    public async Task Handle_WhenJobNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidate = new Candidate { CandidateId = Guid.NewGuid(), UserId = userId };
        _candidateRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        _jobRepositoryMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Job?)null);

        var command = new ApplyJobCommand { JobId = Guid.NewGuid(), UserId = userId };

        // Act
        Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy công việc*");
    }

    [Theory]
    [InlineData(JobStatuses.Draft)]
    [InlineData(JobStatuses.Closed)]
    [InlineData(JobStatuses.Paused)]
    [InlineData(JobStatuses.PendingReview)]
    public async Task Handle_WhenJobNotActive_ThrowsBadRequestException(string inactiveStatus)
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidate = new Candidate { CandidateId = Guid.NewGuid(), UserId = userId };
        var job = new Job { JobId = Guid.NewGuid(), Status = inactiveStatus };

        _candidateRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        _jobRepositoryMock.Setup(r => r.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(job);

        var command = new ApplyJobCommand { JobId = job.JobId, UserId = userId };

        // Act
        Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*không ở trạng thái nhận hồ sơ ứng tuyển*");
    }

    [Fact]
    public async Task Handle_WhenRoleNotAllowedToSubmit_ThrowsForbiddenExceptionWithSpecificErrorCode()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidate = new Candidate { CandidateId = Guid.NewGuid(), UserId = userId };
        var job = new Job { JobId = Guid.NewGuid(), Status = JobStatuses.Active, ServiceTypeId = Guid.NewGuid() };

        _candidateRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        _jobRepositoryMock.Setup(r => r.GetByIdAsync(job.JobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(job);

        _jobRepositoryMock.Setup(r => r.CanAnyRoleSubmitJobAsync(job.ServiceTypeId, It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var command = new ApplyJobCommand { JobId = job.JobId, UserId = userId, RoleCodes = new[] { "CANDIDATE" } };

        // Act
        Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        var ex = await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Your role is not allowed to submit candidates for this service type.");
        ex.Which.ErrorCode.Should().Be("SERVICE_TYPE_SUBMISSION_NOT_ALLOWED");

        // Verify no DB changes or MF-03 calls
        _submissionRepositoryMock.Verify(s => s.AddAsync(It.IsAny<Submission>(), It.IsAny<CancellationToken>()), Times.Never);
        _applicationRepositoryMock.Verify(a => a.AddAsync(It.IsAny<HRConnect.Domain.Entities.Application>(), It.IsAny<CancellationToken>()), Times.Never);
        _scoringTriggerMock.Verify(t => t.TriggerScoringAsync(It.IsAny<Mf03TriggerPayload>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WhenDuplicateSubmissionExists_CreatesBlockedDuplicateSubmission_ThrowsConflict_WithoutSecondApp()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var jobId = Guid.NewGuid();
        var cvId = Guid.NewGuid();

        var candidate = new Candidate { CandidateId = candidateId, UserId = userId };
        var job = new Job { JobId = jobId, Status = JobStatuses.Active, ServiceTypeId = Guid.NewGuid() };
        var cv = new CandidateCv { CvId = cvId, CandidateId = candidateId, Status = "ACTIVE", SourceFileUrl = "key" };
        var existingAcceptedSubmission = new Submission { SubmissionId = Guid.NewGuid(), CandidateId = candidateId, JobId = jobId, Status = "ACCEPTED" };

        _candidateRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        _jobRepositoryMock.Setup(r => r.GetByIdAsync(jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(job);

        _jobRepositoryMock.Setup(r => r.CanAnyRoleSubmitJobAsync(job.ServiceTypeId, It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _candidateCvRepositoryMock.Setup(r => r.GetByIdAsync(cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(cv);

        // Existing submission detected!
        _submissionRepositoryMock.Setup(r => r.GetAcceptedSubmissionAsync(candidateId, jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingAcceptedSubmission);

        Submission? blockedSubmission = null;
        _submissionRepositoryMock.Setup(r => r.AddAsync(It.IsAny<Submission>(), It.IsAny<CancellationToken>()))
            .Callback<Submission, CancellationToken>((s, ct) => blockedSubmission = s)
            .Returns(Task.CompletedTask);

        var command = new ApplyJobCommand { JobId = jobId, UserId = userId, CvId = cvId };

        // Act
        Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*đã nộp hồ sơ ứng tuyển vào công việc này trước đó*");

        // Verify BLOCKED_DUPLICATE recorded
        blockedSubmission.Should().NotBeNull();
        blockedSubmission!.Status.Should().Be("BLOCKED_DUPLICATE");
        blockedSubmission.DuplicateOfSubmissionId.Should().Be(existingAcceptedSubmission.SubmissionId);

        // Verify NO Application was added and NO MF-03 triggered
        _applicationRepositoryMock.Verify(a => a.AddAsync(It.IsAny<HRConnect.Domain.Entities.Application>(), It.IsAny<CancellationToken>()), Times.Never);
        _scoringTriggerMock.Verify(t => t.TriggerScoringAsync(It.IsAny<Mf03TriggerPayload>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WhenConcurrentRaceViolatesUniqueConstraint_RollsBack_DeletesUploadedCv_AndThrowsConflict()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var jobId = Guid.NewGuid();
        var cvId = Guid.NewGuid();

        var candidate = new Candidate { CandidateId = candidateId, UserId = userId };
        var job = new Job { JobId = jobId, Status = JobStatuses.Active, ServiceTypeId = Guid.NewGuid() };

        _candidateRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);
        _jobRepositoryMock.Setup(r => r.GetByIdAsync(jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(job);
        _jobRepositoryMock.Setup(r => r.CanAnyRoleSubmitJobAsync(job.ServiceTypeId, It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // First query returns null (racing past duplicate check)
        _submissionRepositoryMock.Setup(r => r.GetAcceptedSubmissionAsync(candidateId, jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Submission?)null);
        _applicationRepositoryMock.Setup(r => r.GetByCandidateAndJobAsync(candidateId, jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((HRConnect.Domain.Entities.Application?)null);

        var stream = new MemoryStream(new byte[] { 1, 2, 3 });
        _cvStorageServiceMock.Setup(s => s.UploadCvPdfAsync(candidateId, stream, "cv.pdf", 3, null, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UploadCvResult { CvId = cvId, CandidateId = candidateId, FileName = "cv.pdf" });

        // Commit throws 23505 unique constraint violation from postgres
        _unitOfWorkMock.Setup(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("duplicate key value violates unique constraint \"uq_submission_one_accepted\" 23505"));

        var command = new ApplyJobCommand
        {
            JobId = jobId,
            UserId = userId,
            FileStream = stream,
            FileName = "cv.pdf",
            FileSizeBytes = 3
        };

        // Act
        Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*đã nộp hồ sơ ứng tuyển vào công việc này trước đó*");

        _unitOfWorkMock.Verify(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _cvStorageServiceMock.Verify(s => s.DeleteCvAsync(cvId, It.IsAny<CancellationToken>()), Times.Once);
        _scoringTriggerMock.Verify(t => t.TriggerScoringAsync(It.IsAny<Mf03TriggerPayload>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenPersistentScoringEnqueueThrows_RollsBackApplication()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var jobId = Guid.NewGuid();
        var cvId = Guid.NewGuid();

        var candidate = new Candidate { CandidateId = candidateId, UserId = userId };
        var job = new Job { JobId = jobId, Status = JobStatuses.Active, ServiceTypeId = Guid.NewGuid() };
        var cv = new CandidateCv { CvId = cvId, CandidateId = candidateId, Status = "ACTIVE", SourceFileUrl = "path.pdf" };

        _candidateRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);
        _jobRepositoryMock.Setup(r => r.GetByIdAsync(jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(job);
        _jobRepositoryMock.Setup(r => r.CanAnyRoleSubmitJobAsync(job.ServiceTypeId, It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        _candidateCvRepositoryMock.Setup(r => r.GetByIdAsync(cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(cv);

        _submissionRepositoryMock.Setup(r => r.GetAcceptedSubmissionAsync(candidateId, jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Submission?)null);
        _applicationRepositoryMock.Setup(r => r.GetByCandidateAndJobAsync(candidateId, jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((HRConnect.Domain.Entities.Application?)null);

        // MF-03 fails
        _scoringTriggerMock.Setup(t => t.TriggerScoringAsync(It.IsAny<Mf03TriggerPayload>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("MF-03 scoring pipeline error"));

        var command = new ApplyJobCommand { JobId = jobId, UserId = userId, CvId = cvId };

        // Act
        Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>();
        _unitOfWorkMock.Verify(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
        _unitOfWorkMock.Verify(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
