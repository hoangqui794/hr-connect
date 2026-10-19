using System.Text.Json;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Candidates.CvBuilder;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Services.Storage;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Services.CvBuilder;

/// <summary>
/// BE-04 B: renders a structured CV to PDF, runs the same PDF checks as uploads, stores it in R2 and saves
/// the CV. source_file_url points at the rendered PDF so apply (MF-02) and AI scoring (MF-03) need no change.
/// </summary>
public sealed class StructuredCvService : IStructuredCvService
{
    private readonly CvPdfRenderer _renderer;
    private readonly PdfCvValidator _validator;
    private readonly IFileStorageService _storage;
    private readonly ICandidateCvRepository _cvs;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _audit;
    private readonly ILogger<StructuredCvService> _logger;

    public StructuredCvService(
        CvPdfRenderer renderer, PdfCvValidator validator, IFileStorageService storage, ICandidateCvRepository cvs,
        IUnitOfWork unitOfWork, IAuditLogService audit, ILogger<StructuredCvService> logger)
    {
        _renderer = renderer;
        _validator = validator;
        _storage = storage;
        _cvs = cvs;
        _unitOfWork = unitOfWork;
        _audit = audit;
        _logger = logger;
    }

    public async Task<CandidateCv> CreateAsync(
        Guid candidateId, Guid actorUserId, string title, CvTemplate? template, StructuredCvContent content, bool isPrimary,
        CancellationToken cancellationToken = default)
    {
        var cvId = Guid.NewGuid();
        var (key, size) = await RenderAndUploadAsync(candidateId, cvId, 1, template, content, cancellationToken);
        var now = DateTime.UtcNow;
        try
        {
            if (isPrimary)
            {
                var current = await _cvs.GetPrimaryByCandidateIdAsync(candidateId, cancellationToken);
                if (current != null)
                {
                    current.IsPrimary = false;
                    current.UpdatedAt = now;
                    _cvs.Update(current);
                }
            }

            var cv = new CandidateCv
            {
                CvId = cvId,
                CandidateId = candidateId,
                Title = title,
                CreationMethod = template == null ? CvCreationMethods.PlatformBuilder : CvCreationMethods.TemplateForm,
                CvTemplateId = template?.CvTemplateId,
                StructuredContent = JsonSerializer.Serialize(content, CvBuilderHandlers.Json),
                SourceFileUrl = key,
                RenderedFileUrl = key,
                FileName = FileName(title),
                MimeType = "application/pdf",
                FileSizeBytes = size,
                IsPrimary = isPrimary,
                Status = "ACTIVE",
                AffiliateReuseConcurrencyToken = Guid.NewGuid(),
                CreatedAt = now,
                UpdatedAt = now,
            };
            await _cvs.AddAsync(cv, cancellationToken);
            await AuditAsync(cv, actorUserId, "CREATED", cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return cv;
        }
        catch
        {
            await DeleteQuietlyAsync(key);
            throw;
        }
    }

    public async Task<CandidateCv> UpdateAsync(
        CandidateCv cv, Guid actorUserId, string title, CvTemplate? template, StructuredCvContent content,
        CancellationToken cancellationToken = default)
    {
        // A new object key per version: applications already sent keep pointing at the PDF they were sent with.
        var version = DateTime.UtcNow.Ticks;
        var previousKey = cv.SourceFileUrl;
        var (key, size) = await RenderAndUploadAsync(cv.CandidateId, cv.CvId, version, template, content, cancellationToken);
        try
        {
            cv.Title = title;
            cv.CreationMethod = template == null ? CvCreationMethods.PlatformBuilder : CvCreationMethods.TemplateForm;
            cv.CvTemplateId = template?.CvTemplateId;
            cv.StructuredContent = JsonSerializer.Serialize(content, CvBuilderHandlers.Json);
            cv.SourceFileUrl = key;
            cv.RenderedFileUrl = key;
            cv.FileName = FileName(title);
            cv.FileSizeBytes = size;
            cv.UpdatedAt = DateTime.UtcNow;
            _cvs.Update(cv);
            await AuditAsync(cv, actorUserId, "UPDATED", cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("CV {CvId} rendered again; previous file {PreviousKey} kept for past applications.", cv.CvId, previousKey);
            return cv;
        }
        catch
        {
            await DeleteQuietlyAsync(key);
            throw;
        }
    }

    private async Task<(string Key, long Size)> RenderAndUploadAsync(
        Guid candidateId, Guid cvId, long version, CvTemplate? template, StructuredCvContent content, CancellationToken cancellationToken)
    {
        var pdf = _renderer.Render(content, template?.TemplateConfig);
        _validator.Validate(pdf); // same rules as an uploaded CV
        await using var stream = new MemoryStream(pdf, writable: false);
        var key = await _storage.UploadAsync(stream, $"candidates/{candidateId}/cvs/{cvId}-v{version}.pdf", "application/pdf", cancellationToken);
        return (key, pdf.LongLength);
    }

    private Task AuditAsync(CandidateCv cv, Guid actorUserId, string change, CancellationToken cancellationToken) =>
        _audit.AddAsync(new AuditEntry
        {
            Action = AuditActions.CvUploaded,
            EntityType = "CANDIDATE_CV",
            EntityId = cv.CvId,
            ActorUserId = actorUserId,
            NewValues = new { cv.CandidateId, cv.CreationMethod, cv.CvTemplateId, cv.FileSizeBytes, cv.IsPrimary, change }
        }, cancellationToken);

    private async Task DeleteQuietlyAsync(string key)
    {
        try
        {
            await _storage.DeleteAsync(key);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Không xóa được file CV mồ côi {Key}.", key);
        }
    }

    private static string FileName(string title)
    {
        var safe = new string(title.Select(c => char.IsLetterOrDigit(c) ? c : '_').ToArray()).Trim('_');
        return $"{(safe.Length == 0 ? "cv" : safe[..Math.Min(safe.Length, 80)])}.pdf";
    }
}

public sealed class CvTemplateRepository : ICvTemplateRepository
{
    private readonly Persistence.ApplicationDbContext _context;

    public CvTemplateRepository(Persistence.ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<CvTemplate>> GetActiveAsync(CancellationToken cancellationToken = default) =>
        await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync(
            _context.CvTemplates.Where(t => t.IsActive).OrderBy(t => t.Name), cancellationToken);

    public Task<CvTemplate?> GetActiveByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(
            _context.CvTemplates, t => t.CvTemplateId == id && t.IsActive, cancellationToken);
}
