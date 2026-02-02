using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace VehicleTracker.Api.Migrations
{
    /// <inheritdoc />
    public partial class SeedMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "incident_priority",
                columns: new[] { "incident_priority_id", "priority_name" },
                values: new object[,]
                {
                    { 1, "Low" },
                    { 2, "Medium" },
                    { 3, "High" }
                });

            migrationBuilder.InsertData(
                table: "incident_status",
                columns: new[] { "incident_status_id", "status_name" },
                values: new object[,]
                {
                    { 1, "Open" },
                    { 2, "Assigned" },
                    { 3, "Closed" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "incident_priority",
                keyColumn: "incident_priority_id",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "incident_priority",
                keyColumn: "incident_priority_id",
                keyValue: 2);

            migrationBuilder.DeleteData(
                table: "incident_priority",
                keyColumn: "incident_priority_id",
                keyValue: 3);

            migrationBuilder.DeleteData(
                table: "incident_status",
                keyColumn: "incident_status_id",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "incident_status",
                keyColumn: "incident_status_id",
                keyValue: 2);

            migrationBuilder.DeleteData(
                table: "incident_status",
                keyColumn: "incident_status_id",
                keyValue: 3);
        }
    }
}
