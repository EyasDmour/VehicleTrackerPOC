using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace VehicleTracker.Api.Models;

[Table("vehicle")]
public class Vehicle
{
    [Key]
    [Column("vehicle_id")]
    public int VehicleId { get; set; }

    [Column("driver_id")]
    public int? DriverId { get; set; }

    [Required]
    [Column("plate_number")]
    [MaxLength(15)]
    public string PlateNumber { get; set; } = string.Empty;

    [Required]
    [Column("model")]
    [MaxLength(50)]
    public string Model { get; set; } = string.Empty;

    [Required]
    [Column("make")]
    [MaxLength(50)]
    public string Make { get; set; } = string.Empty;

    [Required]
    [Column("color")]
    [MaxLength(30)]
    public string Color { get; set; } = string.Empty;

    // Navigation properties
    [ForeignKey("DriverId")]
    public Driver? Driver { get; set; }

    [JsonIgnore]
    public ICollection<Incident> AssignedIncidents { get; set; } = new List<Incident>();
}
