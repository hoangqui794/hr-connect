using FluentAssertions;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Companies.Commands.UploadCompanyLogo;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.Options;

namespace HRConnect.UnitTests.Features.Companies;

public sealed class CompanyLogoLimitsTests
{
    private static UploadCompanyLogoCommand Command(long size) => new()
    {
        UserId = Guid.NewGuid(),
        FileName = "logo.jpg",
        ContentType = "image/jpeg",
        FileSizeBytes = size,
        FileStream = new MemoryStream([1]),
    };

    private static UploadCompanyLogoCommandValidator Validator() => new(Options.Create(new R2Settings()));

    [Fact]
    public void Logo_up_to_10MB_is_accepted()
    {
        Validator().Validate(Command(10L * 1024 * 1024)).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Logo_over_10MB_is_rejected_with_the_limit_in_the_message()
    {
        var result = Validator().Validate(Command(10L * 1024 * 1024 + 1));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.ErrorMessage.Contains("10MB"));
    }

    [Fact]
    public void Avatar_limit_stays_at_5MB()
    {
        new R2Settings().MaxAvatarFileSizeMb.Should().Be(5);
    }

    // Replacing or deleting a logo queues a cleanup job for the old company-logos/ object.
    [Fact]
    public void Storage_cleanup_job_constraint_allows_company_logo_keys()
    {
        using var context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=localhost;Database=unused").Options);

        var model = context.GetService<IDesignTimeModel>().Model;
        var constraints = model.FindEntityType(typeof(StorageCleanupJob))!.GetCheckConstraints().ToList();

        constraints.Should().NotContain(c => c.Name == "ck_storage_cleanup_job_avatar_namespace");
        constraints.Should().ContainSingle(c => c.Name == "ck_storage_cleanup_job_object_namespace")
            .Which.Sql.Should().Contain("company-logos/%").And.Contain("avatars/%");
    }
}
