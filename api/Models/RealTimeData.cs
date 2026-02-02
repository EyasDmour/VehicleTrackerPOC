using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;
using NetTopologySuite.Geometries;

namespace VehicleTracker.Api.Models;

[Table("real_time_data")]
public class RealTimeData
{
    [Key]
    [Column("vehicle_id")]
    public int VehicleId { get; set; }

    [Column("vehicle_status_id")]
    public Guid? VehicleStatusId { get; set; }

    [Column("current_location", TypeName = "geometry(Point,4326)")]
    [JsonIgnore]
    public Point? CurrentLocation { get; set; }

    // Helper properties for JSON serialization
    [NotMapped]
    public double? Latitude => CurrentLocation?.Y;
    
    [NotMapped]
    public double? Longitude => CurrentLocation?.X;

    [Column("current_fuel")]
    [Range(0, 100)]
    public decimal? CurrentFuel { get; set; }

    [Column("current_speed")]
    public decimal? CurrentSpeed { get; set; }

    // Navigation properties
    [ForeignKey("VehicleId")]
    [JsonIgnore]
    public Vehicle? Vehicle { get; set; }

    [ForeignKey("VehicleStatusId")]
    [JsonIgnore]
    public VehicleStatus? VehicleStatus { get; set; }

    [JsonIgnore]
    public ICollection<LocationHistory> LocationHistory { get; set; } = new List<LocationHistory>();
}
