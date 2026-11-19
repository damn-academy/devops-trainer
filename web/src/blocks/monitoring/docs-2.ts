// Offline reference pages for logs, traces and Kubernetes metrics: short
// summaries in the structure of the official pages (grafana.com/docs/loki,
// opentelemetry.io, w3.org, kube-state-metrics), written for the course; the
// url points to the original.

import type { DocPage } from '../../core/types';

export const OBS_WEB_DOCS: DocPage[] = [
  {
    id: 'web/grafana.com/loki/logql',
    source: 'grafana.com',
    title: 'LogQL: Log query language',
    url: 'https://grafana.com/docs/loki/latest/query/',
    license: 'AGPL-3.0',
    version: 'Loki 3.5',
    sections: [
      { id: 'overview', title: 'LogQL', body: 'LogQL is Grafana Loki\'s PromQL-inspired query language. Queries act as if they are a distributed grep\nto aggregate log sources. There are two types of LogQL queries:\n  - Log queries return the contents of log lines.\n  - Metric queries extend log queries to calculate values based on query results.' },
      { id: 'log-stream-selector', title: 'Log stream selector', body: 'The stream selector determines which log streams to include in a query\'s results. A log stream is a\nunique source of log content, such as a file. The stream selector is comprised of one or more\ncomma-separated key-value pairs, enclosed in curly braces:\n\n    {app="api", namespace="shop"}\n\nOperators: = exactly equal, != not equal, =~ regex matches, !~ regex does not match.\nOnly labels are indexed: the selector is the cheap part of a query.' },
      { id: 'line-filter', title: 'Line filter expression', body: 'A line filter does a distributed grep over the aggregated logs from the matching log streams:\n\n    |=  Log line contains string\n    !=  Log line does not contain string\n    |~  Log line contains a match to the regular expression\n    !~  Log line does not contain a match to the regular expression\n\n    {app="api"} |= "error" != "timeout"\n\nLine filters are the fastest way to filter logs after the stream selector: put them first.' },
      { id: 'parser', title: 'Parser expression', body: 'Parser expressions parse and extract labels from the log content. Those extracted labels can then\nbe used for filtering using label filter expressions or for metric aggregations.\n\n  | json     extracts all the properties of a JSON line as labels; nested properties are\n             flattened with "_" (request.method becomes request_method)\n  | logfmt   extracts all keys and values from a logfmt line (key=value key2="value 2")\n\nIf a line cannot be parsed, the label __error__ is added (JSONParserErr, LogfmtParserErr).\nFilter it out with | __error__="".' },
      { id: 'label-filter', title: 'Label filter expression', body: 'Label filter expressions filter log lines using their original and extracted labels.\n\n    | status >= 500\n    | route = "/checkout"\n    | duration > 1.5s\n\nNumbers compare as numbers (==, !=, >, >=, <, <=), durations accept units (ms, s, m, h),\nstrings use =, !=, =~, !~. Several filters can be chained with , or and.' },
      { id: 'line-format', title: 'Line format expression', body: 'The line_format expression rewrites the log line content using a template:\n\n    | line_format "{{.route}} {{.status}} {{.msg}}"' },
      { id: 'metric-queries', title: 'Metric queries', body: 'Metric queries extend log queries by applying a function to log query results. Range vector\naggregations:\n\n    rate(log-range)            the number of entries per second\n    count_over_time(log-range) the count of entries for each log stream within the range\n    bytes_over_time(log-range) the number of bytes used by each log stream within the range\n    bytes_rate(log-range)      the number of bytes per second\n    absent_over_time(log-range) 1 if no entries in the range\n\n    sum by (route) (count_over_time({app="api"} | json | status >= 500 [5m]))\n\nBuilt-in aggregation operators over the result: sum, avg, min, max, count, topk, bottomk, with\nby (labels) or without (labels), as in PromQL. Every distinct label set after the parsers is a\nseparate series: aggregate away high-cardinality fields such as user_id.' },
      { id: 'unwrap', title: 'Unwrapped range aggregations', body: 'Unwrapped ranges use extracted labels as sample values instead of log lines:\n\n    quantile_over_time(0.99, {app="api"} | json | unwrap duration_ms [5m]) by (route)\n\nFunctions: sum_over_time, avg_over_time, min_over_time, max_over_time, quantile_over_time.\nThey support grouping with by/without after the call.' },
    ],
  },
  {
    id: 'web/w3.org/trace-context',
    source: 'w3.org',
    title: 'Trace Context',
    url: 'https://www.w3.org/TR/trace-context/',
    license: 'W3C Document License',
    version: 'W3C Recommendation',
    sections: [
      { id: 'traceparent', title: 'traceparent header', body: 'The traceparent HTTP header field identifies the incoming request in a tracing system. It has four\nfields, separated by dashes:\n\n    traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01\n                 version-trace-id-parent-id-trace-flags' },
      { id: 'version', title: 'version', body: '2 hex digits. The current version is 00.' },
      { id: 'trace-id', title: 'trace-id', body: '32 hex digits: the ID of the whole trace. Every service on the path keeps it unchanged.\nAll zeroes is not valid.' },
      { id: 'parent-id', title: 'parent-id', body: '16 hex digits: the ID of this request as known by the caller (the caller\'s span id). The callee\nrecords it as the parent of its own span and sends its own span id further down.' },
      { id: 'trace-flags', title: 'trace-flags', body: '2 hex digits, a bit field. The lowest bit is "sampled": 01 means the caller may have recorded the\ntrace and the callee should record its part too; 00 means the caller did not record it.' },
      { id: 'tracestate', title: 'tracestate header', body: 'The tracestate header carries vendor-specific data as a list of key=value pairs. It is optional and\ntravels together with traceparent.' },
    ],
  },
  {
    id: 'web/opentelemetry.io/traces',
    source: 'opentelemetry.io',
    title: 'Traces',
    url: 'https://opentelemetry.io/docs/concepts/signals/traces/',
    license: 'CC-BY-4.0',
    version: 'OpenTelemetry docs',
    sections: [
      { id: 'overview', title: 'Traces', body: 'Traces give us the big picture of what happens when a request is made to an application. A trace is\nmade of one or more spans. The first span is the root span; each other span has a parent.' },
      { id: 'spans', title: 'Spans', body: 'A span represents a unit of work or operation. Spans contain: a name, a parent span ID (empty for root\nspans), start and end timestamps, span context, attributes, span events, span links and span status.' },
      { id: 'context', title: 'Span context and propagation', body: 'Span context is an immutable object on every span that contains the trace ID, the span ID, trace\nflags and trace state. Context propagation moves it between services, usually in the W3C traceparent\nheader, so that spans created in different services join one trace.' },
      { id: 'attributes', title: 'Attributes', body: 'Attributes are key-value pairs with metadata about the operation: http.request.method, http.route,\nhttp.response.status_code, db.system, db.query.text. Semantic conventions give common names.' },
      { id: 'status', title: 'Span status', body: 'Unset (the default), Error (the operation contains an error) or Ok (explicitly marked successful).' },
      { id: 'sampling', title: 'Sampling', body: 'Head sampling decides at the start of a trace (for example, keep 10% by trace ID); it is cheap but\nblind to how the trace ends. Tail sampling decides after the trace is complete, in the Collector, and\ncan keep every error and every slow trace.' },
      { id: 'collector', title: 'Collector', body: 'The OpenTelemetry Collector receives telemetry (receivers: otlp), processes it (processors: batch,\ntail_sampling, attributes) and exports it to one or more backends (exporters: otlp to Tempo or\nJaeger, prometheusremotewrite, loki). Services send OTLP to the Collector, not to the backends.' },
    ],
  },
  {
    id: 'web/github.com/kube-state-metrics',
    source: 'kube-state-metrics',
    title: 'kube-state-metrics: exposed metrics',
    url: 'https://github.com/kubernetes/kube-state-metrics/tree/main/docs',
    license: 'Apache-2.0',
    version: 'kube-state-metrics 2.17',
    sections: [
      { id: 'overview', title: 'Overview', body: 'kube-state-metrics is a simple service that listens to the Kubernetes API server and generates\nmetrics about the state of the objects. It is not focused on the health of the individual\nKubernetes components, but rather on the health of the various objects inside, such as deployments,\nnodes and pods. The metrics show the state as the API reports it; resource usage comes from\ncAdvisor in the kubelet.' },
      { id: 'pod', title: 'Pod metrics', body: '    kube_pod_status_phase{namespace, pod, phase}           1 for the current phase\n    kube_pod_container_status_restarts_total{container}    counter of restarts\n    kube_pod_container_status_last_terminated_reason{reason}  1, reason: OOMKilled, Error, Completed\n    kube_pod_container_resource_requests{resource, unit}   requests by resource (cpu, memory)\n    kube_pod_container_resource_limits{resource, unit}     limits by resource' },
      { id: 'deployment', title: 'Deployment metrics', body: '    kube_deployment_spec_replicas            number of desired pods\n    kube_deployment_status_replicas_available number of available pods (ready for minReadySeconds)\n\n    kube_deployment_spec_replicas != kube_deployment_status_replicas_available' },
      { id: 'node', title: 'Node metrics', body: '    kube_node_status_condition{condition, status}  1 for the current status (true, false, unknown)' },
      { id: 'cadvisor', title: 'Container usage (cAdvisor, not kube-state-metrics)', body: 'The kubelet exposes cAdvisor metrics at /metrics/cadvisor, read from the cgroup of each container:\n\n    container_cpu_usage_seconds_total          cpu time, a counter\n    container_memory_working_set_bytes         memory.current minus inactive file cache;\n                                               the value the OOM killer acts upon\n    container_spec_memory_limit_bytes          memory.max\n    container_cpu_cfs_periods_total            elapsed 100 ms enforcement periods (cpu.stat nr_periods)\n    container_cpu_cfs_throttled_periods_total  periods the container was throttled (nr_throttled)\n    container_oom_events_total                 OOM events (memory.events oom_kill)' },
    ],
  },
];
