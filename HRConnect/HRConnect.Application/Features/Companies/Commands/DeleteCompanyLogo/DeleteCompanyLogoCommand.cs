using System.Text.Json.Serialization;
using HRConnect.Application.Features.Companies.Commands.UploadCompanyLogo;
using MediatR;

namespace HRConnect.Application.Features.Companies.Commands.DeleteCompanyLogo;

public sealed class DeleteCompanyLogoCommand : IRequest<CompanyLogoResponse>
{
    [JsonIgnore] public Guid UserId { get; set; }
}
