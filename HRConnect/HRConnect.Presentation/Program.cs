using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using HRConnect.Application;
using HRConnect.Infrastructure;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

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
        Description = "Nhập token theo định dạng: Bearer {token}",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
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
});

builder.Services.AddAuthorization();

// Clean Architecture: Dang ky cac dich vu cua tung tang
builder.Services.AddApplicationServices();
builder.Services.AddInfrastructureServices(builder.Configuration);

var app = builder.Build();

// ==============================================================================
// 3. Cấu hình HTTP Request Pipeline (Middleware)
// ==============================================================================

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "HRConnect API V1");
    });
}

app.UseExceptionHandler();
app.UseStatusCodePages();

app.UseHttpsRedirection();

// Kích hoạt CORS
app.UseCors("AllowAll");

// Thứ tự bắt buộc: Xác thực (Authentication) -> Phân quyền (Authorization)
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// TODO: Sau này khi tạo Minimal API endpoints trong thư mục Endpoints/V1/Auth, map tại đây:
// app.MapAuthEndpoints();

// ==============================================================================
// 4. Tự động kiểm tra và áp dụng Migration (Code-First) khi ứng dụng khởi động
// ==============================================================================
try
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await dbContext.Database.MigrateAsync();
    app.Logger.LogInformation(">>> Database migrated successfully! <<<");
}
catch (Exception ex)
{
    app.Logger.LogError(ex, ">>> Có lỗi xảy ra khi tự động migrate Database! <<<");
}

app.Run();
