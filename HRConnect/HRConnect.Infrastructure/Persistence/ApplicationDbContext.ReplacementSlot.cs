using HRConnect.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Persistence;

/// <summary>MF-05 replacement slots (docs/main-flows.md (MF-05, suất thay thế)), kept apart from the generated model.</summary>
public partial class ApplicationDbContext
{
    public virtual DbSet<ReplacementSlot> ReplacementSlots { get; set; }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        ConfigureBe04(modelBuilder);
        ConfigureBe02(modelBuilder);

        modelBuilder.Entity<ReplacementSlot>(entity =>
        {
            entity.HasKey(e => e.ReplacementSlotId).HasName("replacement_slot_pkey");

            entity.ToTable("replacement_slot", "public", tb =>
            {
                tb.HasComment("MF-05 free replacement hire after a HEADHUNT_COD placement leaves during warranty. One per placement and per service fee.");
                tb.HasCheckConstraint("ck_replacement_slot_status", "status IN ('WAITING_PAYMENT','OPEN','FILLED','CANCELLED','EXPIRED')");
                tb.HasCheckConstraint("ck_replacement_slot_fill_window", "fill_window_days > 0");
                tb.HasCheckConstraint("ck_replacement_slot_filled", "(status = 'FILLED') = (filled_by_placement_id IS NOT NULL)");
                tb.HasCheckConstraint("ck_replacement_slot_cancel_reason", "status <> 'CANCELLED' OR cancel_reason IS NOT NULL");
            });

            // One slot per placement and per fee: the "only one replacement per fee" rule lives in the database.
            entity.HasIndex(e => e.OriginalPlacementId, "replacement_slot_original_placement_id_key").IsUnique();
            entity.HasIndex(e => e.ServiceFeeId, "replacement_slot_service_fee_id_key").IsUnique();
            entity.HasIndex(e => e.FilledByPlacementId, "replacement_slot_filled_by_placement_id_key").IsUnique();
            entity.HasIndex(e => new { e.JobId, e.Status, e.OpenedAt }, "idx_replacement_slot_job_status_opened");
            entity.HasIndex(e => new { e.Status, e.ExpiresAt }, "idx_replacement_slot_status_expires");

            entity.Property(e => e.ReplacementSlotId).HasDefaultValueSql("gen_random_uuid()").HasColumnName("replacement_slot_id");
            entity.Property(e => e.JobId).HasColumnName("job_id");
            entity.Property(e => e.OriginalPlacementId).HasColumnName("original_placement_id");
            entity.Property(e => e.ServiceFeeId).HasColumnName("service_fee_id");
            entity.Property(e => e.Status).HasMaxLength(30).HasColumnName("status");
            entity.Property(e => e.FillWindowDays).HasColumnName("fill_window_days");
            entity.Property(e => e.OpenedAt).HasColumnName("opened_at");
            entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");
            entity.Property(e => e.FilledByPlacementId).HasColumnName("filled_by_placement_id");
            entity.Property(e => e.ClosedAt).HasColumnName("closed_at");
            entity.Property(e => e.ClosedBy).HasColumnName("closed_by");
            entity.Property(e => e.CancelReason).HasMaxLength(500).HasColumnName("cancel_reason");
            entity.Property(e => e.ConcurrencyToken).IsConcurrencyToken().HasDefaultValueSql("gen_random_uuid()").HasColumnName("concurrency_token");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()").HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("now()").HasColumnName("updated_at");

            entity.HasOne(d => d.Job).WithMany()
                .HasForeignKey(d => d.JobId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_replacement_slot_job");
            entity.HasOne(d => d.OriginalPlacement).WithMany()
                .HasForeignKey(d => d.OriginalPlacementId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_replacement_slot_original_placement");
            entity.HasOne(d => d.ServiceFee).WithMany()
                .HasForeignKey(d => d.ServiceFeeId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_replacement_slot_service_fee");
            entity.HasOne(d => d.FilledByPlacement).WithMany()
                .HasForeignKey(d => d.FilledByPlacementId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_replacement_slot_filled_by_placement");
        });

        // Link columns, written once when the record is created (MF-02 / MF-04), never inferred on read.
        modelBuilder.Entity<Submission>(entity =>
        {
            entity.Property(e => e.ReplacementSlotId).HasColumnName("replacement_slot_id");
            entity.HasIndex(e => e.ReplacementSlotId, "idx_submission_replacement_slot_id");
            entity.HasOne(d => d.ReplacementSlot).WithMany()
                .HasForeignKey(d => d.ReplacementSlotId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_submission_replacement_slot");
        });

        modelBuilder.Entity<HRConnect.Domain.Entities.Application>(entity =>
        {
            entity.Property(e => e.ReplacementSlotId).HasColumnName("replacement_slot_id");
            entity.HasIndex(e => e.ReplacementSlotId, "idx_application_replacement_slot_id");
            entity.HasOne(d => d.ReplacementSlot).WithMany()
                .HasForeignKey(d => d.ReplacementSlotId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_application_replacement_slot");
        });

        modelBuilder.Entity<Placement>(entity =>
        {
            entity.Property(e => e.ReplacementSlotId).HasColumnName("replacement_slot_id");
            // A slot is filled by at most one placement.
            entity.HasIndex(e => e.ReplacementSlotId, "placement_replacement_slot_id_key").IsUnique();
            entity.HasOne(d => d.ReplacementSlot).WithMany()
                .HasForeignKey(d => d.ReplacementSlotId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_placement_replacement_slot");
        });
    }
}
