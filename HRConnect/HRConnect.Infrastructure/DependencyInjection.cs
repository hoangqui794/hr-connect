using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using HRConnect.Infrastructure.Services.Email;
using HRConnect.Infrastructure.Services.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace HRConnect.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");

        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseNpgsql(connectionString, o => 
                o.MigrationsHistoryTable("__EFMigrationsHistory", "public")));

        // 1. Dịch vụ Email (Resend)
        services.Configure<ResendSettings>(configuration.GetSection(ResendSettings.SectionName));

        services.AddHttpClient<IEmailService, ResendEmailService>(client =>
        {
            client.BaseAddress = new Uri("https://api.resend.com/");
        });

        // 2. Cấu hình Authentication, OTP & JWT
        services.Configure<AuthenticationSettings>(
            configuration.GetSection(AuthenticationSettings.SectionName));
        services.Configure<JwtSettings>(
            configuration.GetSection(JwtSettings.SectionName));

        // 3. Dịch vụ Identity & Bảo mật
        services.AddSingleton<IPasswordHasher, PasswordHasher>();
        services.AddSingleton<IOtpService, OtpService>();
        services.AddSingleton<IPhoneNormalizer, PhoneNormalizer>();
        services.AddSingleton<IEmailNormalizer, EmailNormalizer>();
        services.AddSingleton<IJwtTokenGenerator, JwtTokenGenerator>();

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();

        // 4. Repositories & UnitOfWork
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<ICandidateRepository, CandidateRepository>();
        services.AddScoped<IAffiliateApplicationRepository, AffiliateApplicationRepository>();
        services.AddScoped<IAffiliateProfileRepository, AffiliateProfileRepository>();
        services.AddScoped<ICompanyRepository, CompanyRepository>();
        services.AddScoped<ICompanyUserRepository, CompanyUserRepository>();
        services.AddScoped<ICompanyVerificationRequestRepository, CompanyVerificationRequestRepository>();
        services.AddScoped<IApprovalRepository, ApprovalRepository>();
        services.AddScoped<IRoleRepository, RoleRepository>();
        services.AddScoped<IUserRoleRepository, UserRoleRepository>();
        services.AddScoped<IUserTokenRepository, UserTokenRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddScoped<IEmailOutboxRepository, EmailOutboxRepository>();
        services.AddScoped<IServiceTypeRepository, ServiceTypeRepository>();
        services.AddScoped<IJobRepository, JobRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IAdminApprovalService, HRConnect.Infrastructure.Services.Admin.AdminApprovalService>();

        return services;
    }
}
