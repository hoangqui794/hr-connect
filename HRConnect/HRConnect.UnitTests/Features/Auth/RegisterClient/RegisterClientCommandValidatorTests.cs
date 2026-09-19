using FluentAssertions;
using HRConnect.Application.Features.Auth.Commands.RegisterClient;

namespace HRConnect.UnitTests.Features.Auth.RegisterClient;

public class RegisterClientCommandValidatorTests
{
    private readonly RegisterClientCommandValidator _validator;

    public RegisterClientCommandValidatorTests()
    {
        _validator = new RegisterClientCommandValidator();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Validate_ShouldHaveError_WhenEmailIsEmpty(string? email)
    {
        var command = new RegisterClientCommand(
            Email: email!,
            Password: "Password@123",
            FullName: "Tran Thi B",
            Phone: "0912345678",
            CompanyName: "ABC Technology"
        );

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(RegisterClientCommand.Email));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Validate_ShouldHaveError_WhenCompanyNameIsEmpty(string? companyName)
    {
        var command = new RegisterClientCommand(
            Email: "client@example.com",
            Password: "Password@123",
            FullName: "Tran Thi B",
            Phone: "0912345678",
            CompanyName: companyName!
        );

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(RegisterClientCommand.CompanyName));
    }

    [Fact]
    public void Validate_ShouldBeValid_WhenValidDataProvided()
    {
        var command = new RegisterClientCommand(
            Email: "hr@abctech.vn",
            Password: "SecurePassword@2026",
            FullName: "Tran Thi B",
            Phone: "0912345678",
            CompanyName: "ABC Technology JSC",
            TaxCode: "0102030405"
        );

        var result = _validator.Validate(command);

        result.IsValid.Should().BeTrue();
        result.Errors.Should().BeEmpty();
    }
}
