using HRConnect.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Persistence;

/// <summary>BE-02 tables (industry taxonomy, company sizes) and the new company columns.</summary>
public partial class ApplicationDbContext
{
    public virtual DbSet<Industry> Industries { get; set; }

    public virtual DbSet<CompanySizeOption> CompanySizes { get; set; }

    private static void ConfigureBe02(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Industry>(entity =>
        {
            entity.HasKey(e => e.IndustryId).HasName("industry_pkey");
            entity.ToTable("industry", "public", tb =>
            {
                tb.HasComment("BE-02 A: industry taxonomy L1/L2/L3, seeded from Seed/Data/industry.csv, edited by Platform Admin.");
                tb.HasCheckConstraint("ck_industry_level", "level BETWEEN 1 AND 3");
            });
            entity.HasIndex(e => e.Code, "industry_code_key").IsUnique();
            entity.HasIndex(e => new { e.ParentId, e.IsActive, e.SortOrder }, "idx_industry_parent");

            entity.Property(e => e.IndustryId).HasDefaultValueSql("gen_random_uuid()").HasColumnName("industry_id");
            entity.Property(e => e.Code).HasMaxLength(100).HasColumnName("code");
            entity.Property(e => e.NameEn).HasMaxLength(200).HasColumnName("name_en");
            entity.Property(e => e.NameVi).HasMaxLength(200).HasColumnName("name_vi");
            entity.Property(e => e.Level).HasColumnName("level");
            entity.Property(e => e.ParentId).HasColumnName("parent_id");
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
            entity.Property(e => e.IsActive).HasDefaultValue(true).HasColumnName("is_active");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()").HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("now()").HasColumnName("updated_at");

            entity.HasOne(e => e.Parent).WithMany(e => e.Children)
                .HasForeignKey(e => e.ParentId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("industry_parent_id_fkey");
        });

        modelBuilder.Entity<CompanySizeOption>(entity =>
        {
            entity.HasKey(e => e.CompanySizeId).HasName("company_size_pkey");
            entity.ToTable("company_size", "public", tb =>
                tb.HasComment("BE-02 A: company size bands, seeded from Seed/Data/company_size.csv."));
            entity.HasIndex(e => e.Code, "company_size_code_key").IsUnique();

            entity.Property(e => e.CompanySizeId).HasDefaultValueSql("gen_random_uuid()").HasColumnName("company_size_id");
            entity.Property(e => e.Code).HasMaxLength(30).HasColumnName("code");
            entity.Property(e => e.Label).HasMaxLength(100).HasColumnName("label");
            entity.Property(e => e.MinEmployees).HasColumnName("min_employees");
            entity.Property(e => e.MaxEmployees).HasColumnName("max_employees");
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
            entity.Property(e => e.IsActive).HasDefaultValue(true).HasColumnName("is_active");
        });

        modelBuilder.Entity<Company>(entity =>
        {
            entity.Property(e => e.IndustryId).HasColumnName("industry_id");
            entity.Property(e => e.CompanySizeId).HasColumnName("company_size_id");
            entity.Property(e => e.IsFeatured).HasDefaultValue(false).HasColumnName("is_featured");
            entity.Property(e => e.FeaturedOrder).HasColumnName("featured_order");

            entity.HasIndex(e => e.IndustryId, "idx_company_industry");
            entity.HasIndex(e => new { e.IsFeatured, e.FeaturedOrder }, "idx_company_featured");

            entity.HasOne(e => e.IndustryRef).WithMany(e => e.Companies)
                .HasForeignKey(e => e.IndustryId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("company_industry_id_fkey");
            entity.HasOne(e => e.CompanySizeRef).WithMany(e => e.Companies)
                .HasForeignKey(e => e.CompanySizeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("company_company_size_id_fkey");
        });
    }
}
