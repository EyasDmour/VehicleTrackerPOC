using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using VehicleTracker.Api.Data;
using VehicleTracker.Api.Models;

namespace VehicleTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class IncidentsController : ControllerBase
{
    private readonly AppDbContext _context;

    public IncidentsController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Report a new incident
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> ReportIncident([FromBody] IncidentReportRequest request)
    {
        var incident = new Incident
        {
            IncidentStatusId = request.IncidentStatusId ?? 1, // Default to "Open"
            IncidentPriorityId = request.IncidentPriorityId ?? 1, // Default to "Low"
            Title = request.Title,
            Description = request.Description,
            LocationName = request.LocationName,
            Location = new Point(request.Longitude, request.Latitude) { SRID = 4326 },
            CreatedAt = DateTime.UtcNow
        };

        _context.Incidents.Add(incident);
        await _context.SaveChangesAsync();



        return CreatedAtAction(nameof(GetIncident), new { id = incident.IncidentId }, new
        {
            incident.IncidentId,
            message = "Incident reported successfully"
        });
    }

    /// <summary>
    /// Get incident by ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetIncident(int id)
    {
        var incident = await _context.Incidents
            .Include(i => i.IncidentStatus)
            .Include(i => i.IncidentPriority)
            .Include(i => i.AssignedVehicle)
            .Where(i => i.IncidentId == id)
            .Select(i => new
            {
                i.IncidentId,
                i.IncidentStatusId,
                i.IncidentPriorityId,
                i.AssignedTo,
                i.Title,
                i.Description,
                i.LocationName,
                Latitude = i.Location != null ? i.Location.Y : (double?)null,
                Longitude = i.Location != null ? i.Location.X : (double?)null,
                i.CreatedAt,
                i.UpdatedAt,
                i.ResolvedAt,
                IncidentStatusName = i.IncidentStatus != null ? i.IncidentStatus.StatusName : null,
                IncidentPriorityName = i.IncidentPriority != null ? i.IncidentPriority.PriorityName : null,
                AssignedVehiclePlate = i.AssignedVehicle != null ? i.AssignedVehicle.PlateNumber : null,
                AssignedVehicleMake = i.AssignedVehicle != null ? i.AssignedVehicle.Make : null,
                AssignedVehicleModel = i.AssignedVehicle != null ? i.AssignedVehicle.Model : null
            })
            .FirstOrDefaultAsync();

        if (incident == null)
            return NotFound(new { message = "Incident not found" });

        return Ok(incident);
    }

    /// <summary>
    /// Find nearest vehicles to an incident location
    /// </summary>
    [HttpGet("{id}/nearest-vehicles")]
    public async Task<IActionResult> GetNearestVehicles(int id, [FromQuery] int limit = 5)
    {
        var incident = await _context.Incidents.FindAsync(id);
        if (incident == null)
            return NotFound(new { message = "Incident not found" });

        if (incident.Location == null)
            return BadRequest(new { message = "Incident has no location" });

        var nearestVehicles = await _context.RealTimeData
            .Include(r => r.Vehicle)
            .Where(r => r.CurrentLocation != null)
            .OrderBy(r => r.CurrentLocation!.Distance(incident.Location))
            .Take(limit)
            .Select(r => new
            {
                r.VehicleId,
                r.Vehicle!.PlateNumber,
                r.Vehicle.Make,
                r.Vehicle.Model,
                Latitude = r.CurrentLocation!.Y,
                Longitude = r.CurrentLocation!.X,
                DistanceMeters = r.CurrentLocation.Distance(incident.Location) * 111320 // Approximate conversion to meters
            })
            .ToListAsync();

        return Ok(nearestVehicles);
    }

    /// <summary>
    /// Update an incident
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateIncident(int id, [FromBody] IncidentUpdateRequest request)
    {
        var incident = await _context.Incidents.FindAsync(id);
        if (incident == null)
            return NotFound(new { message = "Incident not found" });

        // Update fields if provided
        if (request.IncidentStatusId.HasValue)
            incident.IncidentStatusId = request.IncidentStatusId.Value;
        
        if (request.IncidentPriorityId.HasValue)
            incident.IncidentPriorityId = request.IncidentPriorityId.Value;
        
        if (request.Title != null)
            incident.Title = request.Title;
        
        if (request.Description != null)
            incident.Description = request.Description;
        
        if (request.LocationName != null)
            incident.LocationName = request.LocationName;
        
        if (request.Latitude.HasValue && request.Longitude.HasValue)
            incident.Location = new Point(request.Longitude.Value, request.Latitude.Value) { SRID = 4326 };
        
        if (request.AssignedTo.HasValue)
            incident.AssignedTo = request.AssignedTo.Value == 0 ? null : request.AssignedTo.Value;

        incident.UpdatedAt = DateTime.UtcNow;

        // If status is "Closed", set ResolvedAt and unassign driver from vehicle
        if (request.IncidentStatusId == 3)
        {
            if (incident.ResolvedAt == null)
                incident.ResolvedAt = DateTime.UtcNow;

            // Unassign driver from the vehicle used in this incident
            if (incident.AssignedTo.HasValue)
            {
                var vehicle = await _context.Vehicles.FindAsync(incident.AssignedTo.Value);
                if (vehicle != null)
                {
                    vehicle.DriverId = null;
                    // Vehicle status update is handled by triggers or next status update
                }
            }
        }

        await _context.SaveChangesAsync();



        return Ok(new { message = "Incident updated successfully", incidentId = id });
    }

    /// <summary>
    /// Assign an incident to a vehicle (and notify)
    /// </summary>
    [HttpPost("{id}/assign")]
    public async Task<IActionResult> AssignIncident(int id, [FromBody] AssignIncidentRequest request)
    {
        var incident = await _context.Incidents.FindAsync(id);
        if (incident == null)
            return NotFound(new { message = "Incident not found" });

        // Prevent dispatch to closed incidents
        if (incident.IncidentStatusId == 3)
            return BadRequest(new { message = "Cannot dispatch to a closed incident" });

        var vehicle = await _context.Vehicles.FindAsync(request.VehicleId);
        if (vehicle == null)
            return NotFound(new { message = "Vehicle not found" });

        incident.AssignedTo = request.VehicleId;

        // Update incident status if provided
        if (request.StatusId.HasValue)
            incident.IncidentStatusId = request.StatusId.Value;

        await _context.SaveChangesAsync();



        return Ok(new
        {
            message = "Incident assigned successfully",
            incidentId = id,
            assignedVehicleId = request.VehicleId,
            assignedVehiclePlate = vehicle.PlateNumber,
            notificationSent = true
        });
    }

    /// <summary>
    /// Get all incidents
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAllIncidents([FromQuery] int? statusId = null)
    {
        var query = _context.Incidents
            .Include(i => i.IncidentStatus)
            .Include(i => i.IncidentPriority)
            .Include(i => i.AssignedVehicle)
            .AsQueryable();

        if (statusId.HasValue)
            query = query.Where(i => i.IncidentStatusId == statusId.Value);

        var incidents = await query
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new
            {
                i.IncidentId,
                i.IncidentStatusId,
                i.IncidentPriorityId,
                i.AssignedTo,
                i.Title,
                i.Description,
                i.LocationName,
                Latitude = i.Location != null ? i.Location.Y : (double?)null,
                Longitude = i.Location != null ? i.Location.X : (double?)null,
                i.CreatedAt,
                i.UpdatedAt,
                i.ResolvedAt,
                IncidentStatusName = i.IncidentStatus != null ? i.IncidentStatus.StatusName : null,
                IncidentPriorityName = i.IncidentPriority != null ? i.IncidentPriority.PriorityName : null,
                AssignedVehiclePlate = i.AssignedVehicle != null ? i.AssignedVehicle.PlateNumber : null,
                AssignedVehicleMake = i.AssignedVehicle != null ? i.AssignedVehicle.Make : null,
                AssignedVehicleModel = i.AssignedVehicle != null ? i.AssignedVehicle.Model : null
            })
            .ToListAsync();

        return Ok(incidents);
    }
}

public class IncidentReportRequest
{
    public int? IncidentStatusId { get; set; }
    public int? IncidentPriorityId { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? LocationName { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
}

public class AssignIncidentRequest
{
    public int VehicleId { get; set; }
    public int? StatusId { get; set; }
}

public class IncidentUpdateRequest
{
    public int? IncidentStatusId { get; set; }
    public int? IncidentPriorityId { get; set; }
    public int? AssignedTo { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? LocationName { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
}
