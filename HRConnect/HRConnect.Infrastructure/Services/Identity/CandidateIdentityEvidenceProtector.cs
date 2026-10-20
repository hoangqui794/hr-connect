using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using Microsoft.Extensions.Options;

namespace HRConnect.Infrastructure.Services.Identity;

public sealed class CandidateIdentityEvidenceProtector : ICandidateIdentityEvidenceProtector
{
    private readonly CandidateIdentityEvidenceSettings _settings;

    public CandidateIdentityEvidenceProtector(IOptions<CandidateIdentityEvidenceSettings> settings)
    {
        _settings = settings.Value;
    }

    public CandidateIdentityEvidence Protect(
        string fullName,
        string? normalizedEmail,
        string? normalizedPhone)
    {
        if (!_settings.Enabled)
        {
            return new CandidateIdentityEvidence(false, null, null, null, null);
        }

        if (!_settings.Keys.TryGetValue(_settings.ActiveKeyVersion, out var encodedKey) ||
            string.IsNullOrWhiteSpace(encodedKey))
        {
            throw new InvalidOperationException(
                $"Candidate identity evidence key '{_settings.ActiveKeyVersion}' is not configured.");
        }

        byte[] key;
        try
        {
            key = Convert.FromBase64String(encodedKey);
        }
        catch (FormatException exception)
        {
            throw new InvalidOperationException("Candidate identity evidence HMAC key must be valid Base64.", exception);
        }

        if (key.Length < 32)
        {
            throw new InvalidOperationException("Candidate identity evidence HMAC key must contain at least 32 bytes.");
        }

        var normalizedName = NormalizeName(fullName);
        return new CandidateIdentityEvidence(
            true,
            ProtectValue(key, normalizedName),
            ProtectOptionalValue(key, normalizedEmail),
            ProtectOptionalValue(key, normalizedPhone),
            _settings.ActiveKeyVersion);
    }

    private static string? ProtectOptionalValue(byte[] key, string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : ProtectValue(key, value.Trim());
    }

    private static string ProtectValue(byte[] key, string value)
    {
        return Convert.ToHexString(HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(value)))
            .ToLowerInvariant();
    }

    private static string NormalizeName(string value)
    {
        var decomposed = value.Trim().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);
        var previousWasSpace = false;

        foreach (var character in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            if (char.IsWhiteSpace(character))
            {
                if (builder.Length > 0 && !previousWasSpace)
                {
                    builder.Append(' ');
                }
                previousWasSpace = true;
                continue;
            }

            builder.Append(char.ToUpperInvariant(character));
            previousWasSpace = false;
        }

        return builder.ToString().TrimEnd().Normalize(NormalizationForm.FormC);
    }
}
