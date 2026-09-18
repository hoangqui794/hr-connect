using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
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
    private readonly Mock<IEmailService> _emailServiceMock;
    private readonly Mock<ILogger<AdminApprovalService>> _loggerMock;
    private readonly AdminApprovalService _service;

    public AdminApprovalServiceTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _context = new ApplicationDbContext(options);
        _emailServiceMock = new Mock<IEmailService>();
        _loggerMock = new Mock<ILogger<AdminApprovalService>>();

        _service = new AdminApprovalService(
            _context,
            _emailServiceMock.Object,
            _loggerMock.Object);
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
            DisplayName = "Affiliate Recruiter",
            Status = "PENDING"
        };
        var role = new Role
        {
            RoleId = Guid.NewGuid(),
            Code = "AFFILIATE_RECRUITER",
            Name = "Affiliate Recruiter"
        };
        var application = new AffiliateApplication
        {
            AffiliateApplicationId = Guid.NewGuid(),
            UserId = user.UserId,
            AffiliateType = "RECRUITER",
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
            Status = "PENDING"
        };
        var application = new AffiliateApplication
        {
            AffiliateApplicationId = Guid.NewGuid(),
            UserId = user.UserId,
            AffiliateType = "RECRUITER",
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
            Status = "PENDING"
        };
        var role = new Role
        {
            RoleId = Guid.NewGuid(),
            Code = "CLIENT_COMPANY_USER",
            Name = "Client Company User"
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

        await _context.AppUsers.AddAsync(user);
        await _context.Roles.AddAsync(role);
        await _context.Companies.AddAsync(company);
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
            Status = "PENDING"
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
    }
}
