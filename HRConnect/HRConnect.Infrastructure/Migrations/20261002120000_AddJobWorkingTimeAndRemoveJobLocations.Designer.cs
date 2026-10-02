using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261002120000_AddJobWorkingTimeAndRemoveJobLocations")]
partial class AddJobWorkingTimeAndRemoveJobLocations
{
}
