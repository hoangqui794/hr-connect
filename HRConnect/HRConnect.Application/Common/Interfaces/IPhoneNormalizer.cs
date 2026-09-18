namespace HRConnect.Application.Common.Interfaces;

public interface IPhoneNormalizer
{
    /// <summary>
    /// Chuẩn hóa số điện thoại về định dạng chuẩn (loại bỏ ký tự thừa, đưa về định dạng 10 số hoặc E.164 chuẩn).
    /// Trả về null nếu đầu vào null hoặc rỗng.
    /// </summary>
    string? Normalize(string? phone);
}
