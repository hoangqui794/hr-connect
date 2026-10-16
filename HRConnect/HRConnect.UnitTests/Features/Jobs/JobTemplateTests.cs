using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Commands.CreateJob;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Application.Features.Jobs.Templates;
using HRConnect.Application.Features.Settings;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Persistence.Seed;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Jobs;

/// <summary>MF-01 JD template library (HRConnect/docs/MF01/mf01-be-thu-vien-mau-jd.md, B1–B7).</summary>
public class JobTemplateTests
{
    private readonly ApplicationDbContext _context = new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Guid _hrUserId = Guid.NewGuid();

    private JobTemplateRepository Repository => new(_context);
    private UnitOfWork UnitOfWork => new(_context);
    private BusinessSettingsService Settings => new(new SystemSettingRepository(_context));

    private Task<JobTemplatePageDto> Search(string? keyword, string? industry = null, int? pageSize = null,
        bool includeInactive = false, bool? isActive = null) =>
        new SearchJobTemplatesQueryHandler(Repository, Settings)
            .Handle(new SearchJobTemplatesQuery(keyword, industry, 1, pageSize, includeInactive, isActive), CancellationToken.None);

    private Task<JobTemplateDto> Create(JobTemplateInput input) =>
        new CreateJobTemplateCommandHandler(Repository, UnitOfWork, _audit.Object)
            .Handle(new CreateJobTemplateCommand(input, _hrUserId), CancellationToken.None);

    private static JobTemplateInput Input(string code = "TEST_TEMPLATE", string name = "Kế toán tổng hợp",
        string industry = "ACCOUNTING", string keywords = "ke toan, thue", params JobTemplateRequirementInput[] requirements) =>
        new(code, name, industry, "MIDDLE", keywords, "Tóm tắt", name, "Mô tả công việc.", "Quyền lợi", "FULL_TIME", 2, 5,
            requirements.Length > 0
                ? requirements
                : [new("MUST_HAVE", "EXPERIENCE", "Ít nhất 2 năm kinh nghiệm"), new("SHOULD_HAVE", "SKILL", "Excel")]);

    // ---- search (B2) ---------------------------------------------------------------------

    [Theory]
    [InlineData("ke toan", "Kế toán tổng hợp")]
    [InlineData("KẾ TOÁN", "Kế toán tổng hợp")]
    [InlineData("ke toan tong hop", "Kế toán tổng hợp")]
    [InlineData("dotnet", "Lập trình viên Backend .NET")]
    [InlineData("tuyen dung", "Chuyên viên tuyển dụng")]
    public async Task Search_IgnoresAccentsAndCase(string keyword, string expectedName)
    {
        await JobTemplateSeeder.SeedAsync(_context);

        var page = await Search(keyword);

        page.Items.Select(i => i.Name).Should().Contain(expectedName);
    }

    [Fact]
    public async Task Search_RequiresEveryWord()
    {
        await JobTemplateSeeder.SeedAsync(_context);

        (await Search("ke toan react")).Items.Should().BeEmpty();
    }

    [Fact]
    public async Task Search_React_FindsFrontendAndFullstack_NameMatchFirst()
    {
        await JobTemplateSeeder.SeedAsync(_context);

        var page = await Search("react");

        page.Items.Select(i => i.Code).Should().Contain(["IT_FRONTEND_REACT", "IT_FULLSTACK"]);
        page.Items[0].Code.Should().Be("IT_FRONTEND_REACT"); // "ReactJS" is in its name
    }

    [Fact]
    public async Task Search_EmptyKeyword_ReturnsMostUsedFirst_AndUsesConfiguredPageSize()
    {
        await JobTemplateSeeder.SeedAsync(_context);
        var popular = await _context.JobTemplates.SingleAsync(t => t.Code == "SALES_B2B");
        popular.UsageCount = 99;
        await _context.SaveChangesAsync();

        var page = await Search(null);

        page.Items[0].Code.Should().Be("SALES_B2B");
        page.PageSize.Should().Be(8); // mf01.job_template.page_size_default
        page.TotalCount.Should().Be(JobTemplateSeeder.Templates.Length);
        page.Items.Should().HaveCount(8);
    }

    [Fact]
    public async Task Search_PageSizeIsCappedByConfiguredMaximum()
    {
        await JobTemplateSeeder.SeedAsync(_context);

        (await Search(null, pageSize: 500)).PageSize.Should().Be(20); // mf01.job_template.page_size_max
    }

    [Fact]
    public async Task Search_FiltersByIndustry()
    {
        await JobTemplateSeeder.SeedAsync(_context);

        var page = await Search(null, industry: "marketing", pageSize: 20);

        page.Items.Should().NotBeEmpty().And.OnlyContain(i => i.Industry == "MARKETING");
    }

    // ---- hidden templates (B2, B3, B5) ---------------------------------------------------

    [Fact]
    public async Task HiddenTemplate_IsNotFoundForClients_ButVisibleToManagers()
    {
        var created = await Create(Input());
        await new SetJobTemplateActiveCommandHandler(Repository, UnitOfWork, _audit.Object)
            .Handle(new SetJobTemplateActiveCommand(created.TemplateId, false, _hrUserId), CancellationToken.None);

        (await Search("ke toan")).Items.Should().BeEmpty();
        (await Search("ke toan", includeInactive: true)).Items.Should().ContainSingle();
        (await Search(null, includeInactive: true, isActive: false)).Items.Should().ContainSingle();

        var clientRead = () => new GetJobTemplateQueryHandler(Repository)
            .Handle(new GetJobTemplateQuery(created.TemplateId, CanSeeInactive: false), CancellationToken.None);
        await clientRead.Should().ThrowAsync<NotFoundException>();

        var managerRead = await new GetJobTemplateQueryHandler(Repository)
            .Handle(new GetJobTemplateQuery(created.TemplateId, CanSeeInactive: true, IncludeConcurrencyToken: true), CancellationToken.None);
        managerRead.IsActive.Should().BeFalse();
        managerRead.ConcurrencyToken.Should().NotBeNull();
    }

    [Fact]
    public async Task Detail_ForClients_HidesConcurrencyToken_AndKeepsRequirementOrder()
    {
        var created = await Create(Input(requirements:
        [
            new("MUST_HAVE", "experience", "Một"),
            new("should_have", "skill", "Hai"),
            new("MUST_HAVE", null, "Ba"),
        ]));

        var dto = await new GetJobTemplateQueryHandler(Repository)
            .Handle(new GetJobTemplateQuery(created.TemplateId, CanSeeInactive: false), CancellationToken.None);

        dto.ConcurrencyToken.Should().BeNull();
        dto.Requirements.Select(r => r.Content).Should().Equal("Một", "Hai", "Ba");
        dto.Requirements[1].Should().Be(new JobTemplateRequirementDto("SHOULD_HAVE", "SKILL", "Hai"));
    }

    // ---- manage (B5) ---------------------------------------------------------------------

    [Fact]
    public async Task Create_WithoutMustHave_IsRejected()
    {
        var act = () => Create(Input(requirements: [new("SHOULD_HAVE", "SKILL", "Excel")]));

        (await act.Should().ThrowAsync<BadRequestException>()).Which.ErrorCode
            .Should().Be(JobTemplateConstants.ErrorMustHaveRequired);
    }

    [Fact]
    public async Task Create_DuplicateCode_IsRejected_CaseInsensitive()
    {
        await Create(Input(code: "ACC_TEST"));

        var act = () => Create(Input(code: "acc_test"));

        (await act.Should().ThrowAsync<BadRequestException>()).Which.ErrorCode
            .Should().Be(JobTemplateConstants.ErrorCodeDuplicate);
    }

    [Theory]
    [InlineData("BAD CODE")]
    [InlineData("mã-có-dấu")]
    public async Task Create_InvalidCode_IsRejected(string code)
    {
        var act = () => Create(Input(code: code));

        await act.Should().ThrowAsync<BadRequestException>();
    }

    [Fact]
    public async Task Create_MinExperienceAboveMax_IsRejected()
    {
        var input = Input() with { MinExperienceYears = 6, MaxExperienceYears = 2 };

        var act = () => Create(input);

        await act.Should().ThrowAsync<BadRequestException>();
    }

    [Fact]
    public async Task Update_ReplacesRequirements_RebuildsSearch_AndRotatesToken()
    {
        var created = await Create(Input());

        var updated = await new UpdateJobTemplateCommandHandler(Repository, UnitOfWork, _audit.Object).Handle(
            new UpdateJobTemplateCommand(created.TemplateId, created.ConcurrencyToken!.Value,
                Input(name: "Kế toán thuế", keywords: "thue gtgt", requirements: [new("MUST_HAVE", "EXPERIENCE", "Lập tờ khai thuế")]),
                _hrUserId),
            CancellationToken.None);

        updated.Requirements.Should().ContainSingle().Which.Content.Should().Be("Lập tờ khai thuế");
        updated.ConcurrencyToken!.Value.Should().NotBe(created.ConcurrencyToken!.Value);
        (await _context.JobTemplateRequirements.CountAsync()).Should().Be(1);
        (await Search("thue gtgt")).Items.Should().ContainSingle();
        _audit.Verify(a => a.AddAsync(It.Is<Application.Common.Models.AuditEntry>(e => e.Action == JobTemplateAudit.Updated), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Update_WithStaleToken_Conflicts()
    {
        var created = await Create(Input());

        var act = () => new UpdateJobTemplateCommandHandler(Repository, UnitOfWork, _audit.Object).Handle(
            new UpdateJobTemplateCommand(created.TemplateId, Guid.NewGuid(), Input(), _hrUserId), CancellationToken.None);

        await act.Should().ThrowAsync<ConflictException>();
    }

    // ---- seed (B6) -----------------------------------------------------------------------

    [Fact]
    public async Task Seed_IsIdempotent_AndNeverOverwritesHrEdits()
    {
        await JobTemplateSeeder.SeedAsync(_context);
        var edited = await _context.JobTemplates.SingleAsync(t => t.Code == "IT_BACKEND_DOTNET");
        edited.Name = "Tên do HR sửa";
        await _context.SaveChangesAsync();

        await JobTemplateSeeder.SeedAsync(_context);

        (await _context.JobTemplates.CountAsync()).Should().Be(JobTemplateSeeder.Templates.Length);
        (await _context.JobTemplates.SingleAsync(t => t.Code == "IT_BACKEND_DOTNET")).Name.Should().Be("Tên do HR sửa");
    }

    [Fact]
    public void SeedTemplates_FollowTheWritingRules()
    {
        JobTemplateSeeder.Templates.Should().HaveCount(13);
        JobTemplateSeeder.Templates.Select(t => t.Code).Should().OnlyHaveUniqueItems();
        foreach (var t in JobTemplateSeeder.Templates)
        {
            var must = t.Requirements.Count(r => r.Type == "MUST_HAVE");
            var should = t.Requirements.Count(r => r.Type == "SHOULD_HAVE");
            must.Should().BeInRange(3, 5, t.Code);
            should.Should().BeInRange(2, 5, t.Code);
            t.Requirements.Should().OnlyContain(r => JobTemplateConstants.RequirementCategories.Contains(r.Category), t.Code);
            new JobTemplateInputValidator().Validate(new JobTemplateInput(
                t.Code, t.Name, t.Industry, t.Level, t.Keywords, t.Summary, t.Title, t.Description, t.Benefits,
                "FULL_TIME", t.MinYears, t.MaxYears,
                t.Requirements.Select(r => new JobTemplateRequirementInput(r.Type, r.Category, r.Content)).ToList()))
                .IsValid.Should().BeTrue(t.Code);
        }
    }

    // ---- create a job from a template (B4) -------------------------------------------------

    [Fact]
    public async Task TryUseTemplate_CountsUsage_OnlyForExistingTemplates()
    {
        var created = await Create(Input());
        var jobs = new JobRepository(_context);

        (await jobs.TryUseTemplateAsync(created.TemplateId)).Should().BeTrue();
        (await jobs.TryUseTemplateAsync(Guid.NewGuid())).Should().BeFalse();
        await _context.SaveChangesAsync();

        (await _context.JobTemplates.SingleAsync()).UsageCount.Should().Be(1);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task CreateJob_StoresTemplateIdOnlyWhenTheTemplateExists(bool templateExists)
    {
        var userId = Guid.NewGuid();
        var serviceTypeId = Guid.NewGuid();
        var templateId = Guid.NewGuid();
        var companyUsers = new Mock<ICompanyUserRepository>();
        companyUsers.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser
            {
                CompanyUserId = Guid.NewGuid(), CompanyId = Guid.NewGuid(), UserId = userId, Status = "ACTIVE",
                Company = new Company { CompanyName = "Verified Company", VerificationStatus = "VERIFIED" },
            });
        var jobRepository = new Mock<IJobRepository>();
        jobRepository.Setup(r => r.GetActiveServiceTypeCodeAsync(serviceTypeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ServiceTypeCodes.HeadhuntCod);
        jobRepository.Setup(r => r.TryUseTemplateAsync(templateId, It.IsAny<CancellationToken>())).ReturnsAsync(templateExists);
        Job? saved = null;
        jobRepository.Setup(r => r.AddAsync(It.IsAny<Job>(), It.IsAny<CancellationToken>()))
            .Callback<Job, CancellationToken>((job, _) => saved = job)
            .Returns(Task.CompletedTask);
        var handler = new CreateJobCommandHandler(companyUsers.Object, jobRepository.Object, Mock.Of<IUnitOfWork>(),
            Mock.Of<ILogger<CreateJobCommandHandler>>());

        await handler.Handle(new CreateJobCommand
        {
            UserId = userId, ServiceTypeId = serviceTypeId, Title = "Kế toán", CurrencyCode = "VND", Quantity = 1, TemplateId = templateId,
            Requirements = [new CreateJobRequirementRequest { RequirementType = "MUST_HAVE", Content = "2 năm kế toán" }],
        }, CancellationToken.None);

        saved.Should().NotBeNull();
        saved!.TemplateId.Should().Be(templateExists ? templateId : null);
        JobDto.From(saved).TemplateId.Should().Be(templateExists ? templateId : null);
    }
}
