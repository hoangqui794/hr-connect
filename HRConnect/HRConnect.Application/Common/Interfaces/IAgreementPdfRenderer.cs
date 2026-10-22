using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces;

public interface IAgreementPdfRenderer
{
    byte[] RenderAgreementPdf(
        ServiceAgreement agreement,
        Job job,
        Company company,
        bool isSigned);
}
