using FluentValidation;
using HRConnect.Application.Features.Jobs.Commands.CreateJob;

namespace HRConnect.Application.Features.Jobs.Commands.UpdateJob;

public sealed class UpdateJobCommandValidator : AbstractValidator<UpdateJobCommand>
{
    public UpdateJobCommandValidator()
    {
        Include(new CreateJobCommandValidatorAdapter());
    }

    private sealed class CreateJobCommandValidatorAdapter : AbstractValidator<UpdateJobCommand>
    {
        public CreateJobCommandValidatorAdapter()
        {
            RuleFor(x => x).Custom((x, context) =>
            {
                var command = new CreateJobCommand
                {
                    ServiceTypeId = x.ServiceTypeId, Title = x.Title, Description = x.Description,
                    Location = x.Location, EmploymentType = x.EmploymentType, SalaryMin = x.SalaryMin,
                    SalaryMax = x.SalaryMax, CurrencyCode = x.CurrencyCode, Quantity = x.Quantity,
                    Visibility = x.Visibility, Requirements = x.Requirements
                };
                var result = new CreateJobCommandValidator().Validate(command);
                foreach (var error in result.Errors)
                    context.AddFailure(error.PropertyName, error.ErrorMessage);
            });
        }
    }
}
