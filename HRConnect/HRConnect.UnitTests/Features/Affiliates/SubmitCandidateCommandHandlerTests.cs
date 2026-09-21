using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Affiliates.Commands.SubmitCandidate;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.Affiliates;

public class SubmitCandidateCommandHandlerTests
{
    private readonly Mock<IAffiliateProfileRepository> _affiliateProfileRepositoryMock;
    private readonly Mock<ICandidateRepository> _candidateRepositoryMock;
    private readonly Mock<IJobRepository> _jobRepositoryMock;
    private readonly Mock<ICandidateCvRepository> _candidateCvRepositoryMock;
    private readonly Mock<ICvStorageService> _cvStorageServiceMock;
    private readonly Mock<ISubmissionRepository> _submissionRepositoryMock;
    private readonly Mock<IApplicationRepository> _applicationRepositoryMock;
    private readonly Mock<IAttributionRepository> _attributionRepositoryMock;
    private readonly Mock<IEmailNormalizer> _emailNormalizerMock;
    private readonly Mock<IPhoneNormalizer> _phoneNormalizerMock;
    private readonly Mock<IMf03ScoringTrigger> _scoringTriggerMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<ILogger<SubmitCandidateCommandHandler>> _loggerMock;
    private readonly SubmitCandidateCommandHandler _handler;

    public SubmitCandidateCommandHandlerTests()
    {
        _affiliateProfileRepositoryMock = new Mock<IAffiliateProfileRepository>();
        _candidateRepositoryMock = new Mock<ICandidateRepository>();
        _jobRepositoryMock = new Mock<IJobRepository>();
        _candidateCvRepositoryMock = new Mock<ICandidateCvRepository>();
        _cvStorageServiceMock = new Mock<ICvStorageService>();
        _submissionRepositoryMock = new Mock<ISubmissionRepository>();
        _applicationRepositoryMock = new Mock<IApplicationRepository>();
        _attributionRepositoryMock = new Mock<IAttributionRepository>();
        _emailNormalizerMock = new Mock<IEmailNormalizer>();
        _phoneNormalizerMock = new Mock<IPhoneNormalizer>();
        _scoringTriggerMock = new Mock<IMf03ScoringTrigger>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _loggerMock = new Mock<ILogger<SubmitCandidateCommandHandler>>();

        _emailNormalizerMock.Setup(n => n.Normalize(It.IsAny<string>()))
            .Returns<string>(s => s?.Trim().ToLowerInvariant() ?? string.Empty);
        _phoneNormalizerMock.Setup(n => n.Normalize(It.IsAny<string?>()))
            .Returns<string?>(s => s?.Trim().Replace(" ", "").Replace("-", ""));

        _handler = new SubmitCandidateCommandHandler(
            _affiliateProfileRepositoryMock.Object,
            _candidateRepositoryMock.Object,
            _jobRepositoryMock.Object,
            _candidateCvRepositoryMock.Object,
            _cvStorageServiceMock.Object,
            _submissionRepositoryMock.Object,
            _applicationRepositoryMock.Object,
            _attributionRepositoryMock.Object,
            _emailNormalizerMock.Object,
            _phoneNormalizerMock.Object,
            _scoringTriggerMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_WhenAffiliateProfileNotFound_ThrowsForbiddenException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        _affiliateProfileRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AffiliateProfile?)null);

        var command = new SubmitCandidateCommand
        {
            UserId = userId,
            JobId = Guid.NewGuid(),
            FullName = "Nguyen Van A",
            Email = "candidate@example.com"
        };

        // Act & Assert
        var act = async () => await _handler.Handle(command, CancellationToken.None);
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Không tìm thấy hồ sơ Affiliate Recruiter của bạn.");
    }

    [Fact]
    public async Task Handle_WhenAffiliateNotActiveOrVerified_ThrowsForbiddenException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var affiliate = new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = userId, Status = "PENDING" };
        _affiliateProfileRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(affiliate);

        var command = new SubmitCandidateCommand
        {
            UserId = userId,
            JobId = Guid.NewGuid(),
            FullName = "Nguyen Van A",
            Email = "candidate@example.com"
        };

        // Act & Assert
        var act = async () => await _handler.Handle(command, CancellationToken.None);
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Hồ sơ Affiliate Recruiter chưa được kích hoạt hoặc phê duyệt.");
    }

    [Fact]
    public async Task Handle_WhenJobNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var affiliate = new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = userId, Status = "ACTIVE" };
        _affiliateProfileRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(affiliate);

        var jobId = Guid.NewGuid();
        _jobRepositoryMock.Setup(r => r.GetByIdAsync(jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Job?)null);

        var command = new SubmitCandidateCommand
        {
            UserId = userId,
            JobId = jobId,
            FullName = "Nguyen Van A",
            Email = "candidate@example.com"
        };

        // Act & Assert
        var act = async () => await _handler.Handle(command, CancellationToken.None);
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("Không tìm thấy công việc.");
    }

    [Fact]
    public async Task Handle_WhenJobNotActive_ThrowsBadRequestException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var affiliate = new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = userId, Status = "ACTIVE" };
        _affiliateProfileRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(affiliate);

        var jobId = Guid.NewGuid();
        var job = new Job { JobId = jobId, Status = JobStatuses.Draft };
        _jobRepositoryMock.Setup(r => r.GetByIdAsync(jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(job);

        var command = new SubmitCandidateCommand
        {
            UserId = userId,
            JobId = jobId,
            FullName = "Nguyen Van A",
            Email = "candidate@example.com"
        };

        // Act & Assert
        var act = async () => await _handler.Handle(command, CancellationToken.None);
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("Công việc hiện không ở trạng thái nhận hồ sơ ứng viên.");
    }

    [Fact]
    public async Task Handle_WhenRoleNotAllowedToSubmit_ThrowsForbiddenExceptionWithErrorCode()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var affiliate = new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = userId, Status = "ACTIVE" };
        _affiliateProfileRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(affiliate);

        var jobId = Guid.NewGuid();
        var serviceTypeId = Guid.NewGuid();
        var job = new Job { JobId = jobId, Status = JobStatuses.Active, ServiceTypeId = serviceTypeId };
        _jobRepositoryMock.Setup(r => r.GetByIdAsync(jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(job);

        _jobRepositoryMock.Setup(r => r.CanAnyRoleSubmitJobAsync(serviceTypeId, It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var command = new SubmitCandidateCommand
        {
            UserId = userId,
            JobId = jobId,
            FullName = "Nguyen Van A",
            Email = "candidate@example.com",
            RoleCodes = new[] { "AFFILIATE_RECRUITER" }
        };

        // Act & Assert
        var act = async () => await _handler.Handle(command, CancellationToken.None);
        var exception = await act.Should().ThrowAsync<ForbiddenException>();
        exception.Which.ErrorCode.Should().Be("SERVICE_TYPE_SUBMISSION_NOT_ALLOWED");
        exception.Which.Message.Should().Be("Your role is not allowed to submit candidates for this service type.");
    }

    [Fact]
    public async Task Handle_WhenEmailAndPhoneBelongToDifferentCandidates_ThrowsConflictException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var affiliate = new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = userId, Status = "ACTIVE" };
        _affiliateProfileRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(affiliate);

        var jobId = Guid.NewGuid();
        var serviceTypeId = Guid.NewGuid();
        var job = new Job { JobId = jobId, Status = JobStatuses.Active, ServiceTypeId = serviceTypeId };
        _jobRepositoryMock.Setup(r => r.GetByIdAsync(jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(job);

        _jobRepositoryMock.Setup(r => r.CanAnyRoleSubmitJobAsync(serviceTypeId, It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var candidate1 = new Candidate { CandidateId = Guid.NewGuid(), Email = "a@example.com" };
        var candidate2 = new Candidate { CandidateId = Guid.NewGuid(), Phone = "0912345678" };

        _candidateRepositoryMock.Setup(r => r.GetByNormalizedEmailAsync("a@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate1);
        _candidateRepositoryMock.Setup(r => r.GetByNormalizedPhoneAsync("0912345678", It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate2);

        var command = new SubmitCandidateCommand
        {
            UserId = userId,
            JobId = jobId,
            FullName = "Nguyen Van A",
            Email = "a@example.com",
            Phone = "0912345678",
            RoleCodes = new[] { "AFFILIATE_RECRUITER" }
        };

        // Act & Assert
        var act = async () => await _handler.Handle(command, CancellationToken.None);
        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("Email và số điện thoại này thuộc về hai ứng viên khác nhau trong hệ thống.");
    }

    [Fact]
    public async Task Handle_WhenCandidateNotFound_CreatesCandidateWithNullUserId_AndProceeds()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var affiliateId = Guid.NewGuid();
        var affiliate = new AffiliateProfile { AffiliateId = affiliateId, UserId = userId, Status = "ACTIVE" };
        _affiliateProfileRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(affiliate);

        var jobId = Guid.NewGuid();
        var serviceTypeId = Guid.NewGuid();
        var job = new Job { JobId = jobId, Status = JobStatuses.Active, ServiceTypeId = serviceTypeId };
        _jobRepositoryMock.Setup(r => r.GetByIdAsync(jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(job);

        _jobRepositoryMock.Setup(r => r.CanAnyRoleSubmitJobAsync(serviceTypeId, It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _candidateRepositoryMock.Setup(r => r.GetByNormalizedEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Candidate?)null);
        _candidateRepositoryMock.Setup(r => r.GetByNormalizedPhoneAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Candidate?)null);

        Candidate? createdCandidate = null;
        _candidateRepositoryMock.Setup(r => r.AddAsync(It.IsAny<Candidate>(), It.IsAny<CancellationToken>()))
            .Callback<Candidate, CancellationToken>((c, ct) => createdCandidate = c)
            .Returns(Task.CompletedTask);

        var cvId = Guid.NewGuid();
        var stream = new MemoryStream(new byte[] { 1, 2, 3 });
        _cvStorageServiceMock.Setup(s => s.UploadCvPdfAsync(It.IsAny<Guid>(), It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<long>(), It.IsAny<string?>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UploadCvResult { CvId = cvId, CandidateId = Guid.NewGuid(), ObjectKey = "candidates/x/cvs/y.pdf", FileName = "cv.pdf", FileSizeBytes = 3, MimeType = "application/pdf" });

        _submissionRepositoryMock.Setup(r => r.GetAcceptedSubmissionAsync(It.IsAny<Guid>(), jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Submission?)null);
        _applicationRepositoryMock.Setup(r => r.GetByCandidateAndJobAsync(It.IsAny<Guid>(), jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((JobApplication?)null);

        var command = new SubmitCandidateCommand
        {
            UserId = userId,
            JobId = jobId,
            FullName = "New Candidate",
            Email = "new@example.com",
            Phone = "0987654321",
            FileStream = stream,
            FileName = "cv.pdf",
            FileSizeBytes = 3,
            RoleCodes = new[] { "AFFILIATE_RECRUITER" }
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        createdCandidate.Should().NotBeNull();
        createdCandidate!.UserId.Should().BeNull(); // Candidate record created without app_user login account
        createdCandidate.FullName.Should().Be("New Candidate");
        result.Data!.CandidateId.Should().Be(createdCandidate.CandidateId);
        result.Data.AttributionId.Should().NotBeEmpty();
        result.Data.AffiliateId.Should().Be(affiliateId);
    }

    [Fact]
    public async Task Handle_WhenCandidateFoundByEmail_ReusesExistingCandidate()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var affiliateId = Guid.NewGuid();
        var affiliate = new AffiliateProfile { AffiliateId = affiliateId, UserId = userId, Status = "ACTIVE" };
        _affiliateProfileRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(affiliate);

        var jobId = Guid.NewGuid();
        var serviceTypeId = Guid.NewGuid();
        var job = new Job { JobId = jobId, Status = JobStatuses.Active, ServiceTypeId = serviceTypeId };
        _jobRepositoryMock.Setup(r => r.GetByIdAsync(jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(job);

        _jobRepositoryMock.Setup(r => r.CanAnyRoleSubmitJobAsync(serviceTypeId, It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var existingCandidate = new Candidate { CandidateId = Guid.NewGuid(), FullName = "Existing", Email = "exist@example.com" };
        _candidateRepositoryMock.Setup(r => r.GetByNormalizedEmailAsync("exist@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingCandidate);

        var cvId = Guid.NewGuid();
        var stream = new MemoryStream(new byte[] { 1, 2, 3 });
        _cvStorageServiceMock.Setup(s => s.UploadCvPdfAsync(existingCandidate.CandidateId, It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<long>(), It.IsAny<string?>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UploadCvResult { CvId = cvId, CandidateId = existingCandidate.CandidateId, ObjectKey = "path", FileName = "cv.pdf", FileSizeBytes = 3, MimeType = "application/pdf" });

        _submissionRepositoryMock.Setup(r => r.GetAcceptedSubmissionAsync(existingCandidate.CandidateId, jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Submission?)null);
        _applicationRepositoryMock.Setup(r => r.GetByCandidateAndJobAsync(existingCandidate.CandidateId, jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((JobApplication?)null);

        var command = new SubmitCandidateCommand
        {
            UserId = userId,
            JobId = jobId,
            FullName = "Existing",
            Email = "exist@example.com",
            FileStream = stream,
            FileName = "cv.pdf",
            RoleCodes = new[] { "AFFILIATE_RECRUITER" }
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.CandidateId.Should().Be(existingCandidate.CandidateId);
        _candidateRepositoryMock.Verify(r => r.AddAsync(It.IsAny<Candidate>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WhenCandidateFoundByPhone_ReusesExistingCandidate()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var affiliate = new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = userId, Status = "ACTIVE" };
        _affiliateProfileRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(affiliate);

        var jobId = Guid.NewGuid();
        var serviceTypeId = Guid.NewGuid();
        var job = new Job { JobId = jobId, Status = JobStatuses.Active, ServiceTypeId = serviceTypeId };
        _jobRepositoryMock.Setup(r => r.GetByIdAsync(jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(job);

        _jobRepositoryMock.Setup(r => r.CanAnyRoleSubmitJobAsync(serviceTypeId, It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var existingCandidate = new Candidate { CandidateId = Guid.NewGuid(), FullName = "ByPhone", Phone = "0912345678" };
        _candidateRepositoryMock.Setup(r => r.GetByNormalizedPhoneAsync("0912345678", It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingCandidate);

        var cvId = Guid.NewGuid();
        var stream = new MemoryStream(new byte[] { 1, 2, 3 });
        _cvStorageServiceMock.Setup(s => s.UploadCvPdfAsync(existingCandidate.CandidateId, It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<long>(), It.IsAny<string?>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UploadCvResult { CvId = cvId, CandidateId = existingCandidate.CandidateId, ObjectKey = "path", FileName = "cv.pdf", FileSizeBytes = 3, MimeType = "application/pdf" });

        _submissionRepositoryMock.Setup(r => r.GetAcceptedSubmissionAsync(existingCandidate.CandidateId, jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Submission?)null);
        _applicationRepositoryMock.Setup(r => r.GetByCandidateAndJobAsync(existingCandidate.CandidateId, jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((JobApplication?)null);

        var command = new SubmitCandidateCommand
        {
            UserId = userId,
            JobId = jobId,
            FullName = "ByPhone",
            Phone = "0912345678",
            FileStream = stream,
            FileName = "cv.pdf",
            RoleCodes = new[] { "AFFILIATE_RECRUITER" }
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.CandidateId.Should().Be(existingCandidate.CandidateId);
    }

    [Fact]
    public async Task Handle_WhenDuplicateSubmissionFound_RecordsBlockedDuplicate_DoesNotCreateAppOrAttribution_ThrowsConflict()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var affiliate = new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = userId, Status = "ACTIVE" };
        _affiliateProfileRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(affiliate);

        var jobId = Guid.NewGuid();
        var serviceTypeId = Guid.NewGuid();
        var job = new Job { JobId = jobId, Status = JobStatuses.Active, ServiceTypeId = serviceTypeId };
        _jobRepositoryMock.Setup(r => r.GetByIdAsync(jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(job);

        _jobRepositoryMock.Setup(r => r.CanAnyRoleSubmitJobAsync(serviceTypeId, It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var candidateId = Guid.NewGuid();
        var existingCandidate = new Candidate { CandidateId = candidateId, FullName = "Dup", Email = "dup@example.com" };
        _candidateRepositoryMock.Setup(r => r.GetByNormalizedEmailAsync("dup@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingCandidate);

        var cvId = Guid.NewGuid();
        var cv = new CandidateCv { CvId = cvId, CandidateId = candidateId, Status = "ACTIVE", SourceFileUrl = "path.pdf" };
        _candidateCvRepositoryMock.Setup(r => r.GetByIdAsync(cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(cv);

        var previousSubmissionId = Guid.NewGuid();
        var acceptedSubmission = new Submission { SubmissionId = previousSubmissionId, CandidateId = candidateId, JobId = jobId, Status = "ACCEPTED" };
        _submissionRepositoryMock.Setup(r => r.GetAcceptedSubmissionAsync(candidateId, jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(acceptedSubmission);

        Submission? blockedSubmission = null;
        _submissionRepositoryMock.Setup(r => r.AddAsync(It.IsAny<Submission>(), It.IsAny<CancellationToken>()))
            .Callback<Submission, CancellationToken>((s, ct) => blockedSubmission = s)
            .Returns(Task.CompletedTask);

        var command = new SubmitCandidateCommand
        {
            UserId = userId,
            JobId = jobId,
            FullName = "Dup",
            Email = "dup@example.com",
            CvId = cvId,
            RoleCodes = new[] { "AFFILIATE_RECRUITER" }
        };

        // Act & Assert
        var act = async () => await _handler.Handle(command, CancellationToken.None);
        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("Ứng viên này đã được nộp vào công việc này trước đó.");

        blockedSubmission.Should().NotBeNull();
        blockedSubmission!.Status.Should().Be("BLOCKED_DUPLICATE");
        blockedSubmission.DuplicateOfSubmissionId.Should().Be(previousSubmissionId);

        _applicationRepositoryMock.Verify(r => r.AddAsync(It.IsAny<JobApplication>(), It.IsAny<CancellationToken>()), Times.Never);
        _attributionRepositoryMock.Verify(r => r.AddAsync(It.IsAny<Attribution>(), It.IsAny<CancellationToken>()), Times.Never);
        _scoringTriggerMock.Verify(t => t.TriggerScoringAsync(It.IsAny<Mf03TriggerPayload>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WhenValidAffiliateSubmission_CreatesAcceptedSubmission_App_Attribution_TriggersMf03()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var affiliateId = Guid.NewGuid();
        var affiliate = new AffiliateProfile { AffiliateId = affiliateId, UserId = userId, Status = "ACTIVE" };
        _affiliateProfileRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(affiliate);

        var jobId = Guid.NewGuid();
        var serviceTypeId = Guid.NewGuid();
        var job = new Job { JobId = jobId, Status = JobStatuses.Active, ServiceTypeId = serviceTypeId };
        _jobRepositoryMock.Setup(r => r.GetByIdAsync(jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(job);

        _jobRepositoryMock.Setup(r => r.CanAnyRoleSubmitJobAsync(serviceTypeId, It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var candidateId = Guid.NewGuid();
        var existingCandidate = new Candidate { CandidateId = candidateId, FullName = "Valid Candidate", Email = "valid@example.com" };
        _candidateRepositoryMock.Setup(r => r.GetByNormalizedEmailAsync("valid@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingCandidate);

        var cvId = Guid.NewGuid();
        var cv = new CandidateCv { CvId = cvId, CandidateId = candidateId, Status = "ACTIVE", SourceFileUrl = "path.pdf" };
        _candidateCvRepositoryMock.Setup(r => r.GetByIdAsync(cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(cv);

        _submissionRepositoryMock.Setup(r => r.GetAcceptedSubmissionAsync(candidateId, jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Submission?)null);
        _applicationRepositoryMock.Setup(r => r.GetByCandidateAndJobAsync(candidateId, jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((JobApplication?)null);

        Submission? createdSubmission = null;
        _submissionRepositoryMock.Setup(r => r.AddAsync(It.IsAny<Submission>(), It.IsAny<CancellationToken>()))
            .Callback<Submission, CancellationToken>((s, ct) => createdSubmission = s)
            .Returns(Task.CompletedTask);

        JobApplication? createdApplication = null;
        _applicationRepositoryMock.Setup(r => r.AddAsync(It.IsAny<JobApplication>(), It.IsAny<CancellationToken>()))
            .Callback<JobApplication, CancellationToken>((a, ct) => createdApplication = a)
            .Returns(Task.CompletedTask);

        Attribution? createdAttribution = null;
        _attributionRepositoryMock.Setup(r => r.AddAsync(It.IsAny<Attribution>(), It.IsAny<CancellationToken>()))
            .Callback<Attribution, CancellationToken>((attr, ct) => createdAttribution = attr)
            .Returns(Task.CompletedTask);

        var command = new SubmitCandidateCommand
        {
            UserId = userId,
            JobId = jobId,
            FullName = "Valid Candidate",
            Email = "valid@example.com",
            CvId = cvId,
            RoleCodes = new[] { "AFFILIATE_RECRUITER" }
        };

        // Act
        var response = await _handler.Handle(command, CancellationToken.None);

        // Assert
        response.Success.Should().BeTrue();
        response.Data.Should().NotBeNull();
        response.Data!.Status.Should().Be("ACCEPTED");
        response.Data.AiStatus.Should().Be("PENDING");

        createdSubmission.Should().NotBeNull();
        createdSubmission!.Status.Should().Be("ACCEPTED");
        createdSubmission.Source.Should().Be("AFFILIATE");
        createdSubmission.SubmittedBy.Should().Be(userId);

        createdApplication.Should().NotBeNull();
        createdApplication!.AcceptedSubmissionId.Should().Be(createdSubmission.SubmissionId);

        createdAttribution.Should().NotBeNull();
        createdAttribution!.ApplicationId.Should().Be(createdApplication.ApplicationId);
        createdAttribution.AffiliateId.Should().Be(affiliateId);
        createdAttribution.WinningSubmissionId.Should().Be(createdSubmission.SubmissionId);

        _unitOfWorkMock.Verify(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _scoringTriggerMock.Verify(t => t.TriggerScoringAsync(
            It.Is<Mf03TriggerPayload>(p => p.ApplicationId == createdApplication.ApplicationId && p.CvId == cvId && p.JobId == jobId),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenConcurrentRaceViolatesUniqueConstraint_RollsBack_DeletesUploadedCv_AndThrowsConflict()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var affiliateId = Guid.NewGuid();
        var affiliate = new AffiliateProfile { AffiliateId = affiliateId, UserId = userId, Status = "ACTIVE" };
        _affiliateProfileRepositoryMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(affiliate);

        var jobId = Guid.NewGuid();
        var serviceTypeId = Guid.NewGuid();
        var job = new Job { JobId = jobId, Status = JobStatuses.Active, ServiceTypeId = serviceTypeId };
        _jobRepositoryMock.Setup(r => r.GetByIdAsync(jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(job);

        _jobRepositoryMock.Setup(r => r.CanAnyRoleSubmitJobAsync(serviceTypeId, It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var candidateId = Guid.NewGuid();
        var candidate = new Candidate { CandidateId = candidateId, FullName = "Racing Candidate", Email = "race@example.com" };
        _candidateRepositoryMock.Setup(r => r.GetByNormalizedEmailAsync("race@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        // Initial duplicate query returns null for both (both requests think they are first)
        _submissionRepositoryMock.Setup(r => r.GetAcceptedSubmissionAsync(candidateId, jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Submission?)null);
        _applicationRepositoryMock.Setup(r => r.GetByCandidateAndJobAsync(candidateId, jobId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((JobApplication?)null);

        var cvId = Guid.NewGuid();
        var stream = new MemoryStream(new byte[] { 1, 2, 3 });
        _cvStorageServiceMock.Setup(s => s.UploadCvPdfAsync(candidateId, stream, "cv.pdf", 3, null, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UploadCvResult { CvId = cvId, CandidateId = candidateId, FileName = "cv.pdf" });

        // Database throws 23505 unique constraint violation on commit
        _unitOfWorkMock.Setup(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("duplicate key value violates unique constraint \"uq_submission_one_accepted\" 23505"));

        var command = new SubmitCandidateCommand
        {
            UserId = userId,
            JobId = jobId,
            FullName = "Racing Candidate",
            Email = "race@example.com",
            FileStream = stream,
            FileName = "cv.pdf",
            FileSizeBytes = 3,
            RoleCodes = new[] { "AFFILIATE_RECRUITER" }
        };

        // Act
        Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*đã được nộp vào công việc này trước đó*");

        _unitOfWorkMock.Verify(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _cvStorageServiceMock.Verify(s => s.DeleteCvAsync(cvId, It.IsAny<CancellationToken>()), Times.Once);
        _scoringTriggerMock.Verify(t => t.TriggerScoringAsync(It.IsAny<Mf03TriggerPayload>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
