using HRConnect.Application.Common.Models;

namespace HRConnect.Application.Common.Interfaces;

public interface ICandidateIdentityEvidenceProtector
{
    CandidateIdentityEvidence Protect(string fullName, string? normalizedEmail, string? normalizedPhone);
}
