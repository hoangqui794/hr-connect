using System;
using System.Security.Cryptography;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Services.Agreements;
using Xunit;

namespace HRConnect.UnitTests.Services.Agreements;

public class AgreementPdfRendererTests
{
    private static (ServiceAgreement Agreement, Job Job, Company Company) BuildFixture(DateTime createdAt, DateTime? signedAt)
    {
        var company = new Company
        {
            CompanyId = Guid.NewGuid(),
            CompanyName = "Tech Corp",
            TaxCode = "0312345678",
            Address = "TP. Hồ Chí Minh",
        };
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            CompanyId = company.CompanyId,
            Title = "Senior Backend Engineer",
            Quantity = 2,
            AgreementReference = "HRC-HD-202611-ABCD",
            Company = company,
        };
        var agreement = new ServiceAgreement
        {
            ServiceAgreementId = Guid.NewGuid(),
            JobId = job.JobId,
            CompanyId = company.CompanyId,
            Version = 1,
            ServiceTypeCode = "HEADHUNT_COD",
            Status = signedAt.HasValue ? "SIGNED" : "SENT_TO_CLIENT",
            FeeMultiplier = 1.5m,
            WarrantyDays = 30,
            PaymentDueDays = 20,
            VerificationCode = "HRC-VERIFY-01",
            CompanyNameSnapshot = company.CompanyName,
            CompanyTaxCodeSnapshot = company.TaxCode,
            CompanyAddressSnapshot = company.Address,
            CreatedAt = createdAt,
            SignedAt = signedAt,
            Job = job,
        };
        return (agreement, job, company);
    }

    [Fact]
    public async Task RenderAgreementPdf_CalledTwiceForSameAgreement_ShouldProduceIdenticalBytesAndHash()
    {
        var renderer = new AgreementPdfRenderer();
        var createdAt = new DateTime(2026, 11, 10, 8, 30, 0, DateTimeKind.Utc);
        var signedAt = new DateTime(2026, 11, 11, 18, 0, 0, DateTimeKind.Utc); // 2026-11-12 01:00 VN
        var (agreement, job, company) = BuildFixture(createdAt, signedAt);

        var firstPdf = renderer.RenderAgreementPdf(agreement, job, company, isSigned: true);
        await Task.Delay(1100);
        var secondPdf = renderer.RenderAgreementPdf(agreement, job, company, isSigned: true);

        firstPdf.Should().NotBeEmpty();
        secondPdf.Should().Equal(firstPdf);
        SHA256.HashData(secondPdf).Should().Equal(SHA256.HashData(firstPdf));
    }

    [Fact]
    public void RenderAgreementPdf_WhenSignedAtChanges_ShouldReflectSignedAtOverCreatedAt()
    {
        var renderer = new AgreementPdfRenderer();
        var createdAt = new DateTime(2026, 11, 10, 8, 30, 0, DateTimeKind.Utc);
        var (unsignedAgreement, job, company) = BuildFixture(createdAt, signedAt: null);
        var (signedAgreement, _, _) = BuildFixture(createdAt, signedAt: new DateTime(2026, 11, 16, 18, 0, 0, DateTimeKind.Utc));
        signedAgreement.ServiceAgreementId = unsignedAgreement.ServiceAgreementId;

        var firstUnsigned = renderer.RenderAgreementPdf(unsignedAgreement, job, company, isSigned: false);
        var secondUnsigned = renderer.RenderAgreementPdf(unsignedAgreement, job, company, isSigned: false);
        var signedPdf = renderer.RenderAgreementPdf(signedAgreement, job, company, isSigned: true);

        secondUnsigned.Should().Equal(firstUnsigned);
        signedPdf.Should().NotEqual(firstUnsigned);
    }
}
