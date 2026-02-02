using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using VehicleTracker.Api.Data;
using VehicleTracker.Api.Hubs;
using VehicleTracker.Api.Models;

namespace VehicleTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LiveTrackingController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IHubContext<EventsHub> _hubContext;

    public LiveTrackingController(AppDbContext context, IHubContext<EventsHub> hubContext)
    {
        _context = context;
        _hubContext = hubContext;
    }

    /// <summary>
    /// Update telemetry data for a vehicle (POST /api/livetracking)
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> UpdateTelemetry([FromBody] TelemetryUpdateRequest request)
    {
        var realTimeData = await _context.RealTimeData
            .FirstOrDefaultAsync(r => r.VehicleId == request.VehicleId);

        if (realTimeData == null)
        {
            realTimeData = new RealTimeData { VehicleId = request.VehicleId };
            _context.RealTimeData.Add(realTimeData);
        }

        realTimeData.CurrentLocation = new Point(request.Longitude, request.Latitude) { SRID = 4326 };
        realTimeData.CurrentSpeed = request.Speed;
        realTimeData.CurrentFuel = request.Fuel;
        realTimeData.VehicleStatusId = request.VehicleStatusId;

        // Also log to history
        var historyEntry = new LocationHistory
        {
            VehicleId = request.VehicleId,
            Timestamp = request.Timestamp ?? DateTime.UtcNow,
            Location = realTimeData.CurrentLocation,
            Speed = request.Speed,
            Fuel = request.Fuel
        };
        _context.LocationHistory.Add(historyEntry);

        await _context.SaveChangesAsync();

        // Broadcast real-time location update via SignalR
        var updatePayload = new RealTimeDataResponse
        {
            VehicleId = realTimeData.VehicleId,
            VehicleStatusId = realTimeData.VehicleStatusId,
            Latitude = realTimeData.CurrentLocation?.Y,
            Longitude = realTimeData.CurrentLocation?.X,
            CurrentSpeed = realTimeData.CurrentSpeed,
            CurrentFuel = realTimeData.CurrentFuel
        };
        
        await _hubContext.Clients.All.SendAsync("ReceiveLocationUpdate", updatePayload);

        // Return the updated data in RealTimeDataResponse format
        return Ok(updatePayload);
    }

    /// <summary>
    /// Get all vehicles with their current locations (GET /api/livetracking)
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAllVehicleLocations()
    {
        var vehicles = await _context.RealTimeData
            .Select(r => new RealTimeDataResponse
            {
                VehicleId = r.VehicleId,
                VehicleStatusId = r.VehicleStatusId,
                Latitude = r.CurrentLocation != null ? r.CurrentLocation.Y : null,
                Longitude = r.CurrentLocation != null ? r.CurrentLocation.X : null,
                CurrentSpeed = r.CurrentSpeed,
                CurrentFuel = r.CurrentFuel
            })
            .ToListAsync();

        return Ok(vehicles);
    }

    /// <summary>
    /// Get live data for a specific vehicle (GET /api/livetracking/{vehicleId})
    /// </summary>
    [HttpGet("{vehicleId}")]
    public async Task<IActionResult> GetVehicleLiveData(int vehicleId)
    {
        var data = await _context.RealTimeData
            .Where(r => r.VehicleId == vehicleId)
            .Select(r => new RealTimeDataResponse
            {
                VehicleId = r.VehicleId,
                VehicleStatusId = r.VehicleStatusId,
                Latitude = r.CurrentLocation != null ? r.CurrentLocation.Y : null,
                Longitude = r.CurrentLocation != null ? r.CurrentLocation.X : null,
                CurrentSpeed = r.CurrentSpeed,
                CurrentFuel = r.CurrentFuel
            })
            .FirstOrDefaultAsync();

        if (data == null)
            return NotFound(new { message = "Vehicle not found or no live data available" });

        return Ok(data);
    }
}

public class TelemetryUpdateRequest
{
    public int VehicleId { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public decimal? Speed { get; set; }
    public decimal? Fuel { get; set; }
    public Guid? VehicleStatusId { get; set; }
    /// <summary>
    /// Optional timestamp for historical/offline data sync. If null, uses current UTC time.
    /// </summary>
    public DateTime? Timestamp { get; set; }
}

public class RealTimeDataResponse
{
    public int VehicleId { get; set; }
    public Guid? VehicleStatusId { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public decimal? CurrentSpeed { get; set; }
    public decimal? CurrentFuel { get; set; }
}
