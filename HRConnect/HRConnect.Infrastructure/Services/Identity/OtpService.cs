using System.Security.Cryptography;
using System.Text;
using HRConnect.Application.Common.Interfaces;

namespace HRConnect.Infrastructure.Services.Identity;

public class OtpService : IOtpService
{
    public string GenerateNumericOtp(int length = 6)
    {
        if (length <= 0) length = 6;

        int max = (int)Math.Pow(10, length);
        int number = RandomNumberGenerator.GetInt32(0, max);

        return number.ToString(new string('0', length));
    }

    public string HashOtp(string otp)
    {
        var bytes = Encoding.UTF8.GetBytes(otp);
        var hashBytes = SHA256.HashData(bytes);
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }

    public bool VerifyOtp(string otp, string otpHash)
    {
        if (string.IsNullOrWhiteSpace(otp) || string.IsNullOrWhiteSpace(otpHash))
        {
            return false;
        }

        var incomingHash = HashOtp(otp);
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(incomingHash),
            Encoding.UTF8.GetBytes(otpHash.ToLowerInvariant()));
    }
}
