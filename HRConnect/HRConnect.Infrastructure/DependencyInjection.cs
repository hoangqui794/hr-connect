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
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.AspNetCore.Authentication;
using HRConnect.Infrastructure.Authentication;
using HRConnect.Infrastructure.Services.Audit;
using HRConnect.Application.Features.Admin.Authorization;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Application.Features.Reports.Common;
using HRConnect.Infrastructure.Services.Admin;

namespace HRConnect.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = DatabaseConnectionString.Resolve(configuration);

        // BE-04 D: notifications are pushed in real time after they are saved. The API replaces the
        // no-op publisher with the SignalR one.
        services.TryAddScoped<HRConnect.Application.Common.Interfaces.INotificationPublisher, NoOpNotificationPublisher>();
        services.AddScoped<NotificationPushInterceptor>();
        services.AddDbContext<ApplicationDbContext>((provider, options) =>
            options.UseNpgsql(connectionString, o =>
                    o.MigrationsHistoryTable("__EFMigrationsHistory", "public"))
                .AddInterceptors(provider.GetRequiredService<NotificationPushInterceptor>()));

        // 1. Dịch vụ Email (Resend)
        services.Configure<ResendSettings>(configuration.GetSection(ResendSettings.SectionName));
        services.Configure<SubmissionConsentSettings>(configuration.GetSection(SubmissionConsentSettings.SectionName));
        services.Configure<HRConnect.Application.Features.Contact.ContactSettings>(settings =>
            settings.NotifyEmail = configuration["CONTACT_NOTIFY_EMAIL"]);
        services.PostConfigure<SubmissionConsentSettings>(settings =>
        {
            settings.ConfirmationUrlBase = configuration["SUBMISSION_CONSENT_URL_BASE"] ?? settings.ConfirmationUrlBase;
            if (int.TryParse(configuration["SUBMISSION_CONSENT_EXPIRATION_HOURS"], out var hours) && hours > 0)
                settings.ExpirationHours = hours;
        });

        services.AddHttpClient<IEmailService, ResendEmailService>(client =>
        {
            client.BaseAddress = new Uri("https://api.resend.com/");
        });
        // Registration OTP is sent once by the registration request. Further delivery
        // happens only through the explicit resend endpoint; never replay stale outbox rows.

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
        services.AddScoped<IRequestContext, HttpRequestContext>();
        services.AddScoped<IAuditLogService, AuditLogService>();
        services.AddScoped<IAuthorizationAdminService, AuthorizationAdminService>();
        services.AddScoped<IClaimsTransformation, ActiveAuthorizationClaimsTransformation>();

        // 4. Repositories & UnitOfWork
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IDisputeRepository, DisputeRepository>();
        services.AddScoped<HRConnect.Application.Features.Contact.IContactRequestRepository, ContactRequestRepository>();
        services.AddScoped<IUserEmailIdentityRepository, UserEmailIdentityRepository>();
        services.AddScoped<ICandidateIdentityClaimRepository, CandidateIdentityClaimRepository>();
        services.AddScoped<IAdminUserRepository, AdminUserRepository>();
        services.AddScoped<ICandidateRepository, CandidateRepository>();
        services.AddScoped<ISkillRepository, SkillRepository>();
        services.AddScoped<ICandidateCvRepository, CandidateCvRepository>();
        services.AddScoped<ICandidateSavedJobRepository, CandidateSavedJobRepository>();
        services.AddScoped<IAffiliateApplicationRepository, AffiliateApplicationRepository>();
        services.AddScoped<IAffiliateProfileRepository, AffiliateProfileRepository>();
        services.AddScoped<ICompanyRepository, CompanyRepository>();
        services.AddScoped<ICompanyUserRepository, CompanyUserRepository>();
        services.AddScoped<HRConnect.Application.Features.Companies.Directory.ICompanyDirectoryRepository, CompanyDirectoryRepository>();
        services.AddScoped<ICompanyVerificationRequestRepository, CompanyVerificationRequestRepository>();
        services.AddScoped<IInternalHrProfileRepository, InternalHrProfileRepository>();
        services.AddScoped<IAdminProfileRepository, AdminProfileRepository>();
        services.AddScoped<IApprovalRepository, ApprovalRepository>();
        services.AddScoped<IAuditLogRepository, AuditLogRepository>();
        services.AddScoped<IRoleRepository, RoleRepository>();
        services.AddScoped<IUserRoleRepository, UserRoleRepository>();
        services.AddScoped<IUserTokenRepository, UserTokenRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddScoped<IEmailOutboxRepository, EmailOutboxRepository>();
        services.AddScoped<IStorageCleanupJobRepository, StorageCleanupJobRepository>();
        services.AddScoped<IServiceTypeRepository, ServiceTypeRepository>();
        services.AddScoped<ICommissionMilestoneRepository, CommissionMilestoneRepository>();
        services.AddScoped<ICommissionRuleRepository, CommissionRuleRepository>();
        services.AddScoped<IJobRepository, JobRepository>();
        services.AddScoped<ISubmissionRepository, SubmissionRepository>();
        services.AddScoped<ISubmissionConsentRepository, SubmissionConsentRepository>();
        services.AddScoped<INotificationRepository, NotificationRepository>();
        services.AddScoped<IApplicationRepository, ApplicationRepository>();
        services.Configure<CandidateRecruitmentDeliverySettings>(configuration.GetSection(CandidateRecruitmentDeliverySettings.SectionName));
        services.PostConfigure<CandidateRecruitmentDeliverySettings>(settings =>
            settings.PortalBaseUrl = configuration["CANDIDATE_PORTAL_BASE_URL"] ?? settings.PortalBaseUrl);
        services.AddScoped<ICandidateRecruitmentDeliveryService, CandidateRecruitmentDeliveryService>();
        services.AddScoped<IInterviewRepository, InterviewRepository>();
        services.AddScoped<IOfferRepository, OfferRepository>();
        services.AddScoped<IPlacementRepository, PlacementRepository>();
        services.AddScoped<IFinanceRepository, FinanceRepository>();
        services.AddScoped<ISourcingDeliveryRepository, SourcingDeliveryRepository>();
        services.AddScoped<IJobTemplateRepository, JobTemplateRepository>();
        services.AddScoped<ISystemSettingRepository, SystemSettingRepository>();
        services.AddScoped<IReportRepository, ReportRepository>();
        services.AddScoped<IAffiliatePerformanceRepository, AffiliatePerformanceRepository>();
        services.AddScoped<IAffiliatePerformanceCalculationService, HRConnect.Application.Features.Reports.Common.AffiliatePerformanceCalculationService>();
        services.AddScoped<IAttributionRepository, AttributionRepository>();
        services.AddScoped<ICandidateCompanyTransactionLock, CandidateCompanyTransactionLock>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IAdminApprovalService, HRConnect.Infrastructure.Services.Admin.AdminApprovalService>();
        services.AddScoped<IMf03ScoringTrigger, HRConnect.Infrastructure.Services.Integration.Mf03ScoringTrigger>();

        services.Configure<Mf05Settings>(configuration.GetSection(Mf05Settings.SectionName));
        services.Configure<Mf03IntegrationSettings>(configuration.GetSection(Mf03IntegrationSettings.SectionName));
        services.PostConfigure<Mf03IntegrationSettings>(settings =>
        {
            settings.BaseUrl = configuration["MF03_BASE_URL"] ?? settings.BaseUrl;
            settings.ServiceToken = configuration["HRCONNECT_SERVICE_TOKEN"] ?? settings.ServiceToken;
        });
        services.AddHttpClient("Mf03AiService", (provider, client) =>
        {
            var settings = provider.GetRequiredService<Microsoft.Extensions.Options.IOptions<Mf03IntegrationSettings>>().Value;
            client.BaseAddress = new Uri(settings.BaseUrl);
            client.Timeout = TimeSpan.FromSeconds(15);
            if (!string.IsNullOrWhiteSpace(settings.ServiceToken))
                client.DefaultRequestHeaders.Add("X-Service-Token", settings.ServiceToken);
        });
        services.AddHostedService<HRConnect.Infrastructure.Services.Integration.Mf03ScoringDispatcher>();
        // BE-04 C: job suggestions use the same AI service; semantic scoring of a batch needs a longer timeout.
        services.AddHttpClient(HRConnect.Infrastructure.Services.JobMatching.JobMatchAiClient.HttpClientName, (provider, client) =>
        {
            var settings = provider.GetRequiredService<Microsoft.Extensions.Options.IOptions<Mf03IntegrationSettings>>().Value;
            client.BaseAddress = new Uri(settings.BaseUrl);
            client.Timeout = TimeSpan.FromMinutes(3);
            if (!string.IsNullOrWhiteSpace(settings.ServiceToken))
                client.DefaultRequestHeaders.Add("X-Service-Token", settings.ServiceToken);
        });
        services.AddScoped<HRConnect.Application.Features.Candidates.JobMatches.IJobMatchAiClient, HRConnect.Infrastructure.Services.JobMatching.JobMatchAiClient>();
        services.AddScoped<HRConnect.Application.Features.Candidates.JobMatches.IJobMatchReader, HRConnect.Infrastructure.Services.JobMatching.JobMatchReader>();
        services.AddScoped<HRConnect.Infrastructure.Services.JobMatching.JobMatchRunner>();
        services.AddHostedService<HRConnect.Infrastructure.Services.JobMatching.JobMatchWorker>();
        services.AddHostedService<HRConnect.Infrastructure.Services.SubmissionConsents.SubmissionConsentExpiryWorker>();
        services.AddHostedService<AccountLifecycleEmailOutboxWorker>();
        services.AddHostedService<HRConnect.Infrastructure.Services.Storage.AvatarStorageCleanupWorker>();
        services.AddHostedService<HRConnect.Infrastructure.Services.Offers.OfferExpiryWorker>();
        services.AddHostedService<HRConnect.Infrastructure.Services.Finance.WarrantyProgressWorker>();
        services.AddHostedService<HRConnect.Infrastructure.Services.Finance.SourcingFinanceWorker>();
        services.AddHostedService<HRConnect.Infrastructure.Services.Finance.AffiliateCommissionHoldWorker>();
        services.AddHostedService<HRConnect.Infrastructure.Services.Recruitment.SourcingAutoAcceptWorker>();
        services.AddHostedService<HRConnect.Infrastructure.Services.Affiliates.AffiliatePerformanceWorker>();

        // 5. Cloudflare R2 Object Storage & CV Storage
        var r2Settings = new R2Settings();
        configuration.GetSection(R2Settings.SectionName).Bind(r2Settings);

        r2Settings.AccountId = configuration["R2_ACCOUNT_ID"] ?? r2Settings.AccountId;
        r2Settings.AccessKeyId = configuration["R2_ACCESS_KEY_ID"] ?? r2Settings.AccessKeyId;
        r2Settings.SecretAccessKey = configuration["R2_SECRET_ACCESS_KEY"] ?? r2Settings.SecretAccessKey;
        r2Settings.BucketName = configuration["R2_BUCKET_NAME"] ?? r2Settings.BucketName;
        r2Settings.Endpoint = configuration["R2_ENDPOINT"] ?? r2Settings.Endpoint;
        r2Settings.PublicBaseUrl = configuration["R2_PUBLIC_BASE_URL"] ?? r2Settings.PublicBaseUrl;
        r2Settings.PublicApiBaseUrl = configuration["PUBLIC_API_BASE_URL"] ?? r2Settings.PublicApiBaseUrl;

        if (int.TryParse(configuration["MAX_CV_FILE_SIZE_MB"], out var maxMb) && maxMb > 0)
            r2Settings.MaxCvFileSizeMb = maxMb;

        if (int.TryParse(configuration["MAX_CV_PDF_PAGES"], out var maxPdfPages) && maxPdfPages > 0)
            r2Settings.MaxCvPdfPages = maxPdfPages;

        if (int.TryParse(configuration["MAX_PRESIGNED_URL_EXPIRY_MINUTES"], out var maxExpiryMinutes) && maxExpiryMinutes > 0)
            r2Settings.MaxPresignedUrlExpiryMinutes = maxExpiryMinutes;

        if (int.TryParse(configuration["MAX_AVATAR_FILE_SIZE_MB"], out var maxAvatarMb) && maxAvatarMb > 0)
            r2Settings.MaxAvatarFileSizeMb = maxAvatarMb;
        if (int.TryParse(configuration["MAX_AVATAR_WIDTH"], out var maxAvatarWidth) && maxAvatarWidth > 0)
            r2Settings.MaxAvatarWidth = maxAvatarWidth;
        if (int.TryParse(configuration["MAX_AVATAR_HEIGHT"], out var maxAvatarHeight) && maxAvatarHeight > 0)
            r2Settings.MaxAvatarHeight = maxAvatarHeight;
        if (long.TryParse(configuration["MAX_AVATAR_PIXELS"], out var maxAvatarPixels) && maxAvatarPixels > 0)
            r2Settings.MaxAvatarPixels = maxAvatarPixels;
        if (int.TryParse(configuration["AVATAR_OUTPUT_SIZE"], out var avatarOutputSize) && avatarOutputSize > 0)
            r2Settings.AvatarOutputSize = avatarOutputSize;
        if (int.TryParse(configuration["AVATAR_WEBP_QUALITY"], out var avatarQuality) && avatarQuality is >= 1 and <= 100)
            r2Settings.AvatarWebpQuality = avatarQuality;
        if (int.TryParse(configuration["AVATAR_PRESIGNED_URL_EXPIRY_MINUTES"], out var avatarExpiry) && avatarExpiry is >= 1 and <= 60)
            r2Settings.AvatarPresignedUrlExpiryMinutes = avatarExpiry;

        ValidateProductionR2Settings(r2Settings, configuration);

        services.AddSingleton(Microsoft.Extensions.Options.Options.Create(r2Settings));

        services.AddSingleton<Amazon.S3.IAmazonS3>(sp =>
        {
            var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<R2Settings>>().Value;
            var s3Config = new Amazon.S3.AmazonS3Config
            {
                ServiceURL = string.IsNullOrWhiteSpace(options.Endpoint)
                    ? "http://localhost:9000"
                    : options.Endpoint,
                ForcePathStyle = true
            };
            var accessKey = !string.IsNullOrWhiteSpace(options.AccessKeyId) ? options.AccessKeyId : "dummy";
            var secretKey = !string.IsNullOrWhiteSpace(options.SecretAccessKey) ? options.SecretAccessKey : "dummy";
            var credentials = new Amazon.Runtime.BasicAWSCredentials(accessKey, secretKey);
            return new Amazon.S3.AmazonS3Client(credentials, s3Config);
        });

        services.AddScoped<IFileStorageService, HRConnect.Infrastructure.Services.Storage.CloudflareR2StorageService>();
        services.AddScoped<IAvatarImageProcessor, HRConnect.Infrastructure.Services.Storage.AvatarImageProcessor>();
        services.AddSingleton<IAvatarUrlResolver, HRConnect.Infrastructure.Services.Storage.AvatarUrlResolver>();
        services.AddSingleton<HRConnect.Infrastructure.Services.Storage.PdfCvValidator>();
        // BE-04 B: CV builder (render, store, templates).
        services.AddSingleton<HRConnect.Infrastructure.Services.CvBuilder.CvPdfRenderer>();
        // N16: masked CV preview for Client (Headhunt before start).
        services.AddHttpClient(HRConnect.Infrastructure.Services.CvBuilder.MaskedCvService.HttpClientName, client => client.Timeout = TimeSpan.FromSeconds(30));
        services.AddScoped<HRConnect.Application.Features.Recruitment.Queries.GetApplicationMaskedCv.IMaskedCvService, HRConnect.Infrastructure.Services.CvBuilder.MaskedCvService>();
        services.AddScoped<HRConnect.Application.Features.Candidates.CvBuilder.IStructuredCvService, HRConnect.Infrastructure.Services.CvBuilder.StructuredCvService>();
        services.AddScoped<HRConnect.Application.Features.Candidates.CvBuilder.ICvTemplateRepository, HRConnect.Infrastructure.Services.CvBuilder.CvTemplateRepository>();
        services.AddScoped<ICvStorageService, HRConnect.Infrastructure.Services.Storage.CvStorageService>();

        // 6. Dịch vụ AI & HRConnect Client (MF-03 Integration)
        var clientOptions = new HRConnectClientOptions();
        configuration.GetSection(HRConnectClientOptions.SectionName).Bind(clientOptions);

        if (!string.IsNullOrWhiteSpace(configuration["HRCONNECT_BASE_URL"]))
            clientOptions.BaseUrl = configuration["HRCONNECT_BASE_URL"]!;

        if (!string.IsNullOrWhiteSpace(configuration["HRCONNECT_SERVICE_TOKEN"]))
            clientOptions.ServiceToken = configuration["HRCONNECT_SERVICE_TOKEN"]!;

        services.AddSingleton(Microsoft.Extensions.Options.Options.Create(clientOptions));

        services.AddHttpClient<IHRConnectClient, HRConnect.Infrastructure.Services.Integration.HRConnectClient>((sp, client) =>
        {
            var opts = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<HRConnectClientOptions>>().Value;
            if (!string.IsNullOrWhiteSpace(opts.BaseUrl))
            {
                client.BaseAddress = new Uri(opts.BaseUrl.TrimEnd('/') + "/");
            }
        });

        // 8. Background Workers (MF-01 Expiration Worker)
        services.AddHostedService<HRConnect.Infrastructure.Services.Jobs.JobExpirationWorker>();

        return services;

    }

    internal static void ValidateProductionR2Settings(R2Settings settings, IConfiguration configuration)
    {
        var environment = configuration["ASPNETCORE_ENVIRONMENT"] ?? configuration["DOTNET_ENVIRONMENT"];
        if (!string.Equals(environment, "Production", StringComparison.OrdinalIgnoreCase)) return;

        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(settings.AccountId)) missing.Add("R2_ACCOUNT_ID");
        if (string.IsNullOrWhiteSpace(settings.AccessKeyId)) missing.Add("R2_ACCESS_KEY_ID");
        if (string.IsNullOrWhiteSpace(settings.SecretAccessKey)) missing.Add("R2_SECRET_ACCESS_KEY");
        if (string.IsNullOrWhiteSpace(settings.BucketName)) missing.Add("R2_BUCKET_NAME");
        if (!IsAbsoluteHttpsUrl(settings.Endpoint)) missing.Add("R2_ENDPOINT (HTTPS URL)");
        if (!IsAbsoluteHttpsUrl(settings.PublicApiBaseUrl)) missing.Add("PUBLIC_API_BASE_URL (HTTPS URL)");

        if (missing.Count > 0)
        {
            throw new InvalidOperationException(
                $"Production object storage configuration is incomplete: {string.Join(", ", missing)}.");
        }
    }

    private static bool IsAbsoluteHttpsUrl(string? value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps;
}
