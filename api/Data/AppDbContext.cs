using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using VehicleTracker.Api.Models;

namespace VehicleTracker.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<Driver> Drivers { get; set; }
    public DbSet<Vehicle> Vehicles { get; set; }
    public DbSet<VehicleStatus> VehicleStatuses { get; set; }
    public DbSet<Incident> Incidents { get; set; }
    public DbSet<IncidentStatus> IncidentStatuses { get; set; }
    public DbSet<IncidentPriority> IncidentPriorities { get; set; }
    public DbSet<RealTimeData> RealTimeData { get; set; }
    public DbSet<LocationHistory> LocationHistory { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User unique constraints
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Username)
            .IsUnique();
        
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        // Configure unique constraints
        modelBuilder.Entity<Driver>()
            .HasIndex(d => d.LicenseNumber)
            .IsUnique();

        modelBuilder.Entity<Vehicle>()
            .HasIndex(v => v.PlateNumber)
            .IsUnique();

        // RealTimeData uses VehicleId as PK (1:1 with Vehicle)
        modelBuilder.Entity<RealTimeData>()
            .HasOne(r => r.Vehicle)
            .WithOne()
            .HasForeignKey<RealTimeData>(r => r.VehicleId);

        // LocationHistory -> RealTimeData relationship
        modelBuilder.Entity<LocationHistory>()
            .HasOne(l => l.RealTimeData)
            .WithMany(r => r.LocationHistory)
            .HasForeignKey(l => l.VehicleId);

        // ===== SEED DATA =====
        SeedData(modelBuilder);
    }

    private static void SeedData(ModelBuilder modelBuilder)
    {
        // Seed Admin User (password: "admin123")
        modelBuilder.Entity<User>().HasData(
            new User
            {
                UserId = 1,
                Username = "admin",
                Email = "admin@vehicletracker.com",
                PasswordHash = HashPassword("admin123"),
                FullName = "Admin User",
                Role = "Admin",
                CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                IsActive = true
            }
        );

        // Seed Incident Statuses (Requested: Open, Assigned, Closed)
        modelBuilder.Entity<IncidentStatus>().HasData(
            new IncidentStatus { IncidentStatusId = 1, StatusName = "Open", RequiresVehicle = false },
            new IncidentStatus { IncidentStatusId = 2, StatusName = "Assigned", RequiresVehicle = true },
            new IncidentStatus { IncidentStatusId = 3, StatusName = "Closed", RequiresVehicle = false }
        );

        // Seed Incident Priorities (Requested: Low, Medium, High)
        modelBuilder.Entity<IncidentPriority>().HasData(
            new IncidentPriority { IncidentPriorityId = 1, PriorityName = "Low" },
            new IncidentPriority { IncidentPriorityId = 2, PriorityName = "Medium" },
            new IncidentPriority { IncidentPriorityId = 3, PriorityName = "High" }
        );
    }

    private static string HashPassword(string password)
    {
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
        return Convert.ToBase64String(bytes);
    }
}
