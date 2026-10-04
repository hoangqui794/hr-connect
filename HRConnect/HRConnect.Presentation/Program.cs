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
using HRConnect.Presentation.Swagger;
using HRConnect.Presentation.Endpoints.Internal;
using HRConnect.Presentation.Endpoints.V1.Recruitment;
using HRConnect.Presentation.Endpoints.V1.Users;
using Microsoft.EntityFrameworkCore;
using HRConnect.Presentation.Middleware;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using HRConnect.Presentation.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using System.Net;

// ==============================================================================
// 1. Nạp biến môi trường từ file .env
// ==============================================================================
DotNetEnv.Env.TraversePath().Load();

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddEnvironmentVariables();

// ==============================================================================
// 2. Đăng ký các dịch vụ (Dependency Injection)
// ==============================================================================

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddProblemDetails();
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
});

// Cấu hình CORS (Cho phép Frontend kết nối API)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Cấu hình Swagger hỗ trợ xác thực JWT (Bearer Auth 🔒)
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "HRConnect API",
        Version = "v1",
        Description = "Hệ thống quản lý nhân sự HRConnect - API Documentation"
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
var jwtSecret = builder.Configuration["JwtSettings:Secret"] ?? "YourSuperSecretKeyWithAtLeast32CharactersLong!123456";
var jwtIssuer = builder.Configuration["JwtSettings:Issuer"] ?? "HRConnect";
var jwtAudience = builder.Configuration["JwtSettings:Audience"] ?? "HRConnectApp";

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

// Clean Architecture: Dang ky cac dich vu cua tung tang
builder.Services.AddApplicationServices();
builder.Services.AddInfrastructureServices(builder.Configuration);

var app = builder.Build();

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
    });
}

app.UseExceptionHandler();
app.UseStatusCodePages();

app.UseHttpsRedirection();

// Kích hoạt CORS
app.UseCors("AllowAll");

// Thứ tự bắt buộc: Xác thực (Authentication) -> Phân quyền (Authorization)
app.UseAuthentication();
// Rate limit cần chạy sau Authentication để các policy theo UserId nhận đúng danh tính.
app.UseRateLimiter();
app.UseAuthorization();

app.MapControllers();

// Minimal API Endpoints:
app.MapAuthEndpoints();
app.MapCandidateEndpoints();
app.MapAffiliateEndpoints();
app.MapAdminApprovalEndpoints();
app.MapAdminProfileEndpoints();
app.MapAdminAuditLogEndpoints();
app.MapServiceTypeEndpoints();
app.MapCommissionMilestoneEndpoints();
app.MapCommissionRuleEndpoints();
app.MapJobEndpoints();
app.MapCompanyEndpoints();
app.MapInternalHrEndpoints();
app.MapInternalCvEndpoints();
app.MapAiIntegrationEndpoints();
app.MapUserEndpoints();
app.MapRecruitmentEndpoints();
app.MapInterviewEndpoints();
app.MapOfferEndpoints();
app.MapPlacementEndpoints();
app.MapSubmissionConsentEndpoints();

// ==============================================================================
// 4. Tự động kiểm tra và áp dụng Migration (Code-First) khi ứng dụng khởi động
// ==============================================================================
try
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
    var emailNormalizer = scope.ServiceProvider.GetRequiredService<IEmailNormalizer>();
    var phoneNormalizer = scope.ServiceProvider.GetRequiredService<IPhoneNormalizer>();

    await dbContext.Database.MigrateAsync();

    var enableDemoAccounts = app.Environment.IsDevelopment()
        || app.Environment.IsEnvironment("Testing")
        || app.Environment.IsEnvironment("Demo")
        || builder.Configuration.GetValue<bool>("SeedDemoAccounts", false);

    await DatabaseSeeder.SeedAsync(
        dbContext,
        app.Logger,
        seedDemoAccounts: enableDemoAccounts,
        passwordHasher: passwordHasher,
        emailNormalizer: emailNormalizer,
        phoneNormalizer: phoneNormalizer);

    app.Logger.LogInformation(">>> Database migrated and seeded successfully! <<<");
}
catch (Exception ex)
{
    // Never serve traffic against a partially migrated schema. A logging provider
    // can also fail during startup, so keep the migration exception intact.
    try
    {
        app.Logger.LogCritical(ex, ">>> Database migration failed; application startup aborted. <<<");
    }
    catch
    {
        Console.Error.WriteLine(ex);
    }

    throw new InvalidOperationException("Database migration failed. Application startup was aborted.", ex);
}

app.Run();
