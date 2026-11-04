using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Application.Features.Offers.Common;
using HRConnect.Application.Features.Offers.Queries.GetOfferAcceptanceImpact;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Offers;

public class GetOfferAcceptanceImpactQueryHandlerTests
{
    private readonly Mock<IOfferRepository> _offers = new();
    private readonly Mock<IPlacementRepository> _placements = new();

    [Fact]
    public async Task Handle_WhenOfferBelongsToAnotherCandidate_ShouldReject()
    {
        var offer = CreateOffer(Guid.NewGuid(), Guid.NewGuid(), OfferStates.Sent);
        _offers.Setup(repository => repository.GetByIdWithApplicationAsync(
                offer.OfferId,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(offer);

        var handler = new GetOfferAcceptanceImpactQueryHandler(_offers.Object, _placements.Object);
        var act = () => handler.Handle(
            new GetOfferAcceptanceImpactQuery(offer.OfferId, Guid.NewGuid()),
            CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task Handle_WhenFullTimeConflictsExist_ShouldReturnImpactAndExplicitActions()
    {
        var candidateId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var target = CreateOffer(candidateId, userId, OfferStates.Sent);
        var accepted = CreateOffer(candidateId, userId, OfferStates.Accepted);
        var pending = CreateOffer(candidateId, userId, OfferStates.Sent);
        var placement = new Placement
        {
            PlacementId = Guid.NewGuid(),
            OfferId = accepted.OfferId,
            ApplicationId = accepted.ApplicationId,
            Status = PlacementStates.Started,
            ActualStartDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Application = accepted.Application
        };

        _offers.Setup(repository => repository.GetByIdWithApplicationAsync(
                target.OfferId,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(target);
        _offers.Setup(repository => repository.GetCandidateOffersForAcceptanceAsync(
                candidateId,
                target.OfferId,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { accepted, pending });
        _placements.Setup(repository => repository.GetActiveFullTimeForCandidateAsync(
                candidateId,
                target.ApplicationId,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(placement);

        var handler = new GetOfferAcceptanceImpactQueryHandler(_offers.Object, _placements.Object);
        var result = await handler.Handle(
            new GetOfferAcceptanceImpactQuery(target.OfferId, userId),
            CancellationToken.None);

        result.IsFullTime.Should().BeTrue();
        result.AcceptedFullTimeOffer?.OfferId.Should().Be(accepted.OfferId);
        result.OtherPendingFullTimeOffers.Should().ContainSingle(item => item.OfferId == pending.OfferId);
        result.ActiveFullTimePlacement?.ApplicationId.Should().Be(accepted.ApplicationId);
        result.AllowedActions.Should().Contain(OfferAcceptanceActions.KeepOtherPendingOffers);
        result.AllowedActions.Should().Contain(OfferAcceptanceActions.WithdrawOtherPendingFullTimeOffers);
        result.AllowedActions.Should().NotContain(OfferAcceptanceActions.ReplaceAcceptedFullTimeOffer);
    }

    [Fact]
    public async Task Handle_WhenTargetIsPartTime_ShouldNotApplyFullTimePlacementConflict()
    {
        var candidateId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var target = CreateOffer(candidateId, userId, OfferStates.Sent, "PART_TIME");
        _offers.Setup(repository => repository.GetByIdWithApplicationAsync(
                target.OfferId,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(target);
        _offers.Setup(repository => repository.GetCandidateOffersForAcceptanceAsync(
                candidateId,
                target.OfferId,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<Offer>());

        var handler = new GetOfferAcceptanceImpactQueryHandler(_offers.Object, _placements.Object);
        var result = await handler.Handle(
            new GetOfferAcceptanceImpactQuery(target.OfferId, userId),
            CancellationToken.None);

        result.IsFullTime.Should().BeFalse();
        result.ActiveFullTimePlacement.Should().BeNull();
        result.AllowedActions.Should().ContainSingle()
            .Which.Should().Be(OfferAcceptanceActions.KeepOtherPendingOffers);
        _placements.Verify(repository => repository.GetActiveFullTimeForCandidateAsync(
            It.IsAny<Guid>(),
            It.IsAny<Guid?>(),
            It.IsAny<CancellationToken>()), Times.Never);
        _offers.Verify(repository => repository.GetCandidateOffersForAcceptanceAsync(
            It.IsAny<Guid>(),
            It.IsAny<Guid>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    private static Offer CreateOffer(
        Guid candidateId,
        Guid userId,
        string status,
        string employmentType = EmploymentTypes.FullTime)
    {
        var application = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = Guid.NewGuid(),
            CandidateId = candidateId,
            Candidate = new Candidate
            {
                CandidateId = candidateId,
                UserId = userId,
                FullName = "Candidate"
            },
            Job = new Job
            {
                JobId = Guid.NewGuid(),
                Title = "Full-time role",
                EmploymentType = employmentType,
                Company = new Company { CompanyId = Guid.NewGuid(), CompanyName = "Company" }
            }
        };

        return new Offer
        {
            OfferId = Guid.NewGuid(),
            ApplicationId = application.ApplicationId,
            OfferVersion = 1,
            Status = status,
            Application = application
        };
    }
}
