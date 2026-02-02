using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace VehicleTracker.Api.Models;

[Table("vehicle_status")]
public class VehicleStatus
{
    [Key]
    [Column("vehicle_status_id")]
    public Guid VehicleStatusId { get; set; }

    [Required]
    [Column("status")]
    [MaxLength(50)]
    public string Status { get; set; } = string.Empty;
}
