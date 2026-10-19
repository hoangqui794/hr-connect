using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Features.Companies.Commands.UpdateCompanyProfile;
using HRConnect.Application.Features.Companies.Directory;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Persistence.Seed;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Companies;

/// <summary>BE-02 A + B + C: industry taxonomy, company directory, experience filter.</summary>
public class CompanyDirectoryTests
{
    private readonly ApplicationDbContext _context = new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private readonly Guid _adminId = Guid.NewGuid();

    private CompanyDirectoryHandlers Handlers() =>
        new(new CompanyDirectoryRepository(_context), new UnitOfWork(_context), Mock.Of<IAuditLogService>());

    private Industry Industry(string code) => _context.Industries.Single(i => i.Code == code);

    private (ServiceType Visible, ServiceType Hidden) SeedServiceTypes()
    {
        var now = DateTime.UtcNow;
        var role = new Role { RoleId = Guid.NewGuid(), Code = "CANDIDATE", Name = "Candidate", IsActive = true };
        var visible = new ServiceType { ServiceTypeId = Guid.NewGuid(), Code = "CV_APPLICATION", Name = "CV" };
        var hidden = new ServiceType { ServiceTypeId = Guid.NewGuid(), Code = "CV_SOURCING", Name = "Sourcing" };
        _context.AddRange(role, visible, hidden,
            new ServiceTypeAllowedRole { ServiceTypeId = visible.ServiceTypeId, RoleId = role.RoleId, CanView = true, CreatedAt = now, UpdatedAt = now },
            new ServiceTypeAllowedRole { ServiceTypeId = hidden.ServiceTypeId, RoleId = role.RoleId, CanView = false, CreatedAt = now, UpdatedAt = now });
        _context.SaveChanges();
        return (visible, hidden);
    }

    private Company SeedCompany(string name, string status = "VERIFIED", string? industryCode = null)
    {
        var now = DateTime.UtcNow;
        var company = new Company
        {
            CompanyId = Guid.NewGuid(), CompanyName = name, TaxCode = "0101", VerificationStatus = status,
            IndustryId = industryCode == null ? null : Industry(industryCode).IndustryId, CreatedAt = now, UpdatedAt = now,
        };
        _context.Add(company);
        _context.SaveChanges();
        return company;
    }

    private Job SeedJob(Company company, ServiceType serviceType, int? minYears = null, int? maxYears = null)
    {
        var now = DateTime.UtcNow;
        var job = new Job
        {
            JobId = Guid.NewGuid(), CompanyId = company.CompanyId, ServiceTypeId = serviceType.ServiceTypeId, CreatedBy = Guid.NewGuid(),
            Title = "Job", CurrencyCode = "VND", Quantity = 1, Status = "ACTIVE", PostedAt = now, MinExperienceYears = minYears,
            MaxExperienceYears = maxYears, CreatedAt = now, UpdatedAt = now, ConcurrencyToken = Guid.NewGuid(),
        };
        _context.Add(job);
        _context.SaveChanges();
        return job;
    }

    [Fact]
    public async Task Seed_ShouldLoadCsvOnce_AndLinkOldFreeText()
    {
        var now = DateTime.UtcNow;
        _context.Add(new Company
        {
            CompanyId = Guid.NewGuid(), CompanyName = "Cũ", VerificationStatus = "VERIFIED", Industry = "Software Development",
            CompanySize = "51-200", CreatedAt = now, UpdatedAt = now,
        });
        _context.SaveChanges();

        await CompanyTaxonomySeeder.SeedAsync(_context);
        await CompanyTaxonomySeeder.SeedAsync(_context);

        _context.Industries.Count(i => i.Level == 1).Should().Be(15);
        _context.Industries.Count(i => i.Level == 2).Should().Be(141);
        _context.CompanySizes.Count().Should().Be(9);
        var company = _context.Companies.Single();
        company.IndustryId.Should().Be(Industry("tech-software").IndustryId);
        company.CompanySizeId.Should().Be(_context.CompanySizes.Single(s => s.Code == "51-200").CompanySizeId);
    }

    [Fact]
    public async Task Tree_ShouldShowThirdLevelAddedByAdmin_AndRejectFourthLevel()
    {
        await CompanyTaxonomySeeder.SeedAsync(_context);
        var l3 = await Handlers().Handle(new CreateIndustryCommand("tech-software-backend", "Backend", "Lập trình Backend",
            Industry("tech-software").IndustryId, 1, _adminId), default);

        var tree = await Handlers().Handle(new GetIndustriesQuery(null, null, null, Tree: true), default);

        l3.Level.Should().Be(3);
        tree.Should().HaveCount(15);
        tree.Single(i => i.Code == "technology").Children!.Single(i => i.Code == "tech-software").Children!
            .Should().ContainSingle(i => i.Code == "tech-software-backend");
        var act = () => Handlers().Handle(new CreateIndustryCommand("too-deep", "X", null, l3.IndustryId, 1, _adminId), default);
        (await act.Should().ThrowAsync<BadRequestException>()).Which.ErrorCode.Should().Be("INDUSTRY_TOO_DEEP");
    }

    [Fact]
    public async Task Search_ByLevelOneIndustry_ShouldIncludeSubIndustries_AndOnlyVerified()
    {
        await CompanyTaxonomySeeder.SeedAsync(_context);
        SeedServiceTypes();
        SeedCompany("A", industryCode: "tech-software");
        SeedCompany("B", industryCode: "tech-cloud");
        SeedCompany("C", status: "PENDING", industryCode: "tech-software");
        SeedCompany("D", industryCode: "finance");

        var page = await Handlers().Handle(new SearchCompaniesQuery(null, Industry("technology").IndustryId, null, null), default);

        page.Items.Select(c => c.CompanyName).Should().BeEquivalentTo(["A", "B"]);
        page.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task Detail_ShouldHideUnverifiedCompany_AndJobsCandidatesCannotView()
    {
        var (visible, hidden) = SeedServiceTypes();
        var company = SeedCompany("A");
        var unverified = SeedCompany("B", status: "PENDING");
        var shown = SeedJob(company, visible);
        SeedJob(company, hidden);

        var detail = await Handlers().Handle(new GetPublicCompanyQuery(company.CompanyId), default);

        detail.Jobs.Select(j => j.JobId).Should().Equal(shown.JobId);
        detail.Company.ActiveJobCount.Should().Be(1);
        var act = () => Handlers().Handle(new GetPublicCompanyQuery(unverified.CompanyId), default);
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Featured_ShouldFollowAdminOrder_AndRejectUnverified()
    {
        SeedServiceTypes();
        var a = SeedCompany("A");
        var b = SeedCompany("B");
        var c = SeedCompany("C");
        var pending = SeedCompany("P", status: "PENDING");
        await Handlers().Handle(new SetCompanyFeaturedCommand(c.CompanyId, true, 1, _adminId), default);
        await Handlers().Handle(new SetCompanyFeaturedCommand(a.CompanyId, true, 2, _adminId), default);
        await Handlers().Handle(new SetCompanyFeaturedCommand(b.CompanyId, true, 3, _adminId), default);

        var featured = await Handlers().Handle(new GetFeaturedCompaniesQuery(), default);

        featured.Select(x => x.CompanyName).Should().Equal("C", "A", "B");
        var act = () => Handlers().Handle(new SetCompanyFeaturedCommand(pending.CompanyId, true, 4, _adminId), default);
        (await act.Should().ThrowAsync<BadRequestException>()).Which.ErrorCode.Should().Be("COMPANY_NOT_VERIFIED");
    }

    [Fact]
    public async Task UpdateProfile_UnknownIndustry_ShouldBe400_KnownIndustryShouldSyncText()
    {
        await CompanyTaxonomySeeder.SeedAsync(_context);
        var company = SeedCompany("A");
        var userId = Guid.NewGuid();
        _context.Add(new CompanyUser
        {
            CompanyUserId = Guid.NewGuid(), CompanyId = company.CompanyId, UserId = userId, Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
        });
        _context.SaveChanges();
        var handler = new UpdateCompanyProfileCommandHandler(new CompanyUserRepository(_context), new CompanyRepository(_context),
            new UnitOfWork(_context), NullLogger<UpdateCompanyProfileCommandHandler>.Instance, new CompanyDirectoryRepository(_context));

        var act = () => handler.Handle(new UpdateCompanyProfileCommand { UserId = userId, CompanyName = "A", IndustryId = Guid.NewGuid() }, default);
        (await act.Should().ThrowAsync<BadRequestException>()).Which.ErrorCode.Should().Be("INDUSTRY_NOT_FOUND");

        var result = await handler.Handle(new UpdateCompanyProfileCommand
        {
            UserId = userId, CompanyName = "A", IndustryId = Industry("tech-cloud").IndustryId, CompanySize = "11-50",
        }, default);
        result.Data!.Industry.Should().Be("Cloud Computing");
        result.Data.CompanySizeId.Should().Be(_context.CompanySizes.Single(s => s.Code == "11-50").CompanySizeId);
    }

    [Theory]
    [InlineData(3, 3)]
    [InlineData(6, 2)]
    public async Task ExperienceFilter_ShouldKeepJobsWhoseRangeContainsYears(int years, int expected)
    {
        var (visible, _) = SeedServiceTypes();
        var company = SeedCompany("A");
        SeedJob(company, visible, 2, 5);
        SeedJob(company, visible);
        SeedJob(company, visible, 1, null);

        var (items, total) = await new JobRepository(_context).GetVisibleJobsWithExperienceAsync(
            ["CANDIDATE"], false, null, null, null, null, null, null, years, 1, 20);

        total.Should().Be(expected);
        items.Should().HaveCount(expected);
    }
}
