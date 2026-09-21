using FluentValidation;
using HRConnect.Application.Features.Jobs.Common;

namespace HRConnect.Application.Features.Jobs.Commands.CreateJob;

public class CreateJobCommandValidator : AbstractValidator<CreateJobCommand>
{
    public CreateJobCommandValidator()
    {
        RuleFor(x => x.ServiceTypeId)
            .NotEmpty().WithMessage("Loại dịch vụ không được để trống.");

        When(x => !string.IsNullOrWhiteSpace(x.Title), () =>
        {
            RuleFor(x => x.Title)
                .MaximumLength(255).WithMessage("Tiêu đề công việc không được vượt quá 255 ký tự.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.Location), () =>
        {
            RuleFor(x => x.Location)
                .MaximumLength(255).WithMessage("Địa điểm không được vượt quá 255 ký tự.");
        });

        When(x => !string.IsNullOrWhiteSpace(x.EmploymentType), () =>
        {
            RuleFor(x => x.EmploymentType)
                .MaximumLength(50).WithMessage("Loại hình làm việc không được vượt quá 50 ký tự.");
        });

        RuleFor(x => x.CurrencyCode)
            .NotEmpty().WithMessage("Mã tiền tệ không được để trống.")
            .Matches("^[A-Za-z]{3}$").WithMessage("Mã tiền tệ phải gồm đúng 3 chữ cái theo chuẩn ISO 4217.");

        RuleFor(x => x.Quantity)
            .InclusiveBetween(1, 1000).WithMessage("Số lượng tuyển dụng phải từ 1 đến 1000.");

        When(x => x.SalaryMin.HasValue, () =>
        {
            RuleFor(x => x.SalaryMin)
                .GreaterThanOrEqualTo(0).WithMessage("Mức lương tối thiểu không được âm.");
        });

        When(x => x.SalaryMax.HasValue, () =>
        {
            RuleFor(x => x.SalaryMax)
                .GreaterThanOrEqualTo(0).WithMessage("Mức lương tối đa không được âm.");
        });

        When(x => x.SalaryMin.HasValue && x.SalaryMax.HasValue, () =>
        {
            RuleFor(x => x.SalaryMax)
                .GreaterThanOrEqualTo(x => x.SalaryMin)
                .WithMessage("Mức lương tối đa phải lớn hơn hoặc bằng mức lương tối thiểu.");
        });

        RuleFor(x => x.Visibility)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Chế độ hiển thị không được để trống.")
            .Must(value => JobVisibilities.All.Contains(value.Trim().ToUpperInvariant()))
            .WithMessage("Chế độ hiển thị phải là PUBLIC hoặc PRIVATE.");

        RuleForEach(x => x.Requirements)
            .NotNull().WithMessage("Yêu cầu công việc không được là null.")
            .SetValidator(new CreateJobRequirementRequestValidator());

        RuleFor(x => x.Skills)
            .Must(skills => skills.Select(skill => skill.SkillId).Distinct().Count() == skills.Count)
            .WithMessage("Danh sách kỹ năng không được chứa SkillId trùng nhau.");

        RuleForEach(x => x.Skills)
            .NotNull().WithMessage("Kỹ năng công việc không được là null.")
            .SetValidator(new JobSkillRequestValidator());
    }
}

public class JobSkillRequestValidator : AbstractValidator<JobSkillRequest>
{
    public JobSkillRequestValidator()
    {
        RuleFor(x => x.SkillId).NotEmpty().WithMessage("Kỹ năng không được để trống.");
        When(x => x.Weight.HasValue, () =>
        {
            RuleFor(x => x.Weight)
                .InclusiveBetween(0, 1).WithMessage("Trọng số kỹ năng phải nằm trong khoảng từ 0 đến 1.");
        });
    }
}

public class CreateJobRequirementRequestValidator : AbstractValidator<CreateJobRequirementRequest>
{
    public CreateJobRequirementRequestValidator()
    {
        RuleFor(x => x.RequirementType)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Loại yêu cầu không được để trống.")
            .Must(value => JobRequirementTypes.All.Contains(value.Trim().ToUpperInvariant()))
            .WithMessage("Loại yêu cầu phải là MUST_HAVE hoặc SHOULD_HAVE.");

        RuleFor(x => x.Content)
            .NotEmpty().WithMessage("Nội dung yêu cầu không được để trống.")
            .MaximumLength(4000).WithMessage("Nội dung yêu cầu không được vượt quá 4000 ký tự.");

        When(x => !string.IsNullOrWhiteSpace(x.Category), () =>
        {
            RuleFor(x => x.Category)
                .MaximumLength(120).WithMessage("Danh mục yêu cầu không được vượt quá 120 ký tự.");
        });

        When(x => x.Weight.HasValue, () =>
        {
            RuleFor(x => x.Weight)
                .InclusiveBetween(0, 1).WithMessage("Trọng số yêu cầu phải nằm trong khoảng từ 0 đến 1.");
        });
    }
}
