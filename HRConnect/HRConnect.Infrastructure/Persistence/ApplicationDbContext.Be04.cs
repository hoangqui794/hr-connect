using HRConnect.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Persistence;

/// <summary>BE-04 tables (contact form), kept apart from the generated model.</summary>
public partial class ApplicationDbContext
{
    public virtual DbSet<ContactRequest> ContactRequests { get; set; }

    private static void ConfigureBe04(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ContactRequest>(entity =>
        {
            entity.HasKey(e => e.ContactRequestId).HasName("contact_request_pkey");

            entity.ToTable("contact_request", "public", tb =>
            {
                tb.HasComment("BE-04 A: public contact form. Stored only with consent (Decree 13/2023).");
                tb.HasCheckConstraint("ck_contact_request_status", "status IN ('NEW','CONTACTED','CLOSED')");
                tb.HasCheckConstraint("ck_contact_request_service",
                    "service_interest IN ('HEADHUNT_COD','CV_SOURCING','CV_APPLICATION','OTHER')");
                tb.HasCheckConstraint("ck_contact_request_consent", "consent_accepted");
            });

            entity.HasIndex(e => new { e.Status, e.CreatedAt }, "idx_contact_request_status_created");
            entity.HasIndex(e => new { e.SourceIpHash, e.CreatedAt }, "idx_contact_request_ip_created");

            entity.Property(e => e.ContactRequestId).HasDefaultValueSql("gen_random_uuid()").HasColumnName("contact_request_id");
            entity.Property(e => e.FullName).HasMaxLength(150).HasColumnName("full_name");
            entity.Property(e => e.Email).HasMaxLength(255).HasColumnName("email");
            entity.Property(e => e.Phone).HasMaxLength(30).HasColumnName("phone");
            entity.Property(e => e.CompanyName).HasMaxLength(255).HasColumnName("company_name");
            entity.Property(e => e.ServiceInterest).HasMaxLength(30).HasColumnName("service_interest");
            entity.Property(e => e.Message).HasMaxLength(2000).HasColumnName("message");
            entity.Property(e => e.ConsentAccepted).HasColumnName("consent_accepted");
            entity.Property(e => e.Status).HasMaxLength(20).HasDefaultValueSql("'NEW'::character varying").HasColumnName("status");
            entity.Property(e => e.HandledBy).HasColumnName("handled_by");
            entity.Property(e => e.Note).HasMaxLength(2000).HasColumnName("note");
            entity.Property(e => e.SourceIpHash).HasMaxLength(64).HasColumnName("source_ip_hash");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()").HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("now()").HasColumnName("updated_at");
        });
    }
}
