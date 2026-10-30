# Observability

The API writes structured JSON logs to stdout. It never writes application logs
to MariaDB. A collector reads container stdout, labels the streams and ships
them to Loki (or any other backend). Grafana queries Loki.

```text
API container stdout (pino JSON)
        |
        v
Alloy / host collector  --->  Loki  --->  Grafana Explore
        |
        +------------------->  any OTLP/Loki-compatible backend
```

## Why logs do not go to the database

- Log volume grows much faster than business data and would compete with
  application queries, backups and migrations.
- Logs need different retention and access rules from accounts and items.
- A database outage would also destroy the evidence needed to diagnose it.
- Security and request logs must not be mutable by application users.

The database keeps `MetadataUpdateHistory`, which is business audit data for
account and item changes. It is not an application log store.

## Optional stack

The overlay works with either development or production compose:

```bash
docker compose -f compose.dev.yaml -f compose.observability.yaml up -d
# or
docker compose -f compose.prod.yaml -f compose.observability.yaml up -d
```

Services and local ports:

| Service | Port | Notes |
|---|---|---|
| Loki | `127.0.0.1:3100` | Filesystem storage, 7-day retention |
| Grafana | `127.0.0.1:3001` | Loki datasource provisioned, anonymous access disabled |
| Alloy | `127.0.0.1:12345` | Collector UI/API; reads the Docker socket read-only |

Set `GRAFANA_ADMIN_PASSWORD` before starting. The default is `admin` for local
use only. The datasource file is
`deploy/observability/grafana-datasource.yaml`.

### Docker socket warning

`compose.observability.yaml` mounts `/var/run/docker.sock` into Alloy so it can
discover containers in development and demos. That is effectively root access
to the Docker host. In production run Alloy, Promtail, Fluent Bit or the
platform log agent on the host, or use a managed collector, and send the logs
to a remote Loki/OTLP endpoint. Do not mount the Docker socket into a
long-running production container.

`deploy/observability/alloy.river` is mounted as `/etc/alloy/config.alloy`. It
uses the Alloy configuration syntax (the historical `.river` extension is kept
for compatibility with the plan and tooling).

## What the collector extracts

The application emits pino JSON with these relevant fields:

```json
{"level":30,"time":"...","service":"unah-red-tutores-api","req":{"id":"..."},"msg":"GET /healthz completed"}
```

Alloy:

- labels the stream with `service` and `level`;
- keeps `req.id` as `req_id` and the OpenTelemetry `trace_id` as structured
  metadata;
- leaves non-JSON container logs (MariaDB, Loki) unlabelled rather than dropping
  them.

Pino uses numeric levels by default: `10` trace, `20` debug, `30` info, `40`
warn, `50` error, `60` fatal. Use those values in LogQL.

## Query examples

Errors and warnings for the API in the last 15 minutes:

```logql
{service="unah-red-tutores-api"} | level=~"40|50|60"
```

Count warnings/errors per service over time:

```logql
sum by (service) (
  count_over_time({job="docker"} | level=~"40|50|60" [5m])
)
```

Follow one request by its `req.id` (stored as `req_id` structured metadata):

```logql
{service="unah-red-tutores-api"} | req_id="26feeb99-544a-47bb-b792-2a7f2f9acbd8"
```

If a backend does not preserve structured metadata, parse the JSON line instead:

```logql
{service="unah-red-tutores-api"} | json | req_id="26feeb99-544a-47bb-b792-2a7f2f9acbd8"
```

## pino-loki as an opt-in alternative

Instead of a collector, the API can push directly to Loki with `pino-loki`.
This removes the collector but adds a network dependency inside the request
path: slow or unavailable Loki can delay or drop logs, and the app must buffer
and retry. It also needs Loki credentials in the API environment. The
stdout-to-collector pattern keeps the app independent of the logging backend
and lets the platform rotate credentials and destinations without redeploying
the API. Prefer the collector for production; use `pino-loki` only when the
platform cannot run a collector.

## OpenTelemetry correlation

Tracing is optional and off by default. Enable it with:

```bash
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318/v1/traces
OTEL_SERVICE_NAME=unah-red-tutores-api
```

Standard `OTEL_*` variables are read by the SDK. The pino instrumentation adds
`trace_id` and `span_id` to log records. Alloy keeps `trace_id` as structured
metadata, so a Grafana Loki query can find the logs for a trace, and a Grafana
derived field or data link can jump from a log line to the trace in Tempo or
another trace datasource. Without a trace backend the `trace_id` is still
useful for correlating logs from one request across services.

The overlay does not include a trace backend or an OpenTelemetry Collector; add
them separately when tracing is enabled.
