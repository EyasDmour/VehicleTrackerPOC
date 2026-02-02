using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace VehicleTracker.Api.Migrations
{
    /// <inheritdoc />
    public partial class RemoveIncidentType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_incident_incident_type_incident_type_id",
                table: "incident");

            migrationBuilder.DropTable(
                name: "incident_type");

            migrationBuilder.DropIndex(
                name: "IX_incident_incident_type_id",
                table: "incident");

            migrationBuilder.DropColumn(
                name: "incident_type_id",
                table: "incident");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "incident_type_id",
                table: "incident",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "incident_type",
                columns: table => new
                {
                    incident_type_id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    type_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_incident_type", x => x.incident_type_id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_incident_incident_type_id",
                table: "incident",
                column: "incident_type_id");

            migrationBuilder.AddForeignKey(
                name: "FK_incident_incident_type_incident_type_id",
                table: "incident",
                column: "incident_type_id",
                principalTable: "incident_type",
                principalColumn: "incident_type_id");
        }
    }
}
