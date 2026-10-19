namespace HRConnect.Domain.Entities;

/// <summary>
/// BE-02: references to the industry / company size tables and the Admin "Top Companies" flag.
/// The free-text Industry / CompanySize columns stay during the move and are kept in sync.
/// </summary>
public partial class Company
{
    public Guid? IndustryId { get; set; }

    public Guid? CompanySizeId { get; set; }

    public bool IsFeatured { get; set; }

    public int? FeaturedOrder { get; set; }

    public virtual Industry? IndustryRef { get; set; }

    public virtual CompanySizeOption? CompanySizeRef { get; set; }
}
