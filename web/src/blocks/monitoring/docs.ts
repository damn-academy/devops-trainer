// Offline snapshots of the Prometheus documentation (prometheus.io/docs,
// Apache-2.0), shortened to what the course uses, with the page anatomy:
// function signature, description, caveats.

import type { DocPage } from '../../core/types';

export const PROM_DOCS: DocPage[] = [
  {
    id: 'web/prometheus.io/querying/functions',
    source: 'prometheus.io',
    title: 'Query functions',
    url: 'https://prometheus.io/docs/prometheus/latest/querying/functions/',
    license: 'Apache-2.0',
    version: 'Prometheus 3.7',
    sections: [
      { id: 'overview', title: 'Functions', body: 'Some functions have default arguments, e.g. year(v=vector(time()) instant-vector).\nThis means that there is one argument v which is an instant vector, which if not provided it will\ndefault to the value of the expression vector(time()).' },
      { id: 'absent', title: 'absent()', body: 'absent(v instant-vector) returns an empty vector if the vector passed to it has any elements\n(floats or native histograms) and a 1-element vector with the value 1 if the vector passed to it\nhas no elements.\n\nThis is useful for alerting on when no time series exist for a given metric name and label\ncombination.\n\n    absent(nonexistent{job="myjob"})\n    # => {job="myjob"}' },
      { id: 'changes', title: 'changes()', body: 'For each input time series, changes(v range-vector) returns the number of times its value has\nchanged within the provided time range as an instant vector.' },
      { id: 'histogram_quantile', title: 'histogram_quantile()', body: 'histogram_quantile(φ scalar, b instant-vector) calculates the φ-quantile (0 ≤ φ ≤ 1) from a\nclassic histogram or from a native histogram.\n\nThe samples in b are the counts of observations in each bucket. Each sample must have a label le\nwhere the label value denotes the inclusive upper bound of the bucket. Samples without such a label\nare silently ignored.\n\nUse the rate() function to specify the time window for the quantile calculation.\n\nExample: A histogram metric is called http_request_duration_seconds. To calculate the 90th\npercentile of request durations over the last 10m, use the following expression:\n\n    histogram_quantile(0.9, rate(http_request_duration_seconds_bucket[10m]))\n\nTo aggregate, use the sum() aggregator around the rate() function. Since the le label is required\nby histogram_quantile(), it has to be included in the by clause:\n\n    histogram_quantile(0.9, sum by (job, le) (rate(http_request_duration_seconds_bucket[10m])))\n\nThe quantile is calculated by linear interpolation within the bucket: its precision depends on the\nbucket boundaries. Averaging quantiles of several instances does not give the quantile of the whole.' },
      { id: 'increase', title: 'increase()', body: 'increase(v range-vector) calculates the increase in the time series in the range vector. Breaks in\nmonotonicity (such as counter resets due to target restarts) are automatically adjusted for. The\nincrease is extrapolated to cover the full time range as specified in the range vector selector, so\nthat it is possible to get a non-integer result even if a counter increases only by integer\nincrements.\n\nincrease should only be used with counters. It is syntactic sugar for rate(v) multiplied by the\nnumber of seconds under the specified time range window.' },
      { id: 'irate', title: 'irate()', body: 'irate(v range-vector) calculates the per-second instant rate of increase of the time series in the\nrange vector. This is based on the last two data points.\n\nirate should only be used when graphing volatile, fast-moving counters. Use rate for alerts and\nslow-moving counters, as brief changes in the rate can reset the FOR clause and graphs consisting\nentirely of rare spikes are hard to read.' },
      { id: 'label_replace', title: 'label_replace()', body: 'For each timeseries in v,\n    label_replace(v instant-vector, dst_label string, replacement string, src_label string, regex string)\nmatches the regular expression regex against the value of the label src_label. If it matches, the\nvalue of the label dst_label in the returned timeseries will be the expansion of replacement,\ntogether with the original labels in the input. Capturing groups in the regular expression can be\nreferenced with $1, $2, etc. If the regular expression doesn\'t match then the timeseries is returned\nunchanged.\n\n    label_replace(up{job="api-server",service="a:c"}, "foo", "$1", "service", "(.*):.*")' },
      { id: 'rate', title: 'rate()', body: 'rate(v range-vector) calculates the per-second average rate of increase of the time series in the\nrange vector. Breaks in monotonicity (such as counter resets due to target restarts) are\nautomatically adjusted for. Also, the calculation extrapolates to the ends of the time range,\nallowing for missed scrapes or imperfect alignment of scrape cycles with the range\'s time period.\n\nThe following example expression returns the per-second rate of HTTP requests as measured over the\nlast 5 minutes, per time series in the range vector:\n\n    rate(http_requests_total{job="api-server"}[5m])\n\nrate should only be used with counters. It is best suited for alerting, and for graphing of\nslow-moving counters.\n\nNote that when combining rate() with an aggregation operator (e.g. sum()) or a function aggregating\nover time (any function ending in _over_time), always take a rate() first, then aggregate.\nOtherwise rate() cannot detect counter resets when your target restarts.' },
      { id: 'over_time', title: '<aggregation>_over_time()', body: 'The following functions allow aggregating each series of a given range vector over time and return\nan instant vector with per-series aggregation results:\n    avg_over_time(range-vector): the average value of all points in the specified interval.\n    min_over_time(range-vector): the minimum value of all points in the specified interval.\n    max_over_time(range-vector): the maximum value of all points in the specified interval.\n    sum_over_time(range-vector): the sum of all values in the specified interval.\n    count_over_time(range-vector): the count of all values in the specified interval.\n    absent_over_time(range-vector): 1 if the range has no samples.' },
    ],
  },
  {
    id: 'web/prometheus.io/querying/basics',
    source: 'prometheus.io',
    title: 'Querying basics',
    url: 'https://prometheus.io/docs/prometheus/latest/querying/basics/',
    license: 'Apache-2.0',
    version: 'Prometheus 3.7',
    sections: [
      { id: 'types', title: 'Expression language data types', body: 'In Prometheus\'s expression language, an expression or sub-expression can evaluate to one of four types:\n  Instant vector - a set of time series containing a single sample for each time series, all sharing the same timestamp\n  Range vector - a set of time series containing a range of data points over time for each time series\n  Scalar - a simple numeric floating point value\n  String - a simple string value; currently unused' },
      { id: 'instant', title: 'Instant vector selectors', body: 'Instant vector selectors allow the selection of a set of time series and a single sample value for\neach at a given timestamp (point in time).\n\nThis example selects all time series that have the http_requests_total metric name, also have the job\nlabel set to prometheus and their group label set to canary:\n\n    http_requests_total{job="prometheus",group="canary"}\n\nLabel matching operators:\n  =  : Select labels that are exactly equal to the provided string.\n  != : Select labels that are not equal to the provided string.\n  =~ : Select labels that regex-match the provided string.\n  !~ : Select labels that do not regex-match the provided string.' },
      { id: 'range', title: 'Range Vector Selectors', body: 'Range vector literals work like instant vector literals, except that they select a range of samples\nback from the current instant. A time duration is appended in square brackets ([]) at the end of a\nvector selector to specify how far back in time values should be fetched for each resulting range\nvector element. The range is a left-open and right-closed interval.\n\n    http_requests_total{job="prometheus"}[5m]' },
      { id: 'offset', title: 'Offset modifier', body: 'The offset modifier allows changing the time offset for individual instant and range vectors in a query.\n\n    http_requests_total offset 5m' },
      { id: 'staleness', title: 'Staleness', body: 'If no sample is found (by default) 5 minutes before a sampling timestamp, no value is returned for\nthat time series at this point in time.' },
    ],
  },
  {
    id: 'web/prometheus.io/alerting/rules',
    source: 'prometheus.io',
    title: 'Alerting rules',
    url: 'https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/',
    license: 'Apache-2.0',
    version: 'Prometheus 3.7',
    sections: [
      { id: 'defining', title: 'Defining alerting rules', body: 'Alerting rules are configured in Prometheus in the same way as recording rules.\n\n    groups:\n    - name: example\n      rules:\n      - alert: HighRequestLatency\n        expr: job:request_latency_seconds:mean5m{job="myjob"} > 0.5\n        for: 10m\n        labels:\n          severity: page\n        annotations:\n          summary: High request latency\n\nThe optional for clause causes Prometheus to wait for a certain duration between first encountering a\nnew expression output vector element and counting an alert as firing for this element. In this case,\nPrometheus will check that the alert continues to be active during each evaluation for 10 minutes\nbefore firing the alert. Elements that are active, but not firing yet, are in the pending state.\n\nThe labels clause allows specifying a set of additional labels to be attached to the alert.\nThe annotations clause specifies a set of informational labels that can be used to store longer\nadditional information such as alert descriptions or runbook links.' },
      { id: 'sending', title: 'Sending alert notifications', body: 'Prometheus\'s alerting rules are good at figuring what is broken right now, but they are not a\nfully-fledged notification solution. Another layer is needed to add summarization, notification rate\nlimiting, silencing and alert dependencies on top of the simple alert definitions. In Prometheus\'s\necosystem, the Alertmanager takes on this role.' },
    ],
  },
];
