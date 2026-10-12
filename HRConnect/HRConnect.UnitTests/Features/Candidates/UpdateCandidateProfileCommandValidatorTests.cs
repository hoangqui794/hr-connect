using FluentAssertions;
using HRConnect.Application.Features.Candidates.Commands.UpdateCandidateProfile;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public class UpdateCandidateProfileCommandValidatorTests
{
    private readonly UpdateCandidateProfileCommandValidator _validator;

    public UpdateCandidateProfileCommandValidatorTests()
    {
        _validator = new UpdateCandidateProfileCommandValidator();
    }

    [Fact]
    public void Validate_WhenAllFieldsValid_ShouldPass()
    {
        var command = new UpdateCandidateProfileCommand
        {
            FullName = "Nguyen Van A",
            Phone = "0987654321",
            DateOfBirth = new DateOnly(1998, 1, 1),
            Gender = "MALE",
            YearsOfExperience = 3,
            CurrentAddress = "Hanoi",
            HighestEducation = "BACHELOR",
            Summary = "Good engineer"
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Validate_WhenFullNameIsEmpty_ShouldFail(string? fullName)
    {
        var command = new UpdateCandidateProfileCommand
        {
            FullName = fullName!
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(command.FullName));
    }

    [Fact]
    public void Validate_WhenYearsOfExperienceNegative_ShouldFail()
    {
        var command = new UpdateCandidateProfileCommand
        {
            FullName = "Valid Name",
            YearsOfExperience = -1
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(command.YearsOfExperience));
    }

    [Fact]
    public void Validate_WhenDateOfBirthInFuture_ShouldFail()
    {
        var command = new UpdateCandidateProfileCommand
        {
            FullName = "Valid Name",
            DateOfBirth = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1))
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(command.DateOfBirth));
    }

    [Fact]
    public void Validate_WhenGenderInvalid_ShouldFail()
    {
        var command = new UpdateCandidateProfileCommand
        {
            FullName = "Valid Name",
            Gender = "INVALID_GENDER"
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(command.Gender));
    }

    [Fact]
    public void Validate_WhenSalaryMinNegative_ShouldFail()
    {
        var command = new UpdateCandidateProfileCommand
        {
            FullName = "Valid Name",
            ExpectedSalaryMin = -5000000
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(command.ExpectedSalaryMin));
    }

    [Fact]
    public void Validate_WhenSalaryMaxLessThanMin_ShouldFail()
    {
        var command = new UpdateCandidateProfileCommand
        {
            FullName = "Valid Name",
            ExpectedSalaryMin = 20000000,
            ExpectedSalaryMax = 15000000
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(command.ExpectedSalaryMax));
    }

    [Fact]
    public void Validate_WhenCareerFieldsValid_ShouldPass()
    {
        var command = new UpdateCandidateProfileCommand
        {
            FullName = "Nguyen Van A",
            CurrentJobTitle = "Senior Backend Engineer",
            CurrentLevel = "SENIOR",
            TargetRole = "Technical Lead",
            ExpectedSalaryMin = 30000000,
            ExpectedSalaryMax = 50000000,
            ExpectedSalaryCurrency = "VND",
            AvailableFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            PreferredLocations = "Hanoi, Remote",
            PreferredWorkModes = "HYBRID"
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeTrue();
    }
}
