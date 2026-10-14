using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Persistence.Seed;

public static class JobPostingPackageSeeder
{
    public static readonly (string Code, string Name, string Description, decimal DefaultPrice, int DefaultDurationDays, int? DefaultMaxApplications)[] ExpectedPackages =
    [
        (JobPostingPackageCodes.Free, "Gói Miễn Phí (Trải nghiệm)", "Đăng 1 tin tuyển dụng hiển thị 30 ngày, tối đa 50 hồ sơ hợp lệ, 1 tin mở đồng thời, chu kỳ 2 tháng.", 0m, 30, 50),
        (JobPostingPackageCodes.Standard, "Gói Tiêu Chuẩn 30 Ngày", "Đăng tin công khai 30 ngày, tối đa 50 hồ sơ hợp lệ, chấm điểm ứng viên bằng AI.", 1500000m, 30, 50)
    ];

    public static async Task SeedAsync(
        ApplicationDbContext context,
        ILogger? logger = null,
        CancellationToken cancellationToken = default)
    {
        var expectedCodes = ExpectedPackages.Select(p => p.Code).ToList();
        var existingPackages = await context.JobPostingPackages
            .Where(p => expectedCodes.Contains(p.Code))
            .ToListAsync(cancellationToken);

        var existingMap = existingPackages.ToDictionary(p => p.Code, StringComparer.OrdinalIgnoreCase);

        var changed = false;
        var now = DateTime.UtcNow;

        foreach (var (code, name, desc, defPrice, defDays, defMaxApps) in ExpectedPackages)
        {
            var price = defPrice;
            var duration = defDays;

            if (!existingMap.TryGetValue(code, out var existing))
            {
                var newPackage = new JobPostingPackage
                {
                    PackageId = Guid.NewGuid(),
                    Code = code,
                    Name = name,
                    Description = desc,
                    Price = price,
                    DurationDays = duration,
                    MaxApplications = defMaxApps,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                await context.JobPostingPackages.AddAsync(newPackage, cancellationToken);
                changed = true;
            }
            else
            {
                // Đồng bộ cấu hình giá/thời hạn/max hồ sơ
                if (existing.Price != price || existing.DurationDays != duration || existing.MaxApplications != defMaxApps)
                {
                    existing.Price = price;
                    existing.DurationDays = duration;
                    existing.MaxApplications = defMaxApps;
                    existing.UpdatedAt = now;
                    changed = true;
                }
            }
        }

        if (changed)
        {
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("Đã khởi tạo/đồng bộ danh mục gói đăng tin JobPostingPackage thành công.");
        }
    }
}
