using Microsoft.AspNetCore.SignalR;

namespace VehicleTracker.Api.Hubs;

/// <summary>
/// SignalR Hub for real-time events (vehicle location updates, new incidents, etc.)
/// </summary>
public class EventsHub : Hub
{
    /// <summary>
    /// Called when a client connects
    /// </summary>
    public override async Task OnConnectedAsync()
    {
        await base.OnConnectedAsync();
        Console.WriteLine($"Client connected: {Context.ConnectionId}");
    }

    /// <summary>
    /// Called when a client disconnects
    /// </summary>
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await base.OnDisconnectedAsync(exception);
        Console.WriteLine($"Client disconnected: {Context.ConnectionId}");
    }

    /// <summary>
    /// Subscribe to updates for a specific vehicle
    /// </summary>
    public async Task SubscribeToVehicle(int vehicleId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"vehicle-{vehicleId}");
    }

    /// <summary>
    /// Unsubscribe from updates for a specific vehicle
    /// </summary>
    public async Task UnsubscribeFromVehicle(int vehicleId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"vehicle-{vehicleId}");
    }
}
