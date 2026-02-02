using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace VehicleTracker.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddIncidentPriority : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "priority",
                table: "incident");

            migrationBuilder.AddColumn<int>(
                name: "incident_priority_id",
                table: "incident",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "incident_priority",
                columns: table => new
                {
                    incident_priority_id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    priority_name = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_incident_priority", x => x.incident_priority_id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_incident_incident_priority_id",
                table: "incident",
                column: "incident_priority_id");

            migrationBuilder.AddForeignKey(
                name: "FK_incident_incident_priority_incident_priority_id",
                table: "incident",
                column: "incident_priority_id",
                principalTable: "incident_priority",
                principalColumn: "incident_priority_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_incident_incident_priority_incident_priority_id",
                table: "incident");

            migrationBuilder.DropTable(
                name: "incident_priority");

            migrationBuilder.DropIndex(
                name: "IX_incident_incident_priority_id",
                table: "incident");

            migrationBuilder.DropColumn(
                name: "incident_priority_id",
                table: "incident");

            migrationBuilder.AddColumn<string>(
                name: "priority",
                table: "incident",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");
        }
    }
}
