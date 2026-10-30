using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Services.Admin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace HRConnect.UnitTests.Services.Admin;

public class AdminApprovalServiceTests
{
    private readonly ApplicationDbContext _context;
    private readonly Mock<IAuditLogService> _auditLogServiceMock;
    private readonly Mock<ILogger<AdminApprovalService>> _loggerMock;
    private readonly AdminApprovalService _service;

    public AdminApprovalServiceTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _context = new ApplicationDbContext(options);
        _auditLogServiceMock = new Mock<IAuditLogService>();
        _loggerMock = new Mock<ILogger<AdminApprovalService>>();

        _service = new AdminApprovalService(
            _context,
            _auditLogServiceMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task ApproveAffiliateApplicationAsync_WhenReviewWasChangedConcurrently_ReturnsControlledConflict()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        await using var context = new ConcurrencyFailureDbContext(options);
        var user = new AppUser
        {
            UserId = Guid.NewGuid(), Email = "affiliate.concurrent@example.com", PasswordHash = "hash",
            DisplayName = "Concurrent Affiliate", Status = "PENDING", EmailVerifiedAt = DateTime.UtcNow
        };
        var role = new Role
        {
            RoleId = Guid.NewGuid(), Code = "AFFILIATE", Name = "Affiliate", IsActive = true
        };
        var application = new AffiliateApplication
        {
            AffiliateApplicationId = Guid.NewGuid(), UserId = user.UserId,
            AffiliateType = "STANDARD", Status = "UNDER_REVIEW", SubmittedData = "{}"
        };
        await context.AddRangeAsync(user, role, application);
        await context.SaveChangesAsync();
        context.FailNextSaveWithConcurrency = true;
        var service = new AdminApprovalService(
            context,
            Mock.Of<IAuditLogService>(),
            Mock.Of<ILogger<AdminApprovalService>>());

        var action = () => service.ApproveAffiliateApplicationAsync(
            application.AffiliateApplicationId, Guid.NewGuid());

        var error = await action.Should().ThrowAsync<ConflictException>();
        error.Which.ErrorCode.Should().Be("CONCURRENT_UPDATE");
    }

    [Fact]
    public async Task ApproveAffiliateApplicationAsync_ShouldApproveAndGrantRoleAndActivateUser()
    {
        // Arrange
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "affiliate@example.com",
            PasswordHash = "hash",
            DisplayName = "Affiliate",
            Status = "PENDING",
            EmailVerifiedAt = DateTime.UtcNow
        };
        var role = new Role
        {
            RoleId = Guid.NewGuid(),
            Code = "AFFILIATE",
            Name = "Affiliate",
            IsActive = true
        };
        var application = new AffiliateApplication
        {
            AffiliateApplicationId = Guid.NewGuid(),
            UserId = user.UserId,
            AffiliateType = "STANDARD",
            Status = "UNDER_REVIEW",
            SubmittedData = "{}"
        };

        await _context.AppUsers.AddAsync(user);
        await _context.Roles.AddAsync(role);
        await _context.AffiliateApplications.AddAsync(application);
        await _context.SaveChangesAsync();

        var adminId = Guid.NewGuid();

        // Act
        await _service.ApproveAffiliateApplicationAsync(application.AffiliateApplicationId, adminId, "Approved by QA");

        // Assert
        var updatedApp = await _context.AffiliateApplications.FindAsync(application.AffiliateApplicationId);
        updatedApp!.Status.Should().Be("APPROVED");
        updatedApp.ReviewedBy.Should().Be(adminId);
        updatedApp.ReviewNote.Should().Be("Approved by QA");

        var updatedUser = await _context.AppUsers.FindAsync(user.UserId);
        updatedUser!.Status.Should().Be("ACTIVE");

        var userRole = await _context.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == user.UserId);
        userRole.Should().NotBeNull();
        userRole!.RoleId.Should().Be(role.RoleId);
        userRole.Status.Should().Be("ACTIVE");

        var profile = await _context.AffiliateProfiles.FirstOrDefaultAsync(p => p.UserId == user.UserId);
        profile.Should().NotBeNull();
        profile!.Status.Should().Be("ACTIVE");

        (await _context.EmailOutboxes.SingleAsync()).TemplateCode.Should().Be("AFFILIATE_REGISTRATION_APPROVED");
        _auditLogServiceMock.Verify(audit => audit.AddAsync(
            It.Is<AuditEntry>(entry => entry.Action == AuditActions.AffiliateApproved && entry.ActorUserId == adminId),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RejectAffiliateApplicationAsync_ShouldRejectWithoutGrantingRole()
    {
        // Arrange
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "affiliate_rej@example.com",
            PasswordHash = "hash",
            DisplayName = "Affiliate Rejected",
            Status = "PENDING",
            EmailVerifiedAt = DateTime.UtcNow
        };
        var application = new AffiliateApplication
        {
            AffiliateApplicationId = Guid.NewGuid(),
            UserId = user.UserId,
            AffiliateType = "STANDARD",
            Status = "UNDER_REVIEW",
            SubmittedData = "{}"
        };

        await _context.AppUsers.AddAsync(user);
        await _context.AffiliateApplications.AddAsync(application);
        await _context.SaveChangesAsync();

        var adminId = Guid.NewGuid();

        // Act
        await _service.RejectAffiliateApplicationAsync(application.AffiliateApplicationId, adminId, "Incomplete documentation");

        // Assert
        var updatedApp = await _context.AffiliateApplications.FindAsync(application.AffiliateApplicationId);
        updatedApp!.Status.Should().Be("REJECTED");
        updatedApp.ReviewedBy.Should().Be(adminId);
        updatedApp.ReviewNote.Should().Be("Incomplete documentation");

        var userRole = await _context.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == user.UserId);
        userRole.Should().BeNull();
        (await _context.EmailOutboxes.SingleAsync()).TemplateCode.Should().Be("AFFILIATE_REGISTRATION_REJECTED");
        _auditLogServiceMock.Verify(audit => audit.AddAsync(
            It.Is<AuditEntry>(entry => entry.Action == AuditActions.AffiliateRejected && entry.ActorUserId == adminId),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ApproveCompanyVerificationRequestAsync_ShouldApproveAndGrantRoleAndVerifyCompany()
    {
        // Arrange
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "client@example.com",
            PasswordHash = "hash",
            DisplayName = "Client Rep",
            Status = "PENDING",
            EmailVerifiedAt = DateTime.UtcNow
        };
        var role = new Role
        {
            RoleId = Guid.NewGuid(),
            Code = "CLIENT_COMPANY_USER",
            Name = "Client Company User",
            IsActive = true
        };
        var company = new Company
        {
            CompanyId = Guid.NewGuid(),
            CompanyName = "Enterprise Tech",
            VerificationStatus = "UNDER_REVIEW"
        };
        var request = new CompanyVerificationRequest
        {
            CompanyVerificationRequestId = Guid.NewGuid(),
            CompanyId = company.CompanyId,
            SubmittedBy = user.UserId,
            Status = "UNDER_REVIEW",
            SubmittedPayload = "{}"
        };
        var companyUser = new CompanyUser
        {
            CompanyUserId = Guid.NewGuid(),
            CompanyId = company.CompanyId,
            UserId = user.UserId,
            RoleInCompany = "Primary contact",
            IsPrimaryContact = true,
            Status = "PENDING",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _context.AppUsers.AddAsync(user);
        await _context.Roles.AddAsync(role);
        await _context.Companies.AddAsync(company);
        await _context.CompanyUsers.AddAsync(companyUser);
        await _context.CompanyVerificationRequests.AddAsync(request);
        await _context.SaveChangesAsync();

        var adminId = Guid.NewGuid();

        // Act
        await _service.ApproveCompanyVerificationRequestAsync(request.CompanyVerificationRequestId, adminId, "All verified");

        // Assert
        var updatedReq = await _context.CompanyVerificationRequests.FindAsync(request.CompanyVerificationRequestId);
        updatedReq!.Status.Should().Be("APPROVED");
        updatedReq.ReviewedBy.Should().Be(adminId);

        var updatedCompany = await _context.Companies.FindAsync(company.CompanyId);
        updatedCompany!.VerificationStatus.Should().Be("VERIFIED");

        var updatedUser = await _context.AppUsers.FindAsync(user.UserId);
        updatedUser!.Status.Should().Be("ACTIVE");

        var userRole = await _context.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == user.UserId);
        userRole.Should().NotBeNull();
        userRole!.RoleId.Should().Be(role.RoleId);
        userRole.Status.Should().Be("ACTIVE");
        (await _context.CompanyUsers.SingleAsync()).Status.Should().Be("ACTIVE");
        (await _context.EmailOutboxes.SingleAsync()).TemplateCode.Should().Be("CLIENT_REGISTRATION_APPROVED");
        _auditLogServiceMock.Verify(audit => audit.AddAsync(
            It.Is<AuditEntry>(entry => entry.Action == AuditActions.ClientApproved && entry.ActorUserId == adminId),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ApproveCompanyVerificationRequestAsync_WhenCompanyMembershipIsMissing_ReturnsConflictWithoutPartialApproval()
    {
        var user = new AppUser
        {
            UserId = Guid.NewGuid(), Email = "client.missing-membership@example.com", PasswordHash = "hash",
            DisplayName = "Missing membership", Status = "PENDING", EmailVerifiedAt = DateTime.UtcNow
        };
        var role = new Role
        {
            RoleId = Guid.NewGuid(), Code = "CLIENT_COMPANY_USER", Name = "Client Company User", IsActive = true
        };
        var company = new Company
        {
            CompanyId = Guid.NewGuid(), CompanyName = "Broken Membership Corp", VerificationStatus = "UNDER_REVIEW"
        };
        var request = new CompanyVerificationRequest
        {
            CompanyVerificationRequestId = Guid.NewGuid(), CompanyId = company.CompanyId,
            SubmittedBy = user.UserId, Status = "UNDER_REVIEW", SubmittedPayload = "{}"
        };
        await _context.AddRangeAsync(user, role, company, request);
        await _context.SaveChangesAsync();

        var action = () => _service.ApproveCompanyVerificationRequestAsync(
            request.CompanyVerificationRequestId, Guid.NewGuid());

        var error = await action.Should().ThrowAsync<ConflictException>();
        error.Which.ErrorCode.Should().Be("COMPANY_MEMBERSHIP_MISSING");
        request.Status.Should().Be("UNDER_REVIEW");
        company.VerificationStatus.Should().Be("UNDER_REVIEW");
        user.Status.Should().Be("PENDING");
        (await _context.UserRoles.CountAsync()).Should().Be(0);
        (await _context.EmailOutboxes.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task ApproveAffiliateApplicationAsync_WhenAccountIsNotPending_ReturnsConflictWithoutGrantingRole()
    {
        var user = new AppUser
        {
            UserId = Guid.NewGuid(), Email = "affiliate.invalid-status@example.com", PasswordHash = "hash",
            DisplayName = "Invalid status", Status = "SUSPENDED", EmailVerifiedAt = DateTime.UtcNow
        };
        var role = new Role
        {
            RoleId = Guid.NewGuid(), Code = "AFFILIATE", Name = "Affiliate", IsActive = true
        };
        var application = new AffiliateApplication
        {
            AffiliateApplicationId = Guid.NewGuid(), UserId = user.UserId,
            AffiliateType = "STANDARD", Status = "UNDER_REVIEW", SubmittedData = "{}"
        };
        await _context.AddRangeAsync(user, role, application);
        await _context.SaveChangesAsync();

        var action = () => _service.ApproveAffiliateApplicationAsync(
            application.AffiliateApplicationId, Guid.NewGuid());

        var error = await action.Should().ThrowAsync<ConflictException>();
        error.Which.ErrorCode.Should().Be("ACCOUNT_NOT_PENDING_APPROVAL");
        application.Status.Should().Be("UNDER_REVIEW");
        user.Status.Should().Be("SUSPENDED");
        (await _context.UserRoles.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task RejectCompanyVerificationRequestAsync_ShouldRejectWithoutGrantingRole()
    {
        // Arrange
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "client_rej@example.com",
            PasswordHash = "hash",
            DisplayName = "Client Rejected",
            Status = "PENDING",
            EmailVerifiedAt = DateTime.UtcNow
        };
        var company = new Company
        {
            CompanyId = Guid.NewGuid(),
            CompanyName = "Suspicious Tech",
            VerificationStatus = "UNDER_REVIEW"
        };
        var request = new CompanyVerificationRequest
        {
            CompanyVerificationRequestId = Guid.NewGuid(),
            CompanyId = company.CompanyId,
            SubmittedBy = user.UserId,
            Status = "UNDER_REVIEW",
            SubmittedPayload = "{}"
        };

        await _context.AppUsers.AddAsync(user);
        await _context.Companies.AddAsync(company);
        await _context.CompanyVerificationRequests.AddAsync(request);
        await _context.SaveChangesAsync();

        var adminId = Guid.NewGuid();

        // Act
        await _service.RejectCompanyVerificationRequestAsync(request.CompanyVerificationRequestId, adminId, "Invalid tax ID");

        // Assert
        var updatedReq = await _context.CompanyVerificationRequests.FindAsync(request.CompanyVerificationRequestId);
        updatedReq!.Status.Should().Be("REJECTED");

        var updatedCompany = await _context.Companies.FindAsync(company.CompanyId);
        updatedCompany!.VerificationStatus.Should().Be("REJECTED");

        var userRole = await _context.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == user.UserId);
        userRole.Should().BeNull();
        (await _context.EmailOutboxes.SingleAsync()).TemplateCode.Should().Be("CLIENT_REGISTRATION_REJECTED");
        _auditLogServiceMock.Verify(audit => audit.AddAsync(
            It.Is<AuditEntry>(entry => entry.Action == AuditActions.ClientRejected && entry.ActorUserId == adminId),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ApproveAffiliateApplicationAsync_ShouldThrowConflict_WhenAlreadyApproved()
    {
        // Arrange
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "affiliate_dup@example.com",
            PasswordHash = "hash",
            DisplayName = "Affiliate Dup",
            Status = "ACTIVE"
        };
        var application = new AffiliateApplication
        {
            AffiliateApplicationId = Guid.NewGuid(),
            UserId = user.UserId,
            AffiliateType = "STANDARD",
            Status = "APPROVED",
            SubmittedData = "{}"
        };

        await _context.AppUsers.AddAsync(user);
        await _context.AffiliateApplications.AddAsync(application);
        await _context.SaveChangesAsync();

        // Act & Assert
        await Assert.ThrowsAsync<ConflictException>(() =>
            _service.ApproveAffiliateApplicationAsync(application.AffiliateApplicationId, Guid.NewGuid()));
    }

    [Fact]
    public async Task ApproveCompanyVerificationRequestAsync_ShouldThrowConflict_WhenAlreadyApproved()
    {
        // Arrange
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "client_dup@example.com",
            PasswordHash = "hash",
            DisplayName = "Client Dup",
            Status = "ACTIVE"
        };
        var company = new Company
        {
            CompanyId = Guid.NewGuid(),
            CompanyName = "Dup Corp",
            VerificationStatus = "VERIFIED"
        };
        var request = new CompanyVerificationRequest
        {
            CompanyVerificationRequestId = Guid.NewGuid(),
            CompanyId = company.CompanyId,
            SubmittedBy = user.UserId,
            Status = "APPROVED",
            SubmittedPayload = "{}"
        };

        await _context.AppUsers.AddAsync(user);
        await _context.Companies.AddAsync(company);
        await _context.CompanyVerificationRequests.AddAsync(request);
        await _context.SaveChangesAsync();

        // Act & Assert
        await Assert.ThrowsAsync<ConflictException>(() =>
            _service.ApproveCompanyVerificationRequestAsync(request.CompanyVerificationRequestId, Guid.NewGuid()));
    }

    [Fact]
    public async Task ApproveAffiliateApplicationAsync_ShouldRejectPendingApplicationBeforeOtpVerification()
    {
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "affiliate_pending@example.com",
            PasswordHash = "hash",
            Status = "PENDING",
            EmailVerifiedAt = null
        };
        var application = new AffiliateApplication
        {
            AffiliateApplicationId = Guid.NewGuid(),
            UserId = user.UserId,
            AffiliateType = "STANDARD",
            Status = "PENDING",
            SubmittedData = "{}"
        };

        await _context.AddRangeAsync(user, application);
        await _context.SaveChangesAsync();

        var act = () => _service.ApproveAffiliateApplicationAsync(application.AffiliateApplicationId, Guid.NewGuid());

        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*chưa xác thực email*");
        application.Status.Should().Be("PENDING");
        user.Status.Should().Be("PENDING");
    }

    [Fact]
    public async Task ApproveCompanyVerificationRequestAsync_ShouldRejectPendingRequestBeforeOtpVerification()
    {
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "client_pending@example.com",
            PasswordHash = "hash",
            Status = "PENDING",
            EmailVerifiedAt = null
        };
        var company = new Company
        {
            CompanyId = Guid.NewGuid(),
            CompanyName = "Pending Company",
            VerificationStatus = "PENDING"
        };
        var request = new CompanyVerificationRequest
        {
            CompanyVerificationRequestId = Guid.NewGuid(),
            CompanyId = company.CompanyId,
            SubmittedBy = user.UserId,
            Status = "PENDING",
            SubmittedPayload = "{}"
        };

        await _context.AddRangeAsync(user, company, request);
        await _context.SaveChangesAsync();

        var act = () => _service.ApproveCompanyVerificationRequestAsync(request.CompanyVerificationRequestId, Guid.NewGuid());

        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*chưa xác thực email*");
        request.Status.Should().Be("PENDING");
        company.VerificationStatus.Should().Be("PENDING");
        user.Status.Should().Be("PENDING");
    }

    [Fact]
    public async Task ApproveAffiliateApplicationAsync_WhenRequiredRoleIsInactive_DoesNotApproveAnything()
    {
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "affiliate.role-disabled@example.com",
            PasswordHash = "hash",
            Status = "PENDING",
            EmailVerifiedAt = DateTime.UtcNow
        };
        var application = new AffiliateApplication
        {
            AffiliateApplicationId = Guid.NewGuid(),
            UserId = user.UserId,
            AffiliateType = "STANDARD",
            Status = "UNDER_REVIEW",
            SubmittedData = "{}"
        };
        var role = new Role
        {
            RoleId = Guid.NewGuid(),
            Code = "AFFILIATE",
            Name = "Affiliate",
            IsActive = false
        };
        await _context.AddRangeAsync(user, application, role);
        await _context.SaveChangesAsync();

        var action = () => _service.ApproveAffiliateApplicationAsync(
            application.AffiliateApplicationId, Guid.NewGuid());

        await action.Should().ThrowAsync<ConflictException>()
            .WithMessage("*thiếu hoặc đã bị tắt*");
        application.Status.Should().Be("UNDER_REVIEW");
        user.Status.Should().Be("PENDING");
        (await _context.UserRoles.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task ApproveCompanyVerificationRequestAsync_WhenRequiredRoleIsMissing_DoesNotApproveAnything()
    {
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "client.role-missing@example.com",
            PasswordHash = "hash",
            Status = "PENDING",
            EmailVerifiedAt = DateTime.UtcNow
        };
        var company = new Company
        {
            CompanyId = Guid.NewGuid(),
            CompanyName = "Missing Role Corp",
            VerificationStatus = "UNDER_REVIEW"
        };
        var request = new CompanyVerificationRequest
        {
            CompanyVerificationRequestId = Guid.NewGuid(),
            CompanyId = company.CompanyId,
            SubmittedBy = user.UserId,
            Status = "UNDER_REVIEW",
            SubmittedPayload = "{}"
        };
        await _context.AddRangeAsync(user, company, request);
        await _context.SaveChangesAsync();

        var action = () => _service.ApproveCompanyVerificationRequestAsync(
            request.CompanyVerificationRequestId, Guid.NewGuid());

        await action.Should().ThrowAsync<ConflictException>()
            .WithMessage("*thiếu hoặc đã bị tắt*");
        request.Status.Should().Be("UNDER_REVIEW");
        company.VerificationStatus.Should().Be("UNDER_REVIEW");
        user.Status.Should().Be("PENDING");
        (await _context.UserRoles.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task ApproveAffiliateApplicationAsync_ReactivationClearsRevocationMetadataAndRotatesToken()
    {
        var previousToken = Guid.NewGuid();
        var user = new AppUser
        {
            UserId = Guid.NewGuid(), Email = "affiliate.reactivate@example.com", PasswordHash = "hash",
            Status = "PENDING", EmailVerifiedAt = DateTime.UtcNow,
            AuthorizationConcurrencyToken = previousToken
        };
        var role = new Role
        {
            RoleId = Guid.NewGuid(), Code = "AFFILIATE", Name = "Affiliate", IsActive = true
        };
        var assignment = new UserRole
        {
            UserId = user.UserId, RoleId = role.RoleId, Status = "REVOKED",
            AssignmentSource = "LEGACY", AssignedAt = DateTime.UtcNow.AddMonths(-2),
            RevokedAt = DateTime.UtcNow.AddDays(-1), RevokedBy = Guid.NewGuid(), RevokeReason = "Tạm ngừng"
        };
        var application = new AffiliateApplication
        {
            AffiliateApplicationId = Guid.NewGuid(), UserId = user.UserId,
            AffiliateType = "STANDARD", Status = "UNDER_REVIEW", SubmittedData = "{}"
        };
        await _context.AddRangeAsync(user, role, assignment, application);
        await _context.SaveChangesAsync();
        var adminId = Guid.NewGuid();

        await _service.ApproveAffiliateApplicationAsync(application.AffiliateApplicationId, adminId, "Duyệt lại");

        assignment.Status.Should().Be("ACTIVE");
        assignment.AssignmentSource.Should().Be("AFFILIATE_APPROVAL");
        assignment.AssignedBy.Should().Be(adminId);
        assignment.RevokedAt.Should().BeNull();
        assignment.RevokedBy.Should().BeNull();
        assignment.RevokeReason.Should().BeNull();
        user.AuthorizationConcurrencyToken.Should().NotBe(previousToken);
    }

    [Fact]
    public async Task ApproveAffiliateApplicationAsync_ShouldThrowNotFound_WhenNotExists()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.ApproveAffiliateApplicationAsync(Guid.NewGuid(), Guid.NewGuid()));
    }

    [Fact]
    public async Task ApproveCompanyVerificationRequestAsync_ShouldThrowNotFound_WhenNotExists()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.ApproveCompanyVerificationRequestAsync(Guid.NewGuid(), Guid.NewGuid()));
    }

    private sealed class ConcurrencyFailureDbContext(DbContextOptions<ApplicationDbContext> options)
        : ApplicationDbContext(options)
    {
        public bool FailNextSaveWithConcurrency { get; set; }

        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            if (FailNextSaveWithConcurrency)
            {
                FailNextSaveWithConcurrency = false;
                throw new DbUpdateConcurrencyException("Simulated concurrent review.");
            }

            return base.SaveChangesAsync(cancellationToken);
        }
    }
}
