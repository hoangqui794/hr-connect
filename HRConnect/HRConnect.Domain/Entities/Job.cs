using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class Job
{
    public Guid JobId { get; set; }

    public Guid CompanyId { get; set; }

    public Guid ServiceTypeId { get; set; }

    public Guid CreatedBy { get; set; }

    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public string? Benefits { get; set; }

    public string? Location { get; set; }

    public string? WorkingTime { get; set; }

    public string? EmploymentType { get; set; }

    public decimal? SalaryMin { get; set; }

    public decimal? SalaryMax { get; set; }

    public bool SalaryNegotiable { get; set; }

    public string? SalaryNote { get; set; }

    public int? MinExperienceYears { get; set; }

    public int? MaxExperienceYears { get; set; }

    public string CurrencyCode { get; set; } = null!;

    public int Quantity { get; set; }

    /// <summary>
    /// Allowed Job states. Exact transition graph is enforced by application service until Business Rule state machine is formally baselined.
    /// </summary>
    public string Status { get; set; } = null!;

    public DateTime? PostedAt { get; set; }

    public DateTime? ClosedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Guid ConcurrencyToken { get; set; }

    public string? StatusReason { get; set; }
 
    /// <summary>
    /// Sourcing Target: Số lượng Qualified CV Client mua (dịch vụ CV_SOURCING).
    /// </summary>
    public int? SourcingTarget { get; set; }

    /// <summary>
    /// Đơn giá cho mỗi Qualified CV (dịch vụ CV_SOURCING). HR chốt khi duyệt.
    /// </summary>
    public decimal? SourcingPricePerCv { get; set; }

    /// <summary>
    /// Hệ số phí tuyển dụng (dịch vụ HEADHUNT_COD, ví dụ 1.5). HR chốt khi duyệt.
    /// </summary>
    public decimal? FeeMultiplier { get; set; }

    /// <summary>
    /// Số ngày bảo hành theo Job (dịch vụ HEADHUNT_COD, ví dụ 30 ngày). HR chốt khi duyệt.
    /// </summary>
    public int? WarrantyDays { get; set; }

    /// <summary>
    /// Số ngày đến hạn thanh toán phí sau ngày ứng viên đi làm. HR chốt khi duyệt.
    /// </summary>
    public int? PaymentDueDays { get; set; }

    /// <summary>
    /// Tỷ lệ đặt cọc gói CV_SOURCING (%) do HR chốt khi duyệt (mặc định 50%).
    /// </summary>
    public decimal? DepositPercent { get; set; }

    /// <summary>
    /// Thời hạn Client xem xét CV cho dịch vụ CV_SOURCING (ngày) do HR chốt khi duyệt (mặc định 7 ngày).
    /// </summary>
    public int? ReviewDays { get; set; }

    /// <summary>
    /// Client đề xuất: Hệ số phí tuyển dụng (HEADHUNT_COD).
    /// </summary>
    public decimal? ProposedFeeMultiplier { get; set; }

    /// <summary>
    /// Client đề xuất: Số ngày bảo hành (HEADHUNT_COD).
    /// </summary>
    public int? ProposedWarrantyDays { get; set; }

    /// <summary>
    /// Client đề xuất: Hạn thanh toán phí (ngày).
    /// </summary>
    public int? ProposedPaymentDueDays { get; set; }

    /// <summary>
    /// Client đề xuất: Đơn giá cho mỗi CV (CV_SOURCING).
    /// </summary>
    public decimal? ProposedPricePerCv { get; set; }

    /// <summary>
    /// Client đề xuất: Ghi chú mong muốn về điều khoản thương mại.
    /// </summary>
    public string? ProposedFeeNote { get; set; }

    /// <summary>
    /// Mã/Bằng chứng thỏa thuận hợp đồng hoặc email xác nhận khi duyệt job.
    /// </summary>
    public string? AgreementReference { get; set; }

    /// <summary>
    /// Ghi chú của Internal HR khi chốt điều khoản duyệt job.
    /// </summary>
    public string? AgreementNote { get; set; }

    /// <summary>
    /// Thời điểm chốt điều khoản khi duyệt job.
    /// </summary>
    public DateTime? AgreedAt { get; set; }

    /// <summary>
    /// Người dùng Internal HR / Platform Admin chốt điều khoản khi duyệt job.
    /// </summary>
    public Guid? AgreedBy { get; set; }

    /// <summary>
    /// Gói đăng tin tuyển dụng gắn với Job (dịch vụ CV_APPLICATION).
    /// </summary>
    public Guid? PostingPackageId { get; set; }

    /// <summary>
    /// Thời điểm hết hạn hiển thị của tin tuyển dụng theo gói.
    /// </summary>
    public DateTime? ExpiresAt { get; set; }

    /// <summary>
    /// Số lượng hồ sơ tối đa nhận cho tin tuyển dụng theo gói (ví dụ 50 hồ sơ).
    /// </summary>
    public int? MaxApplications { get; set; }

    /// <summary>
    /// Hạn nhận hồ sơ ứng tuyển của công việc (MF-01).
    /// </summary>
    public DateTime? ApplicationDeadline { get; set; }

    /// <summary>MF-01: JD template the Client started from (statistics only; the job content is an independent copy).</summary>
    public Guid? TemplateId { get; set; }

    public virtual JobTemplate? Template { get; set; }

    public virtual AppUser? AgreedByNavigation { get; set; }

    public virtual ICollection<Application> Applications { get; set; } = new List<Application>();

    public virtual ICollection<CandidateJobMatch> CandidateJobMatches { get; set; } = new List<CandidateJobMatch>();

    public virtual Company Company { get; set; } = null!;

    public virtual AppUser CreatedByNavigation { get; set; } = null!;

    public virtual ICollection<JobRequirement> JobRequirements { get; set; } = new List<JobRequirement>();

    public virtual ICollection<JobSkill> JobSkills { get; set; } = new List<JobSkill>();

    public virtual ICollection<JobStatusHistory> JobStatusHistories { get; set; } = new List<JobStatusHistory>();

    public virtual ServiceType ServiceType { get; set; } = null!;

    public virtual ICollection<Submission> Submissions { get; set; } = new List<Submission>();

    public virtual JobPostingPackage? PostingPackage { get; set; }

    public virtual ICollection<JobPostingFee> JobPostingFees { get; set; } = new List<JobPostingFee>();

    public virtual ICollection<CandidateSavedJob> CandidateSavedJobs { get; set; } = new List<CandidateSavedJob>();
}

