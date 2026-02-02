using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;
using NetTopologySuite.Geometries;

namespace VehicleTracker.Api.Models;

[Table("location_history")]
public class LocationHistory
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("vehicle_id")]
    public int VehicleId { get; set; }

    [Column("timestamp")]
    public DateTime Timestamp { get; set; }

    [Column("location", TypeName = "geometry(Point,4326)")]
    [JsonIgnore]
    public Point? Location { get; set; }

    // Helper properties for JSON serialization
    [NotMapped]
    public double? Latitude => Location?.Y;
    
    [NotMapped]
    public double? Longitude => Location?.X;

    [Column("speed")]
    public decimal? Speed { get; set; }

    [Column("fuel")]
    [Range(0, 100)]
    public decimal? Fuel { get; set; }

    // Navigation properties
    [ForeignKey("VehicleId")]
    [JsonIgnore]
    public RealTimeData? RealTimeData { get; set; }
}
