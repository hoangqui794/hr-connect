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
        services.AddScoped<ICandidateCvRepository, CandidateCvRepository>();
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
        services.AddScoped<ISubmissionRepository, SubmissionRepository>();
        services.AddScoped<IApplicationRepository, ApplicationRepository>();
        services.AddScoped<IAttributionRepository, AttributionRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IAdminApprovalService, HRConnect.Infrastructure.Services.Admin.AdminApprovalService>();
        services.AddScoped<IMf03ScoringTrigger, HRConnect.Infrastructure.Services.Integration.Mf03ScoringTrigger>();

        // 5. Cloudflare R2 Object Storage & CV Storage
        var r2Settings = new R2Settings();
        configuration.GetSection(R2Settings.SectionName).Bind(r2Settings);

        if (string.IsNullOrWhiteSpace(r2Settings.AccountId))
            r2Settings.AccountId = configuration["R2_ACCOUNT_ID"] ?? "ea997660e8c1f6c92b939eb22891843c";

        if (string.IsNullOrWhiteSpace(r2Settings.AccessKeyId))
            r2Settings.AccessKeyId = configuration["R2_ACCESS_KEY_ID"] ?? string.Empty;

        if (string.IsNullOrWhiteSpace(r2Settings.SecretAccessKey))
            r2Settings.SecretAccessKey = configuration["R2_SECRET_ACCESS_KEY"] ?? string.Empty;

        if (string.IsNullOrWhiteSpace(r2Settings.BucketName))
            r2Settings.BucketName = configuration["R2_BUCKET_NAME"] ?? "hrconnect-candidate-cvs";

        if (string.IsNullOrWhiteSpace(r2Settings.Endpoint))
            r2Settings.Endpoint = configuration["R2_ENDPOINT"] ?? "https://ea997660e8c1f6c92b939eb22891843c.r2.cloudflarestorage.com";

        if (int.TryParse(configuration["MAX_CV_FILE_SIZE_MB"], out var maxMb) && maxMb > 0)
            r2Settings.MaxCvFileSizeMb = maxMb;

        services.AddSingleton(Microsoft.Extensions.Options.Options.Create(r2Settings));

        services.AddSingleton<Amazon.S3.IAmazonS3>(sp =>
        {
            var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<R2Settings>>().Value;
            var s3Config = new Amazon.S3.AmazonS3Config
            {
                ServiceURL = string.IsNullOrWhiteSpace(options.Endpoint)
                    ? "https://ea997660e8c1f6c92b939eb22891843c.r2.cloudflarestorage.com"
                    : options.Endpoint,
                ForcePathStyle = true
            };
            var accessKey = !string.IsNullOrWhiteSpace(options.AccessKeyId) ? options.AccessKeyId : "dummy";
            var secretKey = !string.IsNullOrWhiteSpace(options.SecretAccessKey) ? options.SecretAccessKey : "dummy";
            var credentials = new Amazon.Runtime.BasicAWSCredentials(accessKey, secretKey);
            return new Amazon.S3.AmazonS3Client(credentials, s3Config);
        });

        services.AddScoped<IFileStorageService, HRConnect.Infrastructure.Services.Storage.CloudflareR2StorageService>();
        services.AddScoped<ICvStorageService, HRConnect.Infrastructure.Services.Storage.CvStorageService>();

        return services;

    }
}
