using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Domain.Entities;
using SkiaSharp;

namespace HRConnect.Infrastructure.Services.Agreements;

public sealed class AgreementPdfRenderer : IAgreementPdfRenderer
{
    private const float PageWidth = 595f;   // A4 in points
    private const float PageHeight = 842f;
    private const float Margin = 48f;
    private const string PrimaryColorHex = "#0F172A"; // Slate 900
    private const string AccentColorHex = "#0369A1";  // Sky 700

    private static readonly Lazy<SKTypeface> Roboto = new(() =>
    {
        using var stream = Assembly.GetExecutingAssembly()
            .GetManifestResourceStream("HRConnect.Infrastructure.Assets.Fonts.Roboto-Regular.ttf")
            ?? throw new InvalidOperationException("Thiếu font Roboto nhúng trong Infrastructure.");
        return SKTypeface.FromStream(stream);
    });

    public byte[] RenderAgreementPdf(
        ServiceAgreement agreement,
        Job job,
        Company company,
        bool isSigned)
    {
        using var output = new MemoryStream();
        using (var document = SKDocument.CreatePdf(output, new SKDocumentPdfMetadata
               {
                   Title = $"Thoả thuận dịch vụ - {job.Title} (v{agreement.Version})",
                   Author = "HR Connect Platform",
                   Creator = "HR Connect System",
                   Producer = "HR Connect Agreement Engine",
               }))
        {
            var writer = new PageWriter(document);

            // Header & Title
            writer.Header("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n---o0o---");
            writer.Space(8);
            writer.Title("THỎA THUẬN CUNG CẤP DỊCH VỤ TUYỂN DỤNG");
            writer.Subtitle($"Mã thỏa thuận: {agreement.ServiceAgreementId.ToString()[..8].ToUpperInvariant()} | Phiên bản: v{agreement.Version} | Mã tra cứu: {agreement.VerificationCode}");
            writer.Rule();

            // Legal intro
            writer.Body($"Hôm nay, ngày {DateTime.UtcNow:dd/MM/yyyy}, hai bên thống nhất ký kết thỏa thuận cung cấp dịch vụ tuyển dụng thông qua nền tảng công nghệ HR Connect với các nội dung sau:");

            // Bên A
            writer.Section("BÊN A: ĐƠN VỊ CUNG CẤP DỊCH VỤ (HR CONNECT)");
            writer.Body("Tên đơn vị: CÔNG TY CỔ PHẦN CÔNG NGHỆ NHÂN SỰ HR CONNECT");
            writer.Body("Đại diện pháp lý: Ban Quản trị Nền tảng Tuyển dụng HR Connect");
            writer.Body("Địa chỉ: Khu Công nghệ cao, TP. Thủ Đức, TP. Hồ Chí Minh");
            writer.Body("Mã số thuế: 0317898989 | Email: contact@hrconnect.vn | Hotline: 1900 6868");

            // Bên B
            writer.Section("BÊN B: KHÁCH HÀNG / DOANH NGHIỆP TUYỂN DỤNG");
            writer.Body($"Tên doanh nghiệp: {agreement.CompanyNameSnapshot}");
            if (!string.IsNullOrWhiteSpace(agreement.CompanyTaxCodeSnapshot))
                writer.Body($"Mã số thuế: {agreement.CompanyTaxCodeSnapshot}");
            if (!string.IsNullOrWhiteSpace(agreement.CompanyAddressSnapshot))
                writer.Body($"Địa chỉ: {agreement.CompanyAddressSnapshot}");
            if (!string.IsNullOrWhiteSpace(agreement.SignerNameSnapshot))
                writer.Body($"Người đại diện: {agreement.SignerNameSnapshot} ({agreement.SignerRoleSnapshot ?? "Đại diện theo pháp luật / Ủy quyền"})");
            if (!string.IsNullOrWhiteSpace(agreement.SignerEmailSnapshot))
                writer.Body($"Email đại diện: {agreement.SignerEmailSnapshot}");

            // Vị trí tuyển dụng
            writer.Section("ĐIỀU 1: VỊ TRÍ VÀ DỊCH VỤ TUYỂN DỤNG");
            writer.Body($"Vị trí tuyển dụng: {job.Title}");
            writer.Body($"Loại dịch vụ: {agreement.ServiceTypeCode}");
            if (job.Quantity > 0)
                writer.Body($"Số lượng tuyển dụng: {job.Quantity} nhân sự");

            // Điều khoản thương mại
            writer.Section("ĐIỀU 2: ĐIỀU KHOẢN THƯƠNG MẠI VÀ THANH TOÁN");
            if (agreement.ServiceTypeCode == "HEADHUNT_COD")
            {
                writer.Body($"1. Phí dịch vụ Headhunt: {agreement.FeeMultiplier:0.##} tháng lương gộp (Gross monthly salary) của ứng viên khi nhận việc chính thức.");
                writer.Body($"2. Thời gian bảo hành: {agreement.WarrantyDays ?? 30} ngày kể từ ngày ứng viên bắt đầu làm việc chính thức.");
                writer.Body($"3. Thời hạn thanh toán phí: Trong vòng {agreement.PaymentDueDays ?? 15} ngày kể từ ngày Bên A phát hành thông báo phí / xuất hóa đơn.");
                writer.Body("4. Chính sách bảo hành: Trong thời gian bảo hành, nếu ứng viên tự ý nghỉ việc hoặc Bên B đơn phương chấm dứt hợp đồng do không đạt chuyên môn, Bên A có trách nhiệm cung cấp 01 suất tuyển dụng thay thế miễn phí.");
            }
            else if (agreement.ServiceTypeCode == "CV_SOURCING")
            {
                writer.Body($"1. Số lượng hồ sơ mục tiêu (Sourcing Target): {agreement.SourcingTarget ?? 10} hồ sơ đạt chuẩn (Qualified CV).");
                writer.Body($"2. Đơn giá mỗi hồ sơ đạt chuẩn: {agreement.PricePerQualifiedCv:N0} VNĐ / CV.");
                writer.Body($"3. Thời hạn xem xét hồ sơ (Review Days): {agreement.ReviewDays ?? 7} ngày làm việc kể từ thời điểm Bên A bàn giao hồ sơ.");
                writer.Body("4. Đặt cọc và quyết toán: Bên B hoàn tất khoản phí đặt cọc theo quy định trước khi hệ thống kích hoạt tìm kiếm hồ sơ và quyết toán sau khi hoàn tất số lượng bàn giao.");
            }
            else
            {
                writer.Body("Các điều khoản theo gói dịch vụ đã được hai bên xác nhận và thống nhất trên hệ thống.");
            }

            if (!string.IsNullOrWhiteSpace(agreement.AgreementNote))
            {
                writer.Body($"Ghi chú bổ sung: {agreement.AgreementNote}");
            }

            // Quyền và nghĩa vụ
            writer.Section("ĐIỀU 3: BẢO MẬT VÀ CHỐNG QUA MẶT (ANTI-BYPASS)");
            writer.Body("1. Bên B cam kết không trực tiếp hoặc gián tiếp liên hệ tuyển dụng ứng viên do Bên A giới thiệu ngoài nền tảng trong thời hạn 12 tháng kể từ ngày nhận hồ sơ mà không thanh toán phí dịch vụ cho Bên A.");
            writer.Body("2. Hai bên cam kết bảo mật toàn bộ thông tin lương thưởng, dữ liệu cá nhân của ứng viên theo quy định pháp luật về bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP).");

            // Chữ ký & Xác nhận
            writer.Section("ĐIỀU 4: XÁC NHẬN VÀ HIỆU LỰC");
            if (isSigned && agreement.SignedAt.HasValue)
            {
                writer.Body($"Thỏa thuận này đã được Bên B ký điện tử thành công vào lúc: {agreement.SignedAt.Value:dd/MM/yyyy HH:mm:ss} UTC");
                writer.Body($"Người ký: {agreement.SignerNameSnapshot} ({agreement.SignerEmailSnapshot})");
                writer.Body($"Mã băm tài liệu (SHA-256): {agreement.DocumentSha256Hash ?? "EVIDENCE-SEALED"}");
                writer.Body($"Tra cứu tính pháp lý tại: https://hrconnect.vn/verify/{agreement.VerificationCode}");
                writer.Space(12);
                writer.SignatureBox("ĐẠI DIỆN BÊN A\n(Đã xác thực điện tử qua hệ thống)", "ĐẠI DIỆN BÊN B\n(Đã ký xác thực qua Email OTP)");
            }
            else
            {
                writer.Body("TRẠNG THÁI: DỰ THẢO THỎA THUẬN (CHƯA KÝ) - CẦN ĐẠI DIỆN BÊN B XÁC THỰC MÃ OTP ĐỂ HOÀN TẤT KÝ ĐIỆN TỬ.");
                writer.Space(12);
                writer.SignatureBox("ĐẠI DIỆN BÊN A\n(Đã duyệt dự thảo)", "ĐẠI DIỆN BÊN B\n(Chờ ký điện tử)");
            }

            writer.Finish();
        }

        return output.ToArray();
    }

    private sealed class PageWriter
    {
        private readonly SKDocument _document;
        private SKCanvas? _canvas;
        private float _y;

        public PageWriter(SKDocument document)
        {
            _document = document;
            NewPage();
        }

        public void Header(string text) => Write(text, 10, SKColors.DimGray, bold: false, spacingAfter: 6, align: SKTextAlign.Center);

        public void Title(string text) => Write(text, 16, SKColor.Parse(PrimaryColorHex), bold: true, spacingAfter: 4, align: SKTextAlign.Center);

        public void Subtitle(string text) => Write(text, 9.5f, SKColor.Parse(AccentColorHex), bold: false, spacingAfter: 6, align: SKTextAlign.Center);

        public void Section(string text)
        {
            Space(8);
            Write(text.ToUpperInvariant(), 10.5f, SKColor.Parse(AccentColorHex), bold: true, spacingAfter: 3);
            Line(SKColor.Parse(AccentColorHex), 0.75f);
            Space(3);
        }

        public void Body(string text, bool muted = false) =>
            Write(text, 9.5f, muted ? SKColors.Gray : SKColor.Parse(PrimaryColorHex), bold: false, spacingAfter: 3);

        public void Space(float points) => _y += points;

        public void Rule()
        {
            Space(4);
            Line(SKColors.LightGray, 0.5f);
            Space(6);
        }

        public void SignatureBox(string titleA, string titleB)
        {
            EnsureRoom(60);
            using var font = new SKFont(Roboto.Value, 10) { Embolden = true };
            using var paint = new SKPaint { Color = SKColor.Parse(PrimaryColorHex), IsAntialias = true };
            
            var halfWidth = (PageWidth - 2 * Margin) / 2;
            _canvas!.DrawText(titleA, Margin + 30, _y + 15, SKTextAlign.Left, font, paint);
            _canvas.DrawText(titleB, Margin + halfWidth + 30, _y + 15, SKTextAlign.Left, font, paint);
            _y += 60;
        }

        public void Finish() => _document.EndPage();

        private void NewPage()
        {
            if (_canvas != null) _document.EndPage();
            _canvas = _document.BeginPage(PageWidth, PageHeight);
            _y = Margin;
        }

        private void Line(SKColor color, float width)
        {
            EnsureRoom(4);
            using var paint = new SKPaint { Color = color, StrokeWidth = width, IsAntialias = true };
            _canvas!.DrawLine(Margin, _y, PageWidth - Margin, _y, paint);
            _y += 2;
        }

        private void EnsureRoom(float height)
        {
            if (_y + height > PageHeight - Margin) NewPage();
        }

        private void Write(string text, float size, SKColor color, bool bold, float spacingAfter, SKTextAlign align = SKTextAlign.Left)
        {
            using var font = new SKFont(Roboto.Value, size) { Embolden = bold, Subpixel = true };
            using var paint = new SKPaint { Color = color, IsAntialias = true };
            var lineHeight = font.Spacing * 1.2f;
            var maxWidth = PageWidth - 2 * Margin;

            foreach (var paragraph in text.Replace("\r\n", "\n").Split('\n'))
            {
                foreach (var line in Wrap(paragraph, font, maxWidth))
                {
                    EnsureRoom(lineHeight);
                    _y += lineHeight;
                    float x = align switch
                    {
                        SKTextAlign.Center => Margin + maxWidth / 2,
                        SKTextAlign.Right => Margin + maxWidth,
                        _ => Margin
                    };
                    _canvas!.DrawText(line, x, _y - font.Metrics.Descent, align, font, paint);
                }
            }

            _y += spacingAfter;
        }

        private static IEnumerable<string> Wrap(string paragraph, SKFont font, float maxWidth)
        {
            if (paragraph.Length == 0)
            {
                yield return string.Empty;
                yield break;
            }

            var line = string.Empty;
            foreach (var word in paragraph.Split(' ', StringSplitOptions.RemoveEmptyEntries))
            {
                var candidate = line.Length == 0 ? word : $"{line} {word}";
                if (font.MeasureText(candidate) <= maxWidth)
                {
                    line = candidate;
                    continue;
                }

                if (line.Length > 0) yield return line;
                line = word;
                while (font.MeasureText(line) > maxWidth && line.Length > 1)
                {
                    var cut = line.Length - 1;
                    while (cut > 1 && font.MeasureText(line[..cut]) > maxWidth) cut--;
                    yield return line[..cut];
                    line = line[cut..];
                }
            }

            if (line.Length > 0) yield return line;
        }
    }
}
