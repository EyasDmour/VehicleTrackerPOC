using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace VehicleTracker.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:postgis", ",,");

            migrationBuilder.CreateTable(
                name: "driver",
                columns: table => new
                {
                    driver_id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    first_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    last_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    license_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    phone_number = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driver", x => x.driver_id);
                });

            migrationBuilder.CreateTable(
                name: "incident_status",
                columns: table => new
                {
                    incident_status_id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    status_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_incident_status", x => x.incident_status_id);
                });

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

            migrationBuilder.CreateTable(
                name: "vehicle_status",
                columns: table => new
                {
                    vehicle_status_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_vehicle_status", x => x.vehicle_status_id);
                });

            migrationBuilder.CreateTable(
                name: "vehicle",
                columns: table => new
                {
                    vehicle_id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    driver_id = table.Column<int>(type: "integer", nullable: false),
                    plate_number = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false),
                    model = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    make = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    color = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_vehicle", x => x.vehicle_id);
                    table.ForeignKey(
                        name: "FK_vehicle_driver_driver_id",
                        column: x => x.driver_id,
                        principalTable: "driver",
                        principalColumn: "driver_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "incident",
                columns: table => new
                {
                    incident_id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    incident_type_id = table.Column<int>(type: "integer", nullable: true),
                    incident_status_id = table.Column<int>(type: "integer", nullable: true),
                    assigned_to = table.Column<int>(type: "integer", nullable: true),
                    location = table.Column<Point>(type: "geometry(Point,4326)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_incident", x => x.incident_id);
                    table.ForeignKey(
                        name: "FK_incident_incident_status_incident_status_id",
                        column: x => x.incident_status_id,
                        principalTable: "incident_status",
                        principalColumn: "incident_status_id");
                    table.ForeignKey(
                        name: "FK_incident_incident_type_incident_type_id",
                        column: x => x.incident_type_id,
                        principalTable: "incident_type",
                        principalColumn: "incident_type_id");
                    table.ForeignKey(
                        name: "FK_incident_vehicle_assigned_to",
                        column: x => x.assigned_to,
                        principalTable: "vehicle",
                        principalColumn: "vehicle_id");
                });

            migrationBuilder.CreateTable(
                name: "real_time_data",
                columns: table => new
                {
                    vehicle_id = table.Column<int>(type: "integer", nullable: false),
                    vehicle_status_id = table.Column<Guid>(type: "uuid", nullable: true),
                    current_location = table.Column<Point>(type: "geometry(Point,4326)", nullable: true),
                    current_fuel = table.Column<decimal>(type: "numeric", nullable: true),
                    current_speed = table.Column<decimal>(type: "numeric", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_real_time_data", x => x.vehicle_id);
                    table.ForeignKey(
                        name: "FK_real_time_data_vehicle_status_vehicle_status_id",
                        column: x => x.vehicle_status_id,
                        principalTable: "vehicle_status",
                        principalColumn: "vehicle_status_id");
                    table.ForeignKey(
                        name: "FK_real_time_data_vehicle_vehicle_id",
                        column: x => x.vehicle_id,
                        principalTable: "vehicle",
                        principalColumn: "vehicle_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "location_history",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    vehicle_id = table.Column<int>(type: "integer", nullable: false),
                    timestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    location = table.Column<Point>(type: "geometry(Point,4326)", nullable: true),
                    speed = table.Column<decimal>(type: "numeric", nullable: true),
                    fuel = table.Column<decimal>(type: "numeric", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_location_history", x => x.id);
                    table.ForeignKey(
                        name: "FK_location_history_real_time_data_vehicle_id",
                        column: x => x.vehicle_id,
                        principalTable: "real_time_data",
                        principalColumn: "vehicle_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_driver_license_number",
                table: "driver",
                column: "license_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_incident_assigned_to",
                table: "incident",
                column: "assigned_to");

            migrationBuilder.CreateIndex(
                name: "IX_incident_incident_status_id",
                table: "incident",
                column: "incident_status_id");

            migrationBuilder.CreateIndex(
                name: "IX_incident_incident_type_id",
                table: "incident",
                column: "incident_type_id");

            migrationBuilder.CreateIndex(
                name: "IX_location_history_vehicle_id",
                table: "location_history",
                column: "vehicle_id");

            migrationBuilder.CreateIndex(
                name: "IX_real_time_data_vehicle_status_id",
                table: "real_time_data",
                column: "vehicle_status_id");

            migrationBuilder.CreateIndex(
                name: "IX_vehicle_driver_id",
                table: "vehicle",
                column: "driver_id");

            migrationBuilder.CreateIndex(
                name: "IX_vehicle_plate_number",
                table: "vehicle",
                column: "plate_number",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "incident");

            migrationBuilder.DropTable(
                name: "location_history");

            migrationBuilder.DropTable(
                name: "incident_status");

            migrationBuilder.DropTable(
                name: "incident_type");

            migrationBuilder.DropTable(
                name: "real_time_data");

            migrationBuilder.DropTable(
                name: "vehicle_status");

            migrationBuilder.DropTable(
                name: "vehicle");

            migrationBuilder.DropTable(
                name: "driver");
        }
    }
}
