using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using ContractGuardian.Gateway.Data;
using ContractGuardian.Gateway.Services;

/**
 * Contract Guardian AI - .NET Core API Gateway
 * CO4: ASP.NET Core, EF Core, Identity, Swagger, Testing
 * CO5: API Gateway for microservices routing
 */

var builder = WebApplication.CreateBuilder(args);

// =============================================================
// SERVICES (CO4: ASP.NET Core DI Container)
// =============================================================

// EF Core + PostgreSQL (CO4: EF Core)
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection")
        ?? "Host=localhost;Database=contract_guardian;Username=contract_guardian;Password=contract_guardian"
    )
);

// JWT Authentication (CO4: ASP.NET Identity/JWT)
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "change-me-in-production-please";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => {
        options.TokenValidationParameters = new TokenValidationParameters {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateIssuer = false,
            ValidateAudience = false,
            ClockSkew = TimeSpan.Zero,
        };
    });

builder.Services.AddAuthorization(options => {
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("ADMIN"));
    options.AddPolicy("AnalystOrAdmin", policy => policy.RequireRole("ADMIN", "ANALYST"));
});

// CORS
builder.Services.AddCors(options => {
    options.AddDefaultPolicy(policy => {
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    });
});

// Controllers
builder.Services.AddControllers();

// Swagger (CO4: Swagger documentation)
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c => {
    c.SwaggerDoc("v1", new OpenApiInfo {
        Title = "Contract Guardian AI Gateway",
        Version = "v1",
        Description = "CO4: .NET Core API Gateway | CO5: Microservices Routing"
    });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "Enter JWT token"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement {
        {
            new OpenApiSecurityScheme {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

// HttpClient for routing to backend services
builder.Services.AddHttpClient("FastAPI", client => {
    client.BaseAddress = new Uri(
        builder.Configuration["Services:FastAPI"] ?? "http://localhost:8000"
    );
    client.Timeout = TimeSpan.FromSeconds(30);
});
builder.Services.AddHttpClient("NodeActivity", client => {
    client.BaseAddress = new Uri(
        builder.Configuration["Services:NodeActivity"] ?? "http://localhost:3001"
    );
});
builder.Services.AddHttpClient("SpringBoot", client => {
    client.BaseAddress = new Uri(
        builder.Configuration["Services:SpringBoot"] ?? "http://localhost:8082"
    );
});

// Custom services
builder.Services.AddScoped<GatewayRoutingService>();
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>("database");

var app = builder.Build();

// =============================================================
// MIDDLEWARE PIPELINE (CO4: ASP.NET Core middleware)
// =============================================================
if (app.Environment.IsDevelopment()) {
    app.UseSwagger();
    app.UseSwaggerUI(c => {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Contract Guardian Gateway v1");
        c.RoutePrefix = "swagger";
    });
}

app.UseHttpsRedirection();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

// Request logging middleware
app.Use(async (context, next) => {
    var requestId = context.Request.Headers["X-Request-ID"].FirstOrDefault() ?? Guid.NewGuid().ToString("N")[..12];
    context.Response.Headers["X-Request-ID"] = requestId;
    context.Response.Headers["X-Gateway"] = "ContractGuardian-DotNet";
    await next();
});

app.MapControllers();
app.MapHealthChecks("/health");

// =============================================================
// MINIMAL API ENDPOINTS (CO4: Minimal APIs in .NET 8)
// =============================================================

app.MapGet("/", () => new {
    service = "Contract Guardian AI Gateway (.NET Core)",
    version = "1.0.0",
    co = new[] { "CO4 (ASP.NET Core)", "CO5 (API Gateway)" },
    endpoints = new[] { "/swagger", "/health", "/api/gateway/status", "/api/gateway/route" }
});

app.MapGet("/api/gateway/status", () => new {
    gateway = "ContractGuardian API Gateway",
    framework = ".NET 8 / ASP.NET Core",
    features = new[] { "EF Core", "Identity", "JWT", "Swagger", "CORS", "Health Checks", "Minimal APIs" },
    upstream_services = new {
        fastapi_backend = "http://localhost:8000",
        node_activity = "http://localhost:3001",
        springboot_reports = "http://localhost:8082"
    },
    timestamp = DateTime.UtcNow
});

app.Run();
