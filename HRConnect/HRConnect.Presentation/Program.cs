using HRConnect.Presentation.Endpoints.V1.Finance;
using HRConnect.Presentation.Endpoints.V1.Disputes;
using HRConnect.Presentation.Endpoints.V1.Contact;
using HRConnect.Presentation.Endpoints.V1.Reports;
using System.Text;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using HRConnect.Application;
using HRConnect.Infrastructure;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Presentation.Endpoints.V1.Admin;
using HRConnect.Presentation.Endpoints.V1.Auth;
using HRConnect.Presentation.Endpoints.V1.Candidates;
using HRConnect.Presentation.Endpoints.V1.Affiliates;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Presentation.Endpoints.V1.ServiceTypes;
using HRConnect.Presentation.Endpoints.V1.CommissionMilestones;
using HRConnect.Presentation.Endpoints.V1.CommissionRules;
using HRConnect.Presentation.Endpoints.V1.Jobs;
using HRConnect.Presentation.Endpoints.V1.Companies;
using HRConnect.Presentation.Endpoints.V1.InternalHr;
using HRConnect.Presentation.Endpoints.V1.Internal;
using HRConnect.Presentation.Endpoints.V1.SubmissionConsents;
using HRConnect.Presentation.Endpoints.V1.Notifications;
using HRConnect.Presentation.Swagger;
using HRConnect.Presentation.Endpoints.Internal;
using HRConnect.Presentation.Endpoints.V1.Recruitment;
using HRConnect.Presentation.Endpoints.V1.Users;
using Microsoft.EntityFrameworkCore;
using HRConnect.Presentation.Middleware;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using HRConnect.Presentation.RateLimiting;
using HRConnect.Presentation.HealthChecks;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;
using System.Net;
using HRConnect.Presentation.Configuration;
using HRConnect.Presentation.Database;

// ==============================================================================
// 1. Nạp biến môi trường từ file .env
// ==============================================================================
DotNetEnv.Env.TraversePath().Load();

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddEnvironmentVariables();
ProductionConfigurationValidator.Validate(builder.Configuration, builder.Environment);

// ==============================================================================
// 2. Đăng ký các dịch vụ (Dependency Injection)
// ==============================================================================

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddExceptionHandler<HRConnect.Presentation.ErrorHandling.BadHttpRequestExceptionHandler>();
builder.Services.AddExceptionHandler<HRConnect.Presentation.ErrorHandling.ConflictExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddHealthChecks()
    .AddCheck(
        "self",
        () => HealthCheckResult.Healthy("Ứng dụng đang hoạt động."),
        tags: ["live"])
    .AddCheck<DatabaseHealthCheck>("postgresql", tags: ["ready"]);
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = 2;
    foreach (var configuredProxy in builder.Configuration
                 .GetSection("ForwardedHeaders:KnownProxies")
                 .Get<string[]>() ?? [])
    {
        if (IPAddress.TryParse(configuredProxy, out var proxy))
        {
            options.KnownProxies.Add(proxy);
        }
    }
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        int? retryAfterSeconds = null;
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            retryAfterSeconds = Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds));
            context.HttpContext.Response.Headers.RetryAfter = retryAfterSeconds.Value.ToString();
        }

        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            success = false,
            code = "RATE_LIMIT_EXCEEDED",
            message = "Bạn thao tác quá nhanh. Vui lòng chờ rồi thử lại.",
            retryAfterSeconds
        }, cancellationToken);
    };

    static string ClientKey(HttpContext context) => RateLimitIdentity.Ip(context);

    options.AddPolicy("auth-login", context => RateLimitPartition.GetFixedWindowLimiter(
        ClientKey(context),
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            AutoReplenishment = true
        }));

    options.AddPolicy("public-read", context => RateLimitPartition.GetFixedWindowLimiter(
        ClientKey(context),
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 120,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            AutoReplenishment = true
        }));

    options.AddPolicy("auth-sensitive", context => RateLimitPartition.GetFixedWindowLimiter(
        ClientKey(context),
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 5,
            Window = TimeSpan.FromMinutes(10),
            QueueLimit = 0,
            AutoReplenishment = true
        }));

    options.AddPolicy("auth-registration", context => RateLimitPartition.GetFixedWindowLimiter(
        ClientKey(context),
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 5,
            Window = TimeSpan.FromHours(1),
            QueueLimit = 0,
            AutoReplenishment = true
        }));

    options.AddPolicy("submission-consent", context => RateLimitPartition.GetFixedWindowLimiter(
        $"{ClientKey(context)}:{context.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonymous"}",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10,
            Window = TimeSpan.FromHours(1),
            QueueLimit = 0,
            AutoReplenishment = true
        }));

    options.AddPolicy("submission-consent-public", context => RateLimitPartition.GetFixedWindowLimiter(
        ClientKey(context),
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 20,
            Window = TimeSpan.FromMinutes(15),
            QueueLimit = 0,
            AutoReplenishment = true
        }));

    options.AddPolicy("candidate-application", context => RateLimitPartition.GetFixedWindowLimiter(
        RateLimitIdentity.UserAndIp(context),
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10,
            Window = TimeSpan.FromHours(1),
            QueueLimit = 0,
            AutoReplenishment = true
        }));

    options.AddPolicy("candidate-identity", context => RateLimitPartition.GetFixedWindowLimiter(
        RateLimitIdentity.UserAndIp(context),
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 5,
            Window = TimeSpan.FromHours(1),
            QueueLimit = 0,
            AutoReplenishment = true
        }));
});

// Chỉ cho phép các frontend đã khai báo gọi API kèm cookie xác thực.
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
if (allowedOrigins.Length == 0 && !builder.Environment.IsProduction())
{
    allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins(allowedOrigins)
                   .AllowAnyMethod()
                   .AllowAnyHeader()
                   .AllowCredentials();
    });
});

// Cấu hình Swagger hỗ trợ xác thực JWT (Bearer Auth 🔒)
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "HRConnect API",
        Version = "v1",
        Description = """
            API HR Connect được sắp xếp theo hành trình nghiệp vụ và vai trò sử dụng.

            Cách test nhanh:
            1. Mở nhóm Auth, gọi POST /api/v1/auth/login và chọn tài khoản demo phù hợp.
            2. Sao chép accessToken, bấm Authorize và dán trực tiếp token; Swagger tự thêm tiền tố Bearer.
            3. Test API trong nhóm Candidate, Affiliate, Client Company, Internal HR hoặc Platform Admin tương ứng.
            4. Nhóm Internal dùng X-Service-Token riêng và chỉ dành cho giao tiếp giữa HR Connect với MF03.
            """
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "Dán JWT access token. Swagger sẽ tự thêm tiền tố Bearer vào Authorization header.",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });

    options.AddSecurityDefinition("InternalServiceToken", new OpenApiSecurityScheme
    {
        Description = "Internal service token for service-to-service APIs (e.g. MF-03 AI Service). Enter your service token directly.",
        Name = "X-Service-Token",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });

    options.OperationFilter<InternalServiceAuthOperationFilter>();
    options.OperationFilter<SwaggerEndpointTagFilter>();
    options.OperationFilter<AnonymousEndpointSecurityOperationFilter>();
    options.OperationFilter<LoginRequestExamplesOperationFilter>();
    options.DocumentFilter<SwaggerTagOrderDocumentFilter>();
});

// Cấu hình Xác thực JWT (Authentication)
var jwtSecret = builder.Configuration["JwtSettings:Secret"]
    ?? throw new InvalidOperationException("JwtSettings:Secret chưa được cấu hình.");
var jwtIssuer = builder.Configuration["JwtSettings:Issuer"]
    ?? throw new InvalidOperationException("JwtSettings:Issuer chưa được cấu hình.");
var jwtAudience = builder.Configuration["JwtSettings:Audience"]
    ?? throw new InvalidOperationException("JwtSettings:Audience chưa được cấu hình.");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ClockSkew = TimeSpan.Zero
    };
    options.Events = new JwtBearerEvents
    {
        // SignalR cannot send headers on WebSockets: the hub takes the JWT from ?access_token=.
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            if (!string.IsNullOrEmpty(accessToken) && context.HttpContext.Request.Path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }

            return Task.CompletedTask;
        },
        OnChallenge = async context =>
        {
            context.HandleResponse();
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new
            {
                success = false,
                message = "Bạn chưa đăng nhập hoặc token truy cập không hợp lệ."
            });
        },
        OnForbidden = async context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new
            {
                success = false,
                message = "Bạn không có quyền thực hiện chức năng này."
            });
        }
    };
});

builder.Services.AddAuthorization();
builder.Services.AddSignalR();
builder.Services.AddScoped<HRConnect.Application.Common.Interfaces.INotificationPublisher, HRConnect.Presentation.Hubs.SignalRNotificationPublisher>();

// Clean Architecture: Dang ky cac dich vu cua tung tang
builder.Services.AddApplicationServices();
builder.Services.AddInfrastructureServices(builder.Configuration);

var app = builder.Build();

var migrationOnly = args.Any(argument =>
    argument.Equals("--migrate", StringComparison.OrdinalIgnoreCase));
var migrateOnStartup = !app.Environment.IsProduction()
    && builder.Configuration.GetValue("Database:RunMigrationsOnStartup", true);

if (migrationOnly || migrateOnStartup)
{
    try
    {
        await DatabaseMigrationRunner.RunAsync(
            app.Services,
            app.Environment,
            builder.Configuration,
            app.Logger);
    }
    catch (Exception ex)
    {
        app.Logger.LogCritical(ex, "Database migration failed; process aborted.");
        throw new InvalidOperationException("Database migration failed.", ex);
    }
}

if (migrationOnly)
{
    return;
}

// Resolve the original client IP only through trusted proxies. Configure
// ForwardedHeaders__KnownProxies in production for the reverse proxy addresses.
app.UseForwardedHeaders();

// Correlation scope wraps the remaining pipeline, including exception handling,
// so framework and application logs from one request share the same identifier.
app.UseMiddleware<RequestLoggingMiddleware>();

// ==============================================================================
// 3. Cấu hình HTTP Request Pipeline (Middleware)
// ==============================================================================

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "HRConnect API V1");
        c.DocExpansion(Swashbuckle.AspNetCore.SwaggerUI.DocExpansion.List);
        c.EnableFilter();
        c.DisplayRequestDuration();
        c.DisplayOperationId();
        c.EnableTryItOutByDefault();
        c.DefaultModelsExpandDepth(-1);
    });
}

app.UseExceptionHandler();
app.UseStatusCodePages();

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// Kích hoạt CORS
app.UseCors("Frontend");

// Thứ tự bắt buộc: Xác thực (Authentication) -> Phân quyền (Authorization)
app.UseAuthentication();
// Rate limit cần chạy sau Authentication để các policy theo UserId nhận đúng danh tính.
app.UseRateLimiter();
app.UseAuthorization();

app.MapControllers();

app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = registration => registration.Tags.Contains("live"),
    ResponseWriter = HealthCheckResponseWriter.WriteAsync
}).AllowAnonymous();

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = registration => registration.Tags.Contains("ready"),
    ResponseWriter = HealthCheckResponseWriter.WriteAsync
}).AllowAnonymous();

// Minimal API Endpoints:
app.MapAuthEndpoints();
app.MapCandidateEndpoints();
app.MapCandidateSkillEndpoints();
app.MapAffiliateEndpoints();
app.MapAdminApprovalEndpoints();
app.MapAdminCandidateDuplicateEndpoints();
app.MapAdminProfileEndpoints();
app.MapAdminUserEndpoints();
app.MapAdminAuthorizationEndpoints();
app.MapAdminAuditLogEndpoints();
app.MapServiceTypeEndpoints();
app.MapCommissionMilestoneEndpoints();
app.MapCommissionRuleEndpoints();
app.MapJobEndpoints();
app.MapServiceAgreementEndpoints();
app.MapCompanyEndpoints();
app.MapInternalHrEndpoints();
app.MapInternalCvEndpoints();
app.MapAiIntegrationEndpoints();
app.MapUserEndpoints();
app.MapRecruitmentEndpoints();
app.MapSourcingDeliveryEndpoints();
app.MapJobTemplateEndpoints();
app.MapInterviewEndpoints();
app.MapOfferEndpoints();
app.MapPlacementEndpoints();
app.MapPlacementReconciliationEndpoints();
app.MapFinanceEndpoints();
app.MapDisputeEndpoints();
app.MapContactRequestEndpoints();
app.MapCvBuilderEndpoints();
app.MapJobMatchEndpoints();
app.MapCompanyDirectoryEndpoints();
app.MapAffiliateCommissionEstimateEndpoints();
app.MapHub<HRConnect.Presentation.Hubs.NotificationHub>(HRConnect.Presentation.Hubs.NotificationHub.Path);
app.MapBusinessSettingEndpoints();
app.MapPostingPackageAdminEndpoints();
app.MapVnPayPaymentEndpoints();
app.MapSubmissionConsentEndpoints();
app.MapCandidateSavedJobEndpoints();
app.MapNotificationEndpoints();
app.MapReportEndpoints();
app.MapAdminAffiliatePerformanceEndpoints();

app.Run();
