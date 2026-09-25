using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Auth.Commands.RegisterCandidate;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

namespace HRConnect.UnitTests.Features.Auth.RegisterCandidate;

public class RegisterCandidateCommandHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<ICandidateRepository> _candidateRepositoryMock;
    private readonly Mock<IRoleRepository> _roleRepositoryMock;
    private readonly Mock<IUserRoleRepository> _userRoleRepositoryMock;
    private readonly Mock<IUserTokenRepository> _userTokenRepositoryMock;
    private readonly Mock<IEmailOutboxRepository> _emailOutboxRepositoryMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IPasswordHasher> _passwordHasherMock;
    private readonly Mock<IOtpService> _otpServiceMock;
    private readonly Mock<IPhoneNormalizer> _phoneNormalizerMock;
    private readonly Mock<IEmailNormalizer> _emailNormalizerMock;
    private readonly Mock<IEmailService> _emailServiceMock;
    private readonly Mock<ILogger<RegisterCandidateCommandHandler>> _loggerMock;
    private readonly IOptions<AuthenticationSettings> _authOptions;

    private readonly RegisterCandidateCommandHandler _handler;

    public RegisterCandidateCommandHandlerTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _candidateRepositoryMock = new Mock<ICandidateRepository>();
        _roleRepositoryMock = new Mock<IRoleRepository>();
        _userRoleRepositoryMock = new Mock<IUserRoleRepository>();
        _userTokenRepositoryMock = new Mock<IUserTokenRepository>();
        _emailOutboxRepositoryMock = new Mock<IEmailOutboxRepository>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _passwordHasherMock = new Mock<IPasswordHasher>();
        _otpServiceMock = new Mock<IOtpService>();
        _phoneNormalizerMock = new Mock<IPhoneNormalizer>();
        _emailNormalizerMock = new Mock<IEmailNormalizer>();
        _emailServiceMock = new Mock<IEmailService>();
        _loggerMock = new Mock<ILogger<RegisterCandidateCommandHandler>>();

        _authOptions = Options.Create(new AuthenticationSettings
        {
            Otp = new OtpSettings
            {
                Length = 6,
                ExpirationMinutes = 15
            }
        });

        _handler = new RegisterCandidateCommandHandler(
            _userRepositoryMock.Object,
            _candidateRepositoryMock.Object,
            _roleRepositoryMock.Object,
            _userRoleRepositoryMock.Object,
            _userTokenRepositoryMock.Object,
            _emailOutboxRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _passwordHasherMock.Object,
            _otpServiceMock.Object,
            _phoneNormalizerMock.Object,
            _emailNormalizerMock.Object,
            _emailServiceMock.Object,
            _authOptions,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldThrowConflictException_WhenEmailAlreadyExists()
    {
        // Arrange
        var command = new RegisterCandidateCommand(
            Email: "existing@example.com",
            Password: "Password@123",
            FullName: "Nguyen Van A"
        );

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email))
            .Returns("existing@example.com");
        _userRepositoryMock.Setup(x => x.ExistsByEmailAsync("existing@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*Email này đã được sử dụng*");
    }

    [Fact]
    public async Task Handle_ShouldThrowConflictException_WhenCandidateProfileAlreadyLinkedToAnotherAccount()
    {
        // Arrange
        var command = new RegisterCandidateCommand(
            Email: "candidate@example.com",
            Password: "Password@123",
            FullName: "Nguyen Van A",
            Phone: "0901234567"
        );

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email))
            .Returns("candidate@example.com");
        _phoneNormalizerMock.Setup(x => x.Normalize(command.Phone))
            .Returns("0901234567");

        _userRepositoryMock.Setup(x => x.ExistsByEmailAsync("candidate@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var existingCandidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            Email = "candidate@example.com",
            UserId = Guid.NewGuid() // Already linked!
        };

        _candidateRepositoryMock.Setup(x => x.GetByNormalizedEmailAsync("candidate@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingCandidate);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*đã được liên kết với một tài khoản khác*");
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Handle_ShouldRegisterWithoutClaimingExistingCandidateBeforeOtp(bool candidateExists)
    {
        // Arrange
        var command = new RegisterCandidateCommand(
            Email: "candidate@example.com",
            Password: "Password@123",
            FullName: "Nguyen Van A",
            Phone: "0901234567"
        );

        _emailNormalizerMock.Setup(x => x.Normalize(command.Email)).Returns("candidate@example.com");
        _phoneNormalizerMock.Setup(x => x.Normalize(command.Phone)).Returns("0901234567");

        _userRepositoryMock.Setup(x => x.ExistsByEmailAsync("candidate@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var unlinkedCandidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            Email = "candidate@example.com",
            UserId = null // Unlinked candidate record!
        };

        _candidateRepositoryMock.Setup(x => x.GetByNormalizedEmailAsync("candidate@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidateExists ? unlinkedCandidate : null);

        var candidateRole = new Role
        {
            RoleId = Guid.NewGuid(),
            Code = "CANDIDATE",
            Name = "Candidate"
        };
        _roleRepositoryMock.Setup(x => x.GetByCodeAsync("CANDIDATE", It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidateRole);

        _passwordHasherMock.Setup(x => x.Hash(command.Password))
            .Returns("hashed_password_xyz");
        _otpServiceMock.Setup(x => x.GenerateNumericOtp(6))
            .Returns("123456");
        _otpServiceMock.Setup(x => x.HashOtp("123456"))
            .Returns("hashed_otp_sha256");

        _emailServiceMock.Setup(x => x.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(EmailResult.Success("msg_123"));

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data!.Email.Should().Be("candidate@example.com");
        result.Data.Status.Should().Be("PENDING");

        // Existing recruitment data must remain unclaimed until email verification succeeds.
        unlinkedCandidate.UserId.Should().BeNull();
        _candidateRepositoryMock.Verify(x => x.Update(It.IsAny<Candidate>()), Times.Never);
        _candidateRepositoryMock.Verify(x => x.TryLinkByVerifiedEmailAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        _candidateRepositoryMock.Verify(x => x.AddAsync(It.Is<Candidate>(c => c.UserId == result.Data.UserId), It.IsAny<CancellationToken>()), candidateExists ? Times.Never() : Times.Once());

        // Verify user added and transaction committed
        _userRepositoryMock.Verify(x => x.AddAsync(It.IsAny<AppUser>(), It.IsAny<CancellationToken>()), Times.Once);
        _userRoleRepositoryMock.Verify(x => x.AddAsync(It.IsAny<UserRole>(), It.IsAny<CancellationToken>()), Times.Once);
        _userTokenRepositoryMock.Verify(x => x.AddAsync(It.IsAny<UserToken>(), It.IsAny<CancellationToken>()), Times.Once);
        _emailOutboxRepositoryMock.Verify(x => x.AddAsync(It.IsAny<EmailOutbox>(), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
