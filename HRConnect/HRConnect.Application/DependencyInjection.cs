using System.Reflection;
using FluentValidation;
using HRConnect.Application.Features.Offers.Common;
using HRConnect.Application.Features.SubmissionConsents.Common;
using Microsoft.Extensions.DependencyInjection;

namespace HRConnect.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly()));

        services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());
        services.AddScoped<ISubmissionConsentExpiryService, SubmissionConsentExpiryService>();
        services.AddScoped<IOfferExpiryService, OfferExpiryService>();
        services.AddScoped<HRConnect.Application.Features.Finance.Common.IPlacementFinanceService, HRConnect.Application.Features.Finance.Common.PlacementFinanceService>();
        services.AddScoped<HRConnect.Application.Features.Finance.Common.IWarrantyProgressService, HRConnect.Application.Features.Finance.Common.WarrantyProgressService>();

        return services;
    }
}
