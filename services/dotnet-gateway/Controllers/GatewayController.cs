using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace ContractGuardian.Gateway.Controllers;

/// <summary>
/// CO4: .NET Core API Gateway Controller
/// CO5: Centralized routing to microservices
/// </summary>
[ApiController]
[Route("api/gateway")]
[Produces("application/json")]
public class GatewayController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<GatewayController> _logger;

    public GatewayController(IHttpClientFactory httpClientFactory, ILogger<GatewayController> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    /// <summary>
    /// Route a request to the appropriate upstream service
    /// CO5: API Gateway routing with token forwarding
    /// </summary>
    [HttpPost("route")]
    public async Task<IActionResult> RouteRequest([FromBody] GatewayRouteRequest request)
    {
        var service = request.Service.ToUpper() switch
        {
            "FASTAPI" => "FastAPI",
            "NODE" or "ACTIVITY" => "NodeActivity",
            "SPRING" or "REPORT" => "SpringBoot",
            _ => null
        };

        if (service == null)
            return BadRequest(new { error = $"Unknown service: {request.Service}" });

        try
        {
            var client = _httpClientFactory.CreateClient(service);
            // Forward JWT token
            var token = Request.Headers["Authorization"].FirstOrDefault();
            if (!string.IsNullOrEmpty(token))
                client.DefaultRequestHeaders.Authorization =
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token.Replace("Bearer ", ""));

            var httpRequest = new HttpRequestMessage(
                new HttpMethod(request.Method ?? "GET"),
                request.Path
            );

            if (request.Body != null)
                httpRequest.Content = new StringContent(
                    JsonSerializer.Serialize(request.Body),
                    System.Text.Encoding.UTF8,
                    "application/json"
                );

            var response = await client.SendAsync(httpRequest);
            var content = await response.Content.ReadAsStringAsync();

            return StatusCode((int)response.StatusCode, new {
                upstream_service = service,
                upstream_status = (int)response.StatusCode,
                data = content
            });
        }
        catch (Exception ex)
        {
            _logger.LogError("Gateway routing failed: {Error}", ex.Message);
            return StatusCode(503, new { error = "Upstream service unavailable", details = ex.Message });
        }
    }

    /// <summary>
    /// Check all upstream services health
    /// CO5: Distributed health monitoring
    /// </summary>
    [HttpGet("health-all")]
    public async Task<IActionResult> CheckAllServices()
    {
        var services = new[] { ("FastAPI", "/health"), ("NodeActivity", "/health"), ("SpringBoot", "/api/reports/health") };
        var results = new Dictionary<string, object>();

        foreach (var (svc, path) in services)
        {
            try
            {
                var client = _httpClientFactory.CreateClient(svc);
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
                var resp = await client.GetAsync(path, cts.Token);
                results[svc] = new { status = "UP", httpStatus = (int)resp.StatusCode };
            }
            catch (Exception ex)
            {
                results[svc] = new { status = "DOWN", error = ex.Message };
            }
        }

        return Ok(new { gateway = "UP", services = results, timestamp = DateTime.UtcNow });
    }
}

public record GatewayRouteRequest(string Service, string Path, string? Method = "GET", object? Body = null);
