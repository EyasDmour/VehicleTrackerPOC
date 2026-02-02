using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using VehicleTracker.Api.Data;
using VehicleTracker.Api.Models;

namespace VehicleTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;

    public AuthController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Login with username/email and password
    /// </summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrEmpty(request.Username) || string.IsNullOrEmpty(request.Password))
        {
            return BadRequest(new { message = "Username and password are required" });
        }

        // Find user by username or email
        var user = await _context.Users
            .FirstOrDefaultAsync(u => 
                (u.Username == request.Username || u.Email == request.Username) 
                && u.IsActive);

        if (user == null)
        {
            return Unauthorized(new { message = "Invalid username or password" });
        }

        // Verify password
        var passwordHash = HashPassword(request.Password);
        if (user.PasswordHash != passwordHash)
        {
            return Unauthorized(new { message = "Invalid username or password" });
        }

        // Update last login
        user.LastLogin = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // Return user info (in production, you'd return a JWT token)
        return Ok(new LoginResponse
        {
            UserId = user.UserId,
            Username = user.Username,
            Email = user.Email,
            FullName = user.FullName,
            Role = user.Role,
            Token = GenerateSimpleToken(user) // Simple token for demo
        });
    }

    /// <summary>
    /// Logout (invalidate session/token)
    /// </summary>
    [HttpPost("logout")]
    public IActionResult Logout()
    {
        // In a real app, you'd invalidate the JWT token or clear the session
        return Ok(new { message = "Logged out successfully" });
    }

    /// <summary>
    /// Get current user info
    /// </summary>
    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser([FromHeader(Name = "Authorization")] string? authorization)
    {
        if (string.IsNullOrEmpty(authorization))
        {
            return Unauthorized(new { message = "No authorization token provided" });
        }

        // Extract user ID from simple token (format: "Bearer userId:timestamp:hash")
        var userId = ExtractUserIdFromToken(authorization);
        if (userId == null)
        {
            return Unauthorized(new { message = "Invalid token" });
        }

        var user = await _context.Users
            .Where(u => u.UserId == userId && u.IsActive)
            .Select(u => new
            {
                u.UserId,
                u.Username,
                u.Email,
                u.FullName,
                u.Role,
                u.CreatedAt,
                u.LastLogin
            })
            .FirstOrDefaultAsync();

        if (user == null)
        {
            return Unauthorized(new { message = "User not found" });
        }

        return Ok(user);
    }

    /// <summary>
    /// Register a new user (admin only in production)
    /// </summary>
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        // Validate
        if (string.IsNullOrEmpty(request.Username) || 
            string.IsNullOrEmpty(request.Email) || 
            string.IsNullOrEmpty(request.Password))
        {
            return BadRequest(new { message = "Username, email, and password are required" });
        }

        // Check if username or email already exists
        var exists = await _context.Users
            .AnyAsync(u => u.Username == request.Username || u.Email == request.Email);

        if (exists)
        {
            return Conflict(new { message = "Username or email already exists" });
        }

        var user = new User
        {
            Username = request.Username,
            Email = request.Email,
            PasswordHash = HashPassword(request.Password),
            FullName = request.FullName ?? request.Username,
            Role = request.Role ?? "User",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetCurrentUser), new
        {
            user.UserId,
            user.Username,
            user.Email,
            user.FullName,
            user.Role,
            message = "User registered successfully"
        });
    }

    /// <summary>
    /// Change password
    /// </summary>
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(
        [FromHeader(Name = "Authorization")] string? authorization,
        [FromBody] ChangePasswordRequest request)
    {
        var userId = ExtractUserIdFromToken(authorization);
        if (userId == null)
        {
            return Unauthorized(new { message = "Invalid token" });
        }

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        // Verify current password
        if (user.PasswordHash != HashPassword(request.CurrentPassword))
        {
            return BadRequest(new { message = "Current password is incorrect" });
        }

        // Update password
        user.PasswordHash = HashPassword(request.NewPassword);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Password changed successfully" });
    }

    /// <summary>
    /// Get all users (admin only)
    /// </summary>
    [HttpGet("users")]
    public async Task<IActionResult> GetAllUsers()
    {
        var users = await _context.Users
            .Select(u => new
            {
                u.UserId,
                u.Username,
                u.Email,
                u.FullName,
                u.Role,
                u.IsActive,
                u.CreatedAt,
                u.LastLogin
            })
            .OrderBy(u => u.Username)
            .ToListAsync();

        return Ok(users);
    }

    /// <summary>
    /// Get a single user by ID
    /// </summary>
    [HttpGet("users/{id}")]
    public async Task<IActionResult> GetUser(int id)
    {
        var user = await _context.Users
            .Where(u => u.UserId == id)
            .Select(u => new
            {
                u.UserId,
                u.Username,
                u.Email,
                u.FullName,
                u.Role,
                u.IsActive,
                u.CreatedAt,
                u.LastLogin
            })
            .FirstOrDefaultAsync();

        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        return Ok(user);
    }

    /// <summary>
    /// Update a user
    /// </summary>
    [HttpPut("users/{id}")]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserRequest request)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        // Check for duplicate username/email
        var duplicate = await _context.Users
            .AnyAsync(u => u.UserId != id && 
                (u.Username == request.Username || u.Email == request.Email));

        if (duplicate)
        {
            return Conflict(new { message = "Username or email already exists" });
        }

        user.Username = request.Username ?? user.Username;
        user.Email = request.Email ?? user.Email;
        user.FullName = request.FullName ?? user.FullName;
        user.Role = request.Role ?? user.Role;
        user.IsActive = request.IsActive ?? user.IsActive;

        // Only update password if provided
        if (!string.IsNullOrEmpty(request.Password))
        {
            user.PasswordHash = HashPassword(request.Password);
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            user.UserId,
            user.Username,
            user.Email,
            user.FullName,
            user.Role,
            user.IsActive,
            message = "User updated successfully"
        });
    }

    /// <summary>
    /// Delete a user
    /// </summary>
    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();

        return Ok(new { message = "User deleted successfully" });
    }

    // Helper: Hash password using SHA256 (in production, use bcrypt or Argon2)
    private static string HashPassword(string password)
    {
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
        return Convert.ToBase64String(bytes);
    }

    // Helper: Generate a simple token (in production, use JWT)
    private static string GenerateSimpleToken(User user)
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var data = $"{user.UserId}:{timestamp}";
        using var sha256 = SHA256.Create();
        var hash = Convert.ToBase64String(sha256.ComputeHash(Encoding.UTF8.GetBytes(data + "secret-key")));
        return $"{user.UserId}:{timestamp}:{hash}";
    }

    // Helper: Extract user ID from token
    private static int? ExtractUserIdFromToken(string? authorization)
    {
        if (string.IsNullOrEmpty(authorization))
            return null;

        var token = authorization.Replace("Bearer ", "");
        var parts = token.Split(':');
        
        if (parts.Length >= 1 && int.TryParse(parts[0], out var userId))
        {
            return userId;
        }

        return null;
    }
}

// Request/Response DTOs
public class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginResponse
{
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
}

public class RegisterRequest
{
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? Role { get; set; }
}

public class ChangePasswordRequest
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class UpdateUserRequest
{
    public string? Username { get; set; }
    public string? Email { get; set; }
    public string? FullName { get; set; }
    public string? Role { get; set; }
    public bool? IsActive { get; set; }
    public string? Password { get; set; }
}
