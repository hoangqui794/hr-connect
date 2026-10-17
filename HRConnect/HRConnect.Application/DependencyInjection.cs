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
        services.AddScoped<HRConnect.Application.Common.Settings.IAdminBusinessSettings, HRConnect.Application.Features.Settings.BusinessSettingsService>();
        services.AddScoped<HRConnect.Application.Features.Finance.Common.IPlacementFinanceService, HRConnect.Application.Features.Finance.Common.PlacementFinanceService>();
        services.AddScoped<HRConnect.Application.Features.Finance.Common.IWarrantyProgressService, HRConnect.Application.Features.Finance.Common.WarrantyProgressService>();
        services.AddScoped<HRConnect.Application.Features.Finance.Common.ISourcingFinanceService, HRConnect.Application.Features.Finance.Common.SourcingFinanceService>();
        services.AddScoped<HRConnect.Application.Features.Finance.Common.IAffiliateCommissionHoldService, HRConnect.Application.Features.Finance.Common.AffiliateCommissionHoldService>();
        services.AddScoped<HRConnect.Application.Features.Recruitment.Sourcing.ISourcingAutoAcceptService, HRConnect.Application.Features.Recruitment.Sourcing.SourcingAutoAcceptService>();

        return services;
    }
}
