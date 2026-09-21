namespace HRConnect.Domain.Entities;

public partial class ServiceTypeAllowedRole
{
    public Guid ServiceTypeId { get; set; }

    public Guid RoleId { get; set; }

    public bool CanView { get; set; }

    public bool CanSubmit { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ServiceType ServiceType { get; set; } = null!;

    public virtual Role Role { get; set; } = null!;
}
