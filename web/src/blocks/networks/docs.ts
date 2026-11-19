// Offline pages of the nginx documentation the block reads at the ladder's
// steps 2–3 (03 §14.3): the directive format "Syntax / Default / Context" is
// the first thing m13 teaches. Text condensed from nginx.org (BSD-2-Clause).

import type { DocPage } from '../../core/types';

const directive = (name: string, syntax: string, def: string, context: string, body: string, module = 'ngx_http_proxy_module'): DocPage => ({
  id: `web/nginx.org/${name}`,
  source: 'nginx.org',
  title: `nginx · ${name}`,
  url: `https://nginx.org/en/docs/http/${module}.html#${name}`,
  license: 'condensed from the nginx documentation (BSD-2-Clause)',
  version: 'nginx 1.26',
  sections: [
    { id: 'SYNOPSIS', title: 'Syntax', body: syntax },
    { id: 'DEFAULT', title: 'Default', body: def },
    { id: 'CONTEXT', title: 'Context', body: context },
    { id: 'DESCRIPTION', body },
  ],
});

export const docs: DocPage[] = [
  directive(
    'proxy_read_timeout',
    'proxy_read_timeout time;',
    'proxy_read_timeout 60s;',
    'http, server, location',
    'Defines a timeout for reading a response from the proxied server. The timeout is set only between two successive read operations, not for the transmission of the whole response. If the proxied server does not transmit anything within this time, the connection is closed.',
  ),
  directive(
    'proxy_connect_timeout',
    'proxy_connect_timeout time;',
    'proxy_connect_timeout 60s;',
    'http, server, location',
    'Defines a timeout for establishing a connection with a proxied server. It should be noted that this timeout cannot usually exceed 75 seconds.',
  ),
  directive(
    'proxy_next_upstream',
    'proxy_next_upstream error | timeout | invalid_header | http_500 | http_502 | http_503 | http_504 | http_403 | http_404 | http_429 | non_idempotent | off ...;',
    'proxy_next_upstream error timeout;',
    'http, server, location',
    'Specifies in which cases a request should be passed to the next server:\n\nerror       an error occurred while establishing a connection with the server, passing a request to it, or reading the response header;\ntimeout     a timeout has occurred while establishing a connection with the server, passing a request to it, or reading the response header;\nhttp_500    a server returned a response with the code 500;\nnon_idempotent  normally, requests with a non-idempotent method (POST, LOCK, PATCH) are not passed to the next server if a request has been sent to an upstream server; enabling this option explicitly allows retrying such requests;\noff         disables passing a request to the next server.\n\nOne should bear in mind that passing a request to the next server is only possible if nothing has been sent to a client yet.',
  ),
  directive(
    'server',
    'server address [parameters];',
    '—',
    'upstream',
    'Defines the address and other parameters of a server.\n\nmax_fails=number\n    sets the number of unsuccessful attempts to communicate with the server that should happen in the duration set by the fail_timeout parameter to consider the server unavailable for a duration also set by the fail_timeout parameter. By default, the number of unsuccessful attempts is set to 1.\nfail_timeout=time\n    sets the time during which the specified number of unsuccessful attempts to communicate with the server should happen to consider the server unavailable; and the period of time the server will be considered unavailable. By default, the parameter is set to 10 seconds.\nbackup\n    marks the server as a backup server.\ndown\n    marks the server as permanently unavailable.\n\nIf there is only a single server in a group, max_fails, fail_timeout and slow_start parameters are ignored, and such a server will never be considered unavailable.',
    'ngx_http_upstream_module',
  ),
];
