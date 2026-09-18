namespace HRConnect.Application.Common.Interfaces;

public interface IOtpService
{
    /// <summary>
    /// Sinh mã OTP gồm các chữ số ngẫu nhiên bảo mật (Cryptographically Secure PRNG).
    /// </summary>
    string GenerateNumericOtp(int length = 6);

    /// <summary>
    /// Băm OTP trước khi lưu trữ vào database. Tuyệt đối không lưu OTP plain-text.
    /// </summary>
    string HashOtp(string otp);

    /// <summary>
    /// So khớp mã OTP người dùng nhập vào với mã băm trong database.
    /// </summary>
    bool VerifyOtp(string otp, string otpHash);
}
