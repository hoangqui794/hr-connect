using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Globalization;
using System.Text;

namespace HRConnect.Infrastructure.Services.Storage;

public class CvStorageService : ICvStorageService
{
    private readonly IFileStorageService _fileStorageService;
    private readonly ICandidateCvRepository _candidateCvRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly R2Settings _settings;
    private readonly ILogger<CvStorageService> _logger;

    public CvStorageService(
        IFileStorageService fileStorageService,
        ICandidateCvRepository candidateCvRepository,
        IUnitOfWork unitOfWork,
        IOptions<R2Settings> options,
        ILogger<CvStorageService> logger)
    {
        _fileStorageService = fileStorageService;
        _candidateCvRepository = candidateCvRepository;
        _unitOfWork = unitOfWork;
        _settings = options.Value;
        _logger = logger;
    }

    public async Task<UploadCvResult> UploadCvPdfAsync(
        Guid candidateId,
        Stream fileStream,
        string fileName,
        long fileSizeBytes,
        string? title = null,
        bool isPrimary = false,
        CancellationToken cancellationToken = default)
    {
        // Read and validate the exact bytes that will be uploaded. This prevents a
        // renamed/non-PDF payload and a declared-size mismatch from reaching R2/MF03.
        using var validatedPdf = await ReadAndValidatePdfAsync(
            fileStream,
            fileName,
            fileSizeBytes,
            cancellationToken);

        // 2. Tạo mã định danh duy nhất và object key chuẩn
        var cvId = Guid.NewGuid();
        var objectKey = $"candidates/{candidateId}/cvs/{cvId}.pdf";

        // 3. Upload tệp lên Cloudflare R2
        string uploadedKey;
        try
        {
            uploadedKey = await _fileStorageService.UploadAsync(
                validatedPdf,
                objectKey,
                "application/pdf",
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi upload CV lên R2 cho CandidateId: {CandidateId}", candidateId);
            throw new InvalidOperationException("Không thể lưu trữ tệp CV lên hệ thống lưu trữ đám mây.", ex);
        }

        // 4. Lưu metadata vào cơ sở dữ liệu với cơ chế compensation
        var now = DateTime.UtcNow;
        var cvTitle = !string.IsNullOrWhiteSpace(title)
            ? title.Trim()
            : Path.GetFileNameWithoutExtension(fileName);

        if (cvTitle.Length > 180)
        {
            cvTitle = cvTitle.Substring(0, 180);
        }

        try
        {
            // Nếu đánh dấu là CV chính, hạ cờ is_primary của các CV cũ
            if (isPrimary)
            {
                var currentPrimary = await _candidateCvRepository.GetPrimaryByCandidateIdAsync(candidateId, cancellationToken);
                if (currentPrimary != null)
                {
                    currentPrimary.IsPrimary = false;
                    currentPrimary.UpdatedAt = now;
                    _candidateCvRepository.Update(currentPrimary);
                }
            }

            var candidateCv = new CandidateCv
            {
                CvId = cvId,
                CandidateId = candidateId,
                Title = cvTitle,
                CreationMethod = "FILE_UPLOAD",
                SourceFileUrl = uploadedKey, // Lưu object key ổn định thay vì temporary URL
                FileName = Path.GetFileName(fileName),
                MimeType = "application/pdf",
                FileSizeBytes = fileSizeBytes,
                IsPrimary = isPrimary,
                Status = "ACTIVE",
                CreatedAt = now,
                UpdatedAt = now
            };

            await _candidateCvRepository.AddAsync(candidateCv, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Lưu CV vào CSDL thành công cho CandidateId={CandidateId}, CvId={CvId}, Key={Key}",
                candidateId, cvId, uploadedKey);

            return new UploadCvResult
            {
                CvId = cvId,
                CandidateId = candidateId,
                Title = cvTitle,
                ObjectKey = uploadedKey,
                FileName = candidateCv.FileName,
                MimeType = candidateCv.MimeType,
                FileSizeBytes = fileSizeBytes,
                IsPrimary = isPrimary,
                Status = candidateCv.Status,
                CreatedAt = now
            };
        }
        catch (Exception dbEx)
        {
            _logger.LogError(dbEx, "Lỗi lưu CSDL sau khi upload R2 thành công. Tiến hành bồi hoàn (compensation delete): Key={Key}", objectKey);

            // Bồi hoàn xóa object trên R2 để tránh rác mồ côi (orphan object)
            try
            {
                await _fileStorageService.DeleteAsync(objectKey, CancellationToken.None);
                _logger.LogInformation("Đã bồi hoàn xóa đối tượng R2 thành công: Key={Key}", objectKey);
            }
            catch (Exception compEx)
            {
                _logger.LogError(compEx, "Thất bại khi bồi hoàn xóa đối tượng R2: Key={Key}", objectKey);
            }

            throw new InvalidOperationException("Không thể lưu thông tin hồ sơ CV vào cơ sở dữ liệu.", dbEx);
        }
    }

    public async Task<CvDownloadUrlResult> GetCvDownloadUrlAsync(
        Guid cvId,
        TimeSpan? expiry = null,
        CancellationToken cancellationToken = default)
    {
        var cv = await _candidateCvRepository.GetByIdAsync(cvId, cancellationToken);
        if (cv == null)
        {
            throw new NotFoundException($"Không tìm thấy CV với mã {cvId}.");
        }

        if (string.IsNullOrWhiteSpace(cv.SourceFileUrl))
        {
            throw new BadRequestException("CV này không có tệp lưu trữ hợp lệ trên hệ thống đám mây.");
        }

        var expirySpan = expiry ?? TimeSpan.FromMinutes(_settings.PresignedUrlExpiryMinutes);
        var maxExpiry = TimeSpan.FromMinutes(_settings.MaxPresignedUrlExpiryMinutes);
        if (expirySpan <= TimeSpan.Zero || expirySpan > maxExpiry)
        {
            throw new BadRequestException(
                $"Thời hạn đường dẫn tải CV phải từ 1 đến {_settings.MaxPresignedUrlExpiryMinutes} phút.");
        }

        var downloadUrl = await _fileStorageService.GetPresignedDownloadUrlAsync(
            cv.SourceFileUrl,
            expirySpan,
            cancellationToken);

        return new CvDownloadUrlResult
        {
            CvId = cvId,
            FileName = cv.FileName ?? $"{cvId}.pdf",
            MimeType = cv.MimeType ?? "application/pdf",
            DownloadUrl = downloadUrl,
            ExpiresAt = DateTime.UtcNow.Add(expirySpan)
        };
    }

    public async Task DeleteCvAsync(
        Guid cvId,
        CancellationToken cancellationToken = default)
    {
        var cv = await _candidateCvRepository.GetByIdAsync(cvId, cancellationToken);
        if (cv == null)
        {
            throw new NotFoundException($"Không tìm thấy CV với mã {cvId}.");
        }

        var objectKey = cv.SourceFileUrl;
        _candidateCvRepository.Delete(cv);
        // Commit the relational delete first. A concurrent Submission referencing this CV
        // will make this operation fail before the R2 object can be removed.
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        if (!string.IsNullOrWhiteSpace(objectKey))
        {
            try
            {
                await _fileStorageService.DeleteAsync(objectKey, cancellationToken);
            }
            catch (Exception ex)
            {
                // DB is already the source of truth. A failed external cleanup leaves an
                // orphan object, which is safer than deleting a file still used by history.
                _logger.LogWarning(ex, "Đã xóa metadata CV {CvId} nhưng chưa thể dọn tệp R2 {Key}", cvId, objectKey);
            }
        }

        _logger.LogInformation("Đã xóa metadata CV {CvId}; hoàn tất yêu cầu dọn tệp lưu trữ nếu có.", cvId);
    }

    private async Task<MemoryStream> ReadAndValidatePdfAsync(
        Stream stream,
        string fileName,
        long fileSizeBytes,
        CancellationToken cancellationToken)
    {
        if (stream == null || stream == Stream.Null)
        {
            throw new BadRequestException("Tập tin tải lên không được rỗng.");
        }

        if (string.IsNullOrWhiteSpace(fileName))
        {
            throw new BadRequestException("Tên tập tin không được để trống.");
        }

        var extension = Path.GetExtension(fileName);
        if (string.IsNullOrWhiteSpace(extension) || !extension.Equals(".pdf", StringComparison.OrdinalIgnoreCase))
        {
            throw new BadRequestException("Chỉ cho phép tải lên tập tin có định dạng PDF (.pdf).");
        }

        if (fileSizeBytes <= 0)
        {
            throw new BadRequestException("Kích thước tập tin phải lớn hơn 0 byte.");
        }

        if (fileSizeBytes > _settings.MaxCvFileSizeBytes)
        {
            throw new BadRequestException($"Kích thước tập tin ({fileSizeBytes / (1024 * 1024)}MB) vượt quá giới hạn tối đa cho phép là {_settings.MaxCvFileSizeMb}MB.");
        }

        var buffer = new MemoryStream((int)Math.Min(fileSizeBytes, _settings.MaxCvFileSizeBytes));
        try
        {
            var chunk = new byte[81920];
            int bytesRead;
            while ((bytesRead = await stream.ReadAsync(chunk.AsMemory(0, chunk.Length), cancellationToken)) > 0)
            {
                if (buffer.Length + bytesRead > _settings.MaxCvFileSizeBytes)
                {
                    throw new BadRequestException($"Kích thước tập tin vượt quá giới hạn tối đa cho phép là {_settings.MaxCvFileSizeMb}MB.");
                }

                await buffer.WriteAsync(chunk.AsMemory(0, bytesRead), cancellationToken);
            }
            if (buffer.Length != fileSizeBytes)
            {
                throw new BadRequestException("Kích thước thực tế của tập tin không khớp với thông tin tải lên.");
            }

            ValidatePdfStructure(buffer.GetBuffer().AsSpan(0, checked((int)buffer.Length)));
            buffer.Position = 0;
            return buffer;
        }
        catch
        {
            await buffer.DisposeAsync();
            throw;
        }
    }

    private static void ValidatePdfStructure(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length < 200 || !bytes.StartsWith("%PDF-"u8))
        {
            throw new BadRequestException("Nội dung tập tin không phải là tài liệu PDF hợp lệ.");
        }

        var version = bytes.Slice(5, Math.Min(3, bytes.Length - 5));
        if (version.Length != 3 ||
            (version[0] != (byte)'1' && version[0] != (byte)'2') ||
            version[1] != (byte)'.' ||
            !char.IsAsciiDigit((char)version[2]))
        {
            throw new BadRequestException("Phiên bản tài liệu PDF không hợp lệ.");
        }

        // PDF readers locate the final revision from the last %%EOF marker.
        var tailStart = Math.Max(0, bytes.Length - 4096);
        var tail = Encoding.ASCII.GetString(bytes[tailStart..]);
        var eofIndex = tail.LastIndexOf("%%EOF", StringComparison.Ordinal);
        if (eofIndex < 0)
        {
            throw new BadRequestException("Tài liệu PDF bị hỏng hoặc chưa được ghi hoàn chỉnh.");
        }

        var startXrefIndex = tail.LastIndexOf("startxref", eofIndex, StringComparison.Ordinal);
        if (startXrefIndex < 0)
        {
            throw new BadRequestException("Tài liệu PDF thiếu bảng tham chiếu bắt buộc.");
        }

        var offsetText = tail[(startXrefIndex + "startxref".Length)..eofIndex].Trim();
        var firstLine = offsetText.Split(new[] { '\r', '\n', ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
        if (!long.TryParse(firstLine, NumberStyles.None, CultureInfo.InvariantCulture, out var xrefOffset) ||
            xrefOffset < 0 || xrefOffset >= bytes.Length)
        {
            throw new BadRequestException("Bảng tham chiếu của tài liệu PDF không hợp lệ.");
        }

        var xrefProbeLength = Math.Min(512, bytes.Length - checked((int)xrefOffset));
        var xrefProbe = Encoding.ASCII.GetString(bytes.Slice(checked((int)xrefOffset), xrefProbeLength));
        if (!xrefProbe.StartsWith("xref", StringComparison.Ordinal) &&
            !xrefProbe.Contains("/Type/XRef", StringComparison.Ordinal) &&
            !xrefProbe.Contains("/Type /XRef", StringComparison.Ordinal))
        {
            throw new BadRequestException("Bảng tham chiếu của tài liệu PDF bị hỏng.");
        }

        var documentText = Encoding.Latin1.GetString(bytes);
        if (!documentText.Contains("/Type /Page", StringComparison.Ordinal) &&
            !documentText.Contains("/Type/Page", StringComparison.Ordinal))
        {
            throw new BadRequestException("Tài liệu PDF không có trang nội dung hợp lệ.");
        }

        string[] forbiddenFeatures =
        [
            "/Encrypt", "/JavaScript", "/JS", "/Launch", "/EmbeddedFile",
            "/RichMedia", "/OpenAction", "/AA"
        ];

        if (forbiddenFeatures.Any(feature => documentText.Contains(feature, StringComparison.Ordinal)))
        {
            throw new BadRequestException("Tài liệu PDF chứa tính năng chủ động hoặc nội dung nhúng không được phép.");
        }
    }
}
