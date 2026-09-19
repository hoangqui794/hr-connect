using FluentAssertions;
using HRConnect.Application.Features.Affiliates.Commands.UpdateAffiliateBankAccount;
using Xunit;

namespace HRConnect.UnitTests.Features.Affiliates;

public class UpdateAffiliateBankAccountCommandValidatorTests
{
    private readonly UpdateAffiliateBankAccountCommandValidator _validator;

    public UpdateAffiliateBankAccountCommandValidatorTests()
    {
        _validator = new UpdateAffiliateBankAccountCommandValidator();
    }

    [Fact]
    public void Validate_WhenCommandIsValid_ShouldNotHaveErrors()
    {
        var command = new UpdateAffiliateBankAccountCommand
        {
            BankName = "Ngân hàng Thương mại Cổ phần Ngoại thương Việt Nam (Vietcombank)",
            BankAccountNumber = "01234567890123",
            BankAccountHolder = "NGUYEN VAN A",
            BankBranch = "Chi nhánh Hoàn Kiếm"
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeTrue();
        result.Errors.Should().BeEmpty();
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("A")] // Quá ngắn (< 2)
    public void Validate_WhenBankNameIsInvalid_ShouldHaveValidationError(string bankName)
    {
        var command = new UpdateAffiliateBankAccountCommand
        {
            BankName = bankName,
            BankAccountNumber = "0123456789",
            BankAccountHolder = "NGUYEN VAN A"
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(command.BankName));
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("123")] // Quá ngắn (< 5)
    [InlineData("0123 456 789")] // Chứa khoảng trắng
    [InlineData("0123-456-789")] // Chứa ký tự đặc biệt
    public void Validate_WhenBankAccountNumberIsInvalid_ShouldHaveValidationError(string accountNumber)
    {
        var command = new UpdateAffiliateBankAccountCommand
        {
            BankName = "Vietcombank",
            BankAccountNumber = accountNumber,
            BankAccountHolder = "NGUYEN VAN A"
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(command.BankAccountNumber));
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("A")] // Quá ngắn (< 2)
    public void Validate_WhenBankAccountHolderIsInvalid_ShouldHaveValidationError(string holder)
    {
        var command = new UpdateAffiliateBankAccountCommand
        {
            BankName = "Vietcombank",
            BankAccountNumber = "0123456789",
            BankAccountHolder = holder
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(command.BankAccountHolder));
    }

    [Fact]
    public void Validate_WhenBankBranchIsTooLong_ShouldHaveValidationError()
    {
        var command = new UpdateAffiliateBankAccountCommand
        {
            BankName = "Vietcombank",
            BankAccountNumber = "0123456789",
            BankAccountHolder = "NGUYEN VAN A",
            BankBranch = new string('A', 181)
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(command.BankBranch));
    }
}
