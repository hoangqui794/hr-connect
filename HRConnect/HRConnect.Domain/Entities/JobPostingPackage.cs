using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

/// <summary>
/// Gói đăng tin tuyển dụng cho dịch vụ CV_APPLICATION (FREE, STANDARD,...).
/// </summary>
public partial class JobPostingPackage
{
    public Guid PackageId { get; set; }

    /// <summary>Mã định danh gói (FREE, STANDARD).</summary>
    public string Code { get; set; } = null!;

    /// <summary>Tên hiển thị của gói.</summary>
    public string Name { get; set; } = null!;

    /// <summary>Mô tả chi tiết quyền lợi gói.</summary>
    public string? Description { get; set; }

    /// <summary>Giá niêm yết của gói (VNĐ). 0 đối với gói FREE.</summary>
    public decimal Price { get; set; }

    /// <summary>Thời gian hiển thị tin tuyển dụng (số ngày, ví dụ 30 ngày).</summary>
    public int DurationDays { get; set; }

    /// <summary>Gói có đang được phép sử dụng không.</summary>
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<Job> Jobs { get; set; } = new List<Job>();

    public virtual ICollection<JobPostingFee> JobPostingFees { get; set; } = new List<JobPostingFee>();
}
