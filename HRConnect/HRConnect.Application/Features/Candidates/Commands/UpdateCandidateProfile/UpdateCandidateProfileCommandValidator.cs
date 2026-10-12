using FluentValidation;

namespace HRConnect.Application.Features.Candidates.Commands.UpdateCandidateProfile;

public class UpdateCandidateProfileCommandValidator : AbstractValidator<UpdateCandidateProfileCommand>
{
    private static readonly string[] AllowedGenders = { "MALE", "FEMALE", "OTHER" };

    public UpdateCandidateProfileCommandValidator()
    {
        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Họ và tên không được để trống.")
            .MinimumLength(2).WithMessage("Họ và tên phải có tối thiểu 2 ký tự.")
            .MaximumLength(180).WithMessage("Họ và tên không được vượt quá 180 ký tự.");

        When(x => !string.IsNullOrWhiteSpace(x.Phone), () =>
        {
            RuleFor(x => x.Phone)
                .Matches(@"^[0-9+() \-\.]{8,20}$").WithMessage("Số điện thoại không đúng định dạng.");
        });

        When(x => x.DateOfBirth.HasValue, () =>
        {
            RuleFor(x => x.DateOfBirth)
                .LessThan(DateOnly.FromDateTime(DateTime.UtcNow))
                .WithMessage("Ngày sinh phải ở trong quá khứ.")
                .Must(dob =>
                {
                    var today = DateOnly.FromDateTime(DateTime.UtcNow);
                    var age = today.Year - dob!.Value.Year;
                    if (dob > today.AddYears(-age)) age--;
                    return age >= 15 && age <= 100;
                })
                .WithMessage("Độ tuổi của ứng viên phải từ 15 đến 100 tuổi.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.Gender), () =>
        {
            RuleFor(x => x.Gender)
                .Must(g => AllowedGenders.Contains(g!.ToUpperInvariant()))
                .WithMessage("Giới tính phải là MALE, FEMALE hoặc OTHER.");
        });

        When(x => x.YearsOfExperience.HasValue, () =>
        {
            RuleFor(x => x.YearsOfExperience)
                .InclusiveBetween(0, 50)
                .WithMessage("Số năm kinh nghiệm phải từ 0 đến 50 năm.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.HighestEducation), () =>
        {
            RuleFor(x => x.HighestEducation)
                .MaximumLength(120).WithMessage("Trình độ học vấn không được vượt quá 120 ký tự.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.CurrentAddress), () =>
        {
            RuleFor(x => x.CurrentAddress)
                .MaximumLength(500).WithMessage("Địa chỉ không được vượt quá 500 ký tự.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.Summary), () =>
        {
            RuleFor(x => x.Summary)
                .MaximumLength(2000).WithMessage("Tóm tắt bản thân không được vượt quá 2000 ký tự.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.CurrentJobTitle), () =>
        {
            RuleFor(x => x.CurrentJobTitle)
                .MaximumLength(150).WithMessage("Chức danh hiện tại không được vượt quá 150 ký tự.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.CurrentLevel), () =>
        {
            RuleFor(x => x.CurrentLevel)
                .MaximumLength(50).WithMessage("Cấp bậc hiện tại không được vượt quá 50 ký tự.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.TargetRole), () =>
        {
            RuleFor(x => x.TargetRole)
                .MaximumLength(150).WithMessage("Vị trí mong muốn không được vượt quá 150 ký tự.");
        });

        When(x => x.ExpectedSalaryMin.HasValue, () =>
        {
            RuleFor(x => x.ExpectedSalaryMin)
                .GreaterThanOrEqualTo(0).WithMessage("Mức lương tối thiểu mong muốn không được nhỏ hơn 0.");
        });

        When(x => x.ExpectedSalaryMax.HasValue, () =>
        {
            RuleFor(x => x.ExpectedSalaryMax)
                .GreaterThanOrEqualTo(0).WithMessage("Mức lương tối đa mong muốn không được nhỏ hơn 0.");
        });

        When(x => x.ExpectedSalaryMin.HasValue && x.ExpectedSalaryMax.HasValue, () =>
        {
            RuleFor(x => x.ExpectedSalaryMax)
                .GreaterThanOrEqualTo(x => x.ExpectedSalaryMin!.Value)
                .WithMessage("Mức lương tối đa mong muốn phải lớn hơn hoặc bằng mức lương tối thiểu.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.ExpectedSalaryCurrency), () =>
        {
            RuleFor(x => x.ExpectedSalaryCurrency)
                .MaximumLength(10).WithMessage("Đơn vị tiền tệ không được vượt quá 10 ký tự.");
        });

        When(x => x.AvailableFrom.HasValue, () =>
        {
            RuleFor(x => x.AvailableFrom)
                .GreaterThanOrEqualTo(DateOnly.FromDateTime(DateTime.UtcNow))
                .WithMessage("Ngày có thể bắt đầu làm việc phải từ ngày hôm nay trở đi.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.PreferredLocations), () =>
        {
            RuleFor(x => x.PreferredLocations)
                .MaximumLength(255).WithMessage("Địa điểm mong muốn không được vượt quá 255 ký tự.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.PreferredWorkModes), () =>
        {
            RuleFor(x => x.PreferredWorkModes)
                .MaximumLength(100).WithMessage("Hình thức làm việc mong muốn không được vượt quá 100 ký tự.");
        });
    }
}
