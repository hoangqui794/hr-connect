namespace HRConnect.Domain.Entities;

/// <summary>BE-02 A: industry taxonomy, up to 3 levels (LinkedIn-style L1/L2/L3). Seeded from CSV, edited by Admin.</summary>
public class Industry
{
    public Guid IndustryId { get; set; }

    public string Code { get; set; } = null!;

    public string NameEn { get; set; } = null!;

    public string? NameVi { get; set; }

    public short Level { get; set; }

    public Guid? ParentId { get; set; }

    public int SortOrder { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Industry? Parent { get; set; }

    public virtual ICollection<Industry> Children { get; set; } = new List<Industry>();

    public virtual ICollection<Company> Companies { get; set; } = new List<Company>();
}

/// <summary>BE-02 A: company size bands (1, 2-10, ..., 10001+).</summary>
public class CompanySizeOption
{
    public Guid CompanySizeId { get; set; }

    public string Code { get; set; } = null!;

    public string Label { get; set; } = null!;

    public int MinEmployees { get; set; }

    public int? MaxEmployees { get; set; }

    public int SortOrder { get; set; }

    public bool IsActive { get; set; } = true;

    public virtual ICollection<Company> Companies { get; set; } = new List<Company>();
}
