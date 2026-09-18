namespace HRConnect.Application.Common.Interfaces;

public interface IEmailNormalizer
{
    /// <summary>
    /// Chuẩn hóa email bằng cách trim khoảng trắng và chuyển về chữ thường (lowercase).
    /// </summary>
    string Normalize(string email);
}
