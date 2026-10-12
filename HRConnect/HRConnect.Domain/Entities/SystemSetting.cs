using System;

namespace HRConnect.Domain.Entities;

/// <summary>
/// A business number Platform Admin can change without a deploy (fee multiplier, warranty days, ...).
/// Keys and their defaults/ranges are declared in code (BusinessSettingKeys); a row only exists once
/// an Admin overrides the default.
/// </summary>
public partial class SystemSetting
{
    public string SettingKey { get; set; } = null!;

    /// <summary>Invariant-culture text of the value (e.g. "1.5", "20").</summary>
    public string Value { get; set; } = null!;

    public Guid? UpdatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual AppUser? UpdatedByNavigation { get; set; }
}
