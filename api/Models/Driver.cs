using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace VehicleTracker.Api.Models;

[Table("driver")]
public class Driver
{
    [Key]
    [Column("driver_id")]
    public int DriverId { get; set; }

    [Required]
    [Column("first_name")]
    [MaxLength(50)]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    [Column("last_name")]
    [MaxLength(50)]
    public string LastName { get; set; } = string.Empty;

    [Required]
    [Column("license_number")]
    [MaxLength(20)]
    public string LicenseNumber { get; set; } = string.Empty;

    [Column("phone_number")]
    [MaxLength(15)]
    public string? PhoneNumber { get; set; }

    [Column("email")]
    [MaxLength(100)]
    public string? Email { get; set; }

    // Navigation property
    [JsonIgnore]
    public ICollection<Vehicle> Vehicles { get; set; } = new List<Vehicle>();
}
