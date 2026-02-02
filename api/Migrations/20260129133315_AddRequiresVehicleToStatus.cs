using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VehicleTracker.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRequiresVehicleToStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "requires_vehicle",
                table: "incident_status",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.UpdateData(
                table: "incident_status",
                keyColumn: "incident_status_id",
                keyValue: 1,
                column: "requires_vehicle",
                value: false);

            migrationBuilder.UpdateData(
                table: "incident_status",
                keyColumn: "incident_status_id",
                keyValue: 2,
                column: "requires_vehicle",
                value: true);

            migrationBuilder.UpdateData(
                table: "incident_status",
                keyColumn: "incident_status_id",
                keyValue: 3,
                column: "requires_vehicle",
                value: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "requires_vehicle",
                table: "incident_status");
        }
    }
}
