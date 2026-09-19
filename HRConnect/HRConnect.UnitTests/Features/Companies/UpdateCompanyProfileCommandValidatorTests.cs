using FluentAssertions;
using HRConnect.Application.Features.Companies.Commands.UpdateCompanyProfile;
using Xunit;

namespace HRConnect.UnitTests.Features.Companies;

public class UpdateCompanyProfileCommandValidatorTests
{
    private readonly UpdateCompanyProfileCommandValidator _validator = new();

    [Fact]
    public void Validate_WhenAllFieldsValid_ShouldNotHaveValidationErrors()
    {
        var command = new UpdateCompanyProfileCommand
        {
            CompanyName = "Công Ty TNHH Giải Pháp Công Nghệ",
            TaxCode = "0101234567",
            Industry = "Công nghệ thông tin",
            CompanySize = "50-100 nhân viên",
            Website = "https://techsolutions.vn",
            Address = "123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM",
            Description = "Công ty phát triển phần mềm và giải pháp chuyển đổi số doanh nghiệp."
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Validate_WhenCompanyNameIsEmpty_ShouldHaveValidationError(string? companyName)
    {
        var command = new UpdateCompanyProfileCommand
        {
            CompanyName = companyName!
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateCompanyProfileCommand.CompanyName));
    }

    [Fact]
    public void Validate_WhenCompanyNameTooShort_ShouldHaveValidationError()
    {
        var command = new UpdateCompanyProfileCommand
        {
            CompanyName = "A"
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateCompanyProfileCommand.CompanyName)
            && e.ErrorMessage.Contains("tối thiểu 2 ký tự"));
    }

    [Fact]
    public void Validate_WhenCompanyNameExceeds255Chars_ShouldHaveValidationError()
    {
        var command = new UpdateCompanyProfileCommand
        {
            CompanyName = new string('A', 256)
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateCompanyProfileCommand.CompanyName)
            && e.ErrorMessage.Contains("vượt quá 255 ký tự"));
    }

    [Fact]
    public void Validate_WhenTaxCodeExceeds80Chars_ShouldHaveValidationError()
    {
        var command = new UpdateCompanyProfileCommand
        {
            CompanyName = "Valid Company",
            TaxCode = new string('1', 81)
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateCompanyProfileCommand.TaxCode));
    }

    [Fact]
    public void Validate_WhenIndustryExceeds120Chars_ShouldHaveValidationError()
    {
        var command = new UpdateCompanyProfileCommand
        {
            CompanyName = "Valid Company",
            Industry = new string('X', 121)
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateCompanyProfileCommand.Industry));
    }

    [Fact]
    public void Validate_WhenCompanySizeExceeds50Chars_ShouldHaveValidationError()
    {
        var command = new UpdateCompanyProfileCommand
        {
            CompanyName = "Valid Company",
            CompanySize = new string('S', 51)
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateCompanyProfileCommand.CompanySize));
    }

    [Theory]
    [InlineData("not-a-valid-url")]
    [InlineData("ftp://invalid-scheme.com")]
    [InlineData("just text")]
    public void Validate_WhenWebsiteInvalidFormat_ShouldHaveValidationError(string website)
    {
        var command = new UpdateCompanyProfileCommand
        {
            CompanyName = "Valid Company",
            Website = website
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateCompanyProfileCommand.Website));
    }

    [Theory]
    [InlineData("https://example.com")]
    [InlineData("http://my-company.com.vn/about")]
    public void Validate_WhenWebsiteValidFormat_ShouldPass(string website)
    {
        var command = new UpdateCompanyProfileCommand
        {
            CompanyName = "Valid Company",
            Website = website
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WhenWebsiteExceeds255Chars_ShouldHaveValidationError()
    {
        var command = new UpdateCompanyProfileCommand
        {
            CompanyName = "Valid Company",
            Website = "https://" + new string('a', 250) + ".com"
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateCompanyProfileCommand.Website));
    }

    [Fact]
    public void Validate_WhenAddressExceeds500Chars_ShouldHaveValidationError()
    {
        var command = new UpdateCompanyProfileCommand
        {
            CompanyName = "Valid Company",
            Address = new string('A', 501)
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateCompanyProfileCommand.Address));
    }

    [Fact]
    public void Validate_WhenDescriptionExceeds4000Chars_ShouldHaveValidationError()
    {
        var command = new UpdateCompanyProfileCommand
        {
            CompanyName = "Valid Company",
            Description = new string('D', 4001)
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateCompanyProfileCommand.Description));
    }
}
