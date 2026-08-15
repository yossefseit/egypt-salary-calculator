using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace api;

public class GetUsdEgpRate
{
    private const string HttpClientName = "Frankfurter";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<GetUsdEgpRate> _logger;

    public GetUsdEgpRate(
        IHttpClientFactory httpClientFactory,
        ILogger<GetUsdEgpRate> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    [Function("GetUsdEgpRate")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get")] HttpRequest request)
    {
        try
        {
            var client = _httpClientFactory.CreateClient(HttpClientName);
            using var upstreamResponse = await client.GetAsync(
                "v2/rate/USD/EGP",
                request.HttpContext.RequestAborted);

            if (!upstreamResponse.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Exchange-rate provider returned HTTP {StatusCode}.",
                    (int)upstreamResponse.StatusCode);

                return CreateError(
                    "Exchange-rate provider returned an error.",
                    StatusCodes.Status502BadGateway);
            }

            var upstreamRate = await upstreamResponse.Content
                .ReadFromJsonAsync<FrankfurterRate>(
                    cancellationToken: request.HttpContext.RequestAborted);

            if (upstreamRate is null
                || !string.Equals(upstreamRate.Base, "USD", StringComparison.Ordinal)
                || !string.Equals(upstreamRate.Quote, "EGP", StringComparison.Ordinal)
                || upstreamRate.Rate <= 0
                || string.IsNullOrWhiteSpace(upstreamRate.Date))
            {
                _logger.LogWarning("Exchange-rate provider returned invalid data.");

                return CreateError(
                    "Exchange-rate provider returned invalid data.",
                    StatusCodes.Status502BadGateway);
            }

            request.HttpContext.Response.Headers.CacheControl =
                "public, max-age=3600";

            return new OkObjectResult(new ExchangeRateResult(
                BaseCurrency: upstreamRate.Base,
                QuoteCurrency: upstreamRate.Quote,
                Rate: upstreamRate.Rate,
                Date: upstreamRate.Date,
                Source: "Frankfurter blended reference rate"));
        }
        catch (OperationCanceledException)
            when (!request.HttpContext.RequestAborted.IsCancellationRequested)
        {
            _logger.LogWarning("Exchange-rate provider request timed out.");

            return CreateError(
                "Exchange-rate provider timed out.",
                StatusCodes.Status504GatewayTimeout);
        }
        catch (HttpRequestException exception)
        {
            _logger.LogWarning(
                exception,
                "Exchange-rate provider request failed.");

            return CreateError(
                "Exchange-rate provider is unavailable.",
                StatusCodes.Status502BadGateway);
        }
    }

    private static ObjectResult CreateError(string message, int statusCode) =>
        new(new { error = message }) { StatusCode = statusCode };

    private sealed record FrankfurterRate(
        [property: JsonPropertyName("date")] string Date,
        [property: JsonPropertyName("base")] string Base,
        [property: JsonPropertyName("quote")] string Quote,
        [property: JsonPropertyName("rate")] decimal Rate);

    private sealed record ExchangeRateResult(
        string BaseCurrency,
        string QuoteCurrency,
        decimal Rate,
        string Date,
        string Source);
}
