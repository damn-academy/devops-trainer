// `docker … --help` texts, as the Docker CLI 29 prints them (Apache-2.0,
// github.com/docker/cli). They are the pages of the documentation ladder
// (help/docker-run, …). Flags the simulator does not execute are printed
// faint, without comment (04 §5.3): what they do is for the learner to read.

export const SIMULATED_RUN_FLAGS = new Set([
  'add-host', 'cap-add', 'cap-drop', 'cpus', 'detach', 'entrypoint', 'env', 'env-file', 'health-cmd', 'health-interval', 'health-retries', 'help', 'hostname', 'init', 'interactive',
  'label', 'log-driver', 'log-opt', 'memory', 'mount', 'name', 'network', 'network-alias', 'pids-limit', 'platform', 'privileged', 'publish', 'publish-all', 'quiet', 'read-only',
  'restart', 'rm', 'security-opt', 'stop-signal', 'stop-timeout', 'sysctl', 'tmpfs', 'tty', 'user', 'volume', 'workdir', 'pull', 'ulimit',
]);

const RUN_OPTIONS = `      --add-host list                    Add a custom host-to-IP mapping (host:ip)
      --annotation map                   Add an annotation to the container (passed through to the OCI runtime) (default map[])
  -a, --attach list                      Attach to STDIN, STDOUT or STDERR
      --blkio-weight uint16              Block IO (relative weight), between 10 and 1000, or 0 to disable (default 0)
      --cap-add list                     Add Linux capabilities
      --cap-drop list                    Drop Linux capabilities
      --cgroup-parent string             Optional parent cgroup for the container
      --cgroupns string                  Cgroup namespace to use (host|private)
      --cidfile string                   Write the container ID to the file
      --cpu-period int                   Limit CPU CFS (Completely Fair Scheduler) period
      --cpu-quota int                    Limit CPU CFS (Completely Fair Scheduler) quota
  -c, --cpu-shares int                   CPU shares (relative weight)
      --cpus decimal                     Number of CPUs
      --cpuset-cpus string               CPUs in which to allow execution (0-3, 0,1)
  -d, --detach                           Run container in background and print container ID
      --device list                      Add a host device to the container
      --dns list                         Set custom DNS servers
      --dns-search list                  Set custom DNS search domains
      --entrypoint string                Overwrite the default ENTRYPOINT of the image
  -e, --env list                         Set environment variables
      --env-file list                    Read in a file of environment variables
      --expose list                      Expose a port or a range of ports
      --gpus gpu-request                 GPU devices to add to the container ('all' to pass all GPUs)
      --group-add list                   Add additional groups to join
      --health-cmd string                Command to run to check health
      --health-interval duration         Time between running the check (ms|s|m|h) (default 0s)
      --health-retries int               Consecutive failures needed to report unhealthy
      --health-start-period duration     Start period for the container to initialize before starting health-retries countdown (ms|s|m|h) (default 0s)
      --health-timeout duration          Maximum time to allow one check to run (ms|s|m|h) (default 0s)
      --help                             Print usage
  -h, --hostname string                  Container host name
      --init                             Run an init inside the container that forwards signals and reaps processes
  -i, --interactive                      Keep STDIN open even if not attached
      --ip string                        IPv4 address (e.g., 172.30.100.104)
      --ipc string                       IPC mode to use
  -l, --label list                       Set meta data on a container
      --link list                        Add link to another container
      --log-driver string                Logging driver for the container
      --log-opt list                     Log driver options
      --mac-address string               Container MAC address (e.g., 92:d0:c6:0a:29:33)
  -m, --memory bytes                     Memory limit
      --memory-reservation bytes         Memory soft limit
      --memory-swap bytes                Swap limit equal to memory plus swap: '-1' to enable unlimited swap
      --mount mount                      Attach a filesystem mount to the container
      --name string                      Assign a name to the container
      --network network                  Connect a container to a network
      --network-alias list               Add network-scoped alias for the container
      --no-healthcheck                   Disable any container-specified HEALTHCHECK
      --oom-kill-disable                 Disable OOM Killer
      --oom-score-adj int                Tune host's OOM preferences (-1000 to 1000)
      --pid string                       PID namespace to use
      --pids-limit int                   Tune container pids limit (set -1 for unlimited)
      --platform string                  Set platform if server is multi-platform capable
      --privileged                       Give extended privileges to this container
  -p, --publish list                     Publish a container's port(s) to the host
  -P, --publish-all                      Publish all exposed ports to random ports
      --pull string                      Pull image before running ("always", "missing", "never") (default "missing")
  -q, --quiet                            Suppress the pull output
      --read-only                        Mount the container's root filesystem as read only
      --restart string                   Restart policy to apply when a container exits (default "no")
      --rm                               Automatically remove the container and its associated anonymous volumes when it exits
      --runtime string                   Runtime to use for this container
      --security-opt list                Security Options
      --shm-size bytes                   Size of /dev/shm
      --sig-proxy                        Proxy received signals to the process (default true)
      --stop-signal string               Signal to stop the container
      --stop-timeout int                 Timeout (in seconds) to stop a container
      --storage-opt list                 Storage driver options for the container
      --sysctl map                       Sysctl options (default map[])
      --tmpfs list                       Mount a tmpfs directory
  -t, --tty                              Allocate a pseudo-TTY
      --ulimit ulimit                    Ulimit options (default [])
  -u, --user string                      Username or UID (format: <name|uid>[:<group|gid>])
      --userns string                    User namespace to use
      --uts string                       UTS namespace to use
  -v, --volume list                      Bind mount a volume
      --volumes-from list                Mount volumes from the specified container(s)
  -w, --workdir string                   Working directory inside the container`;

/** Help texts by subcommand path ("run", "container ls", "network create", "compose up"). */
export const HELP: Record<string, string> = {
  '': `Usage:  docker [OPTIONS] COMMAND

A self-sufficient runtime for containers

Common Commands:
  run         Create and run a new container from an image
  exec        Execute a command in a running container
  ps          List containers
  build       Build an image from a Dockerfile
  pull        Download an image from a registry
  push        Upload an image to a registry
  images      List images
  login       Authenticate to a registry
  logout      Log out from a registry
  version     Show the Docker version information
  info        Display system-wide information

Management Commands:
  builder     Manage builds
  buildx*     Docker Buildx
  compose*    Docker Compose
  container   Manage containers
  image       Manage images
  manifest    Manage Docker image manifests and manifest lists
  network     Manage networks
  system      Manage Docker
  volume      Manage volumes

Commands:
  commit      Create a new image from a container's changes
  cp          Copy files/folders between a container and the local filesystem
  create      Create a new container
  diff        Inspect changes to files or directories on a container's filesystem
  events      Get real time events from the server
  history     Show the history of an image
  inspect     Return low-level information on Docker objects
  kill        Kill one or more running containers
  logs        Fetch the logs of a container
  pause       Pause all processes within one or more containers
  port        List port mappings or a specific mapping for the container
  rename      Rename a container
  restart     Restart one or more containers
  rm          Remove one or more containers
  rmi         Remove one or more images
  start       Start one or more stopped containers
  stats       Display a live stream of container(s) resource usage statistics
  stop        Stop one or more running containers
  tag         Create a tag TARGET_IMAGE that refers to SOURCE_IMAGE
  top         Display the running processes of a container
  unpause     Unpause all processes within one or more containers
  update      Update configuration of one or more containers
  wait        Block until one or more containers stop, then print their exit codes

Global Options:
      --config string      Location of client config files (default "/home/learner/.docker")
  -c, --context string     Name of the context to use to connect to the daemon
  -D, --debug              Enable debug mode
  -H, --host list          Daemon socket to connect to
  -l, --log-level string   Set the logging level ("debug", "info", "warn", "error", "fatal") (default "info")
  -v, --version            Print version information and quit

Run 'docker COMMAND --help' for more information on a command.

For more help on how to use Docker, head to https://docs.docker.com/go/guides/
`,
  run: `Usage:  docker container run [OPTIONS] IMAGE [COMMAND] [ARG...]

Create and run a new container from an image

Aliases:
  docker container run, docker run

Options:
${RUN_OPTIONS}
`,
  create: `Usage:  docker container create [OPTIONS] IMAGE [COMMAND] [ARG...]

Create a new container

Aliases:
  docker container create, docker create

Options:
${RUN_OPTIONS.split('\n')
  .filter((l) => !/--detach|--rm |--sig-proxy|--detach-keys/.test(l))
  .join('\n')}
`,
  ps: `Usage:  docker container ls [OPTIONS]

List containers

Aliases:
  docker container ls, docker container list, docker container ps, docker ps

Options:
  -a, --all             Show all containers (default shows just running)
  -f, --filter filter   Filter output based on conditions provided
      --format string   Format output using a custom template:
                        'table':            Print output in table format with column headers (default)
                        'table TEMPLATE':   Print output in table format using the given Go template
                        'json':             Print in JSON format
                        'TEMPLATE':         Print output using the given Go template.
                        Refer to https://docs.docker.com/go/formatting/ for more information about formatting output with templates
  -n, --last int        Show n last created containers (includes all states) (default -1)
  -l, --latest          Show the latest created container (includes all states)
      --no-trunc        Don't truncate output
  -q, --quiet           Only display container IDs
  -s, --size            Display total file sizes
`,
  logs: `Usage:  docker container logs [OPTIONS] CONTAINER

Fetch the logs of a container

Aliases:
  docker container logs, docker logs

Options:
      --details        Show extra details provided to logs
  -f, --follow         Follow log output
      --since string   Show logs since timestamp (e.g. "2013-01-02T13:23:37Z") or relative (e.g. "42m" for 42 minutes)
  -n, --tail string    Number of lines to show from the end of the logs (default "all")
  -t, --timestamps     Show timestamps
      --until string   Show logs before a timestamp (e.g. "2013-01-02T13:23:37Z") or relative (e.g. "42m" for 42 minutes)
`,
  exec: `Usage:  docker container exec [OPTIONS] CONTAINER COMMAND [ARG...]

Execute a command in a running container

Aliases:
  docker container exec, docker exec

Options:
  -d, --detach               Detached mode: run command in the background
      --detach-keys string   Override the key sequence for detaching a container
  -e, --env list             Set environment variables
      --env-file list        Read in a file of environment variables
  -i, --interactive          Keep STDIN open even if not attached
      --privileged           Give extended privileges to the command
  -t, --tty                  Allocate a pseudo-TTY
  -u, --user string          Username or UID (format: "<name|uid>[:<group|gid>]")
  -w, --workdir string       Working directory inside the container
`,
  stop: `Usage:  docker container stop [OPTIONS] CONTAINER [CONTAINER...]

Stop one or more running containers

Aliases:
  docker container stop, docker stop

Options:
  -s, --signal string   Signal to send to the container
  -t, --timeout int     Seconds to wait before killing the container
`,
  kill: `Usage:  docker container kill [OPTIONS] CONTAINER [CONTAINER...]

Kill one or more running containers

Aliases:
  docker container kill, docker kill

Options:
  -s, --signal string   Signal to send to the container
`,
  start: `Usage:  docker container start [OPTIONS] CONTAINER [CONTAINER...]

Start one or more stopped containers

Aliases:
  docker container start, docker start

Options:
  -a, --attach               Attach STDOUT/STDERR and forward signals
      --detach-keys string   Override the key sequence for detaching a container
  -i, --interactive          Attach container's STDIN
`,
  restart: `Usage:  docker container restart [OPTIONS] CONTAINER [CONTAINER...]

Restart one or more containers

Aliases:
  docker container restart, docker restart

Options:
  -s, --signal string   Signal to send to the container
  -t, --timeout int     Seconds to wait before killing the container
`,
  rm: `Usage:  docker container rm [OPTIONS] CONTAINER [CONTAINER...]

Remove one or more containers

Aliases:
  docker container rm, docker container remove, docker rm

Options:
  -f, --force     Force the removal of a running container (uses SIGKILL)
  -l, --link      Remove the specified link
  -v, --volumes   Remove anonymous volumes associated with the container
`,
  images: `Usage:  docker image ls [OPTIONS] [REPOSITORY[:TAG]]

List images

Aliases:
  docker image ls, docker image list, docker images

Options:
  -a, --all             Show all images (default hides intermediate images)
      --digests         Show digests
  -f, --filter filter   Filter output based on conditions provided
      --format string   Format output using a custom template:
                        'table':            Print output in table format with column headers (default)
                        'table TEMPLATE':   Print output in table format using the given Go template
                        'json':             Print in JSON format
                        'TEMPLATE':         Print output using the given Go template.
      --no-trunc        Don't truncate output
  -q, --quiet           Only show image IDs
`,
  pull: `Usage:  docker image pull [OPTIONS] NAME[:TAG|@DIGEST]

Download an image from a registry

Aliases:
  docker image pull, docker pull

Options:
  -a, --all-tags                Download all tagged images in the repository
      --disable-content-trust   Skip image verification (default true)
      --platform string         Set platform if server is multi-platform capable
  -q, --quiet                   Suppress verbose output
`,
  push: `Usage:  docker image push [OPTIONS] NAME[:TAG]

Upload an image to a registry

Aliases:
  docker image push, docker push

Options:
  -a, --all-tags                Push all tags of an image to the repository
      --platform string         Push a platform-specific manifest as a single-platform image to the registry.
  -q, --quiet                   Suppress verbose output
`,
  tag: `Usage:  docker image tag SOURCE_IMAGE[:TAG] TARGET_IMAGE[:TAG]

Create a tag TARGET_IMAGE that refers to SOURCE_IMAGE

Aliases:
  docker image tag, docker tag
`,
  rmi: `Usage:  docker image rm [OPTIONS] IMAGE [IMAGE...]

Remove one or more images

Aliases:
  docker image rm, docker image remove, docker rmi

Options:
  -f, --force      Force removal of the image
      --no-prune   Do not delete untagged parents
`,
  history: `Usage:  docker image history [OPTIONS] IMAGE

Show the history of an image

Aliases:
  docker image history, docker history

Options:
      --format string   Format output using a custom template:
                        'table':            Print output in table format with column headers (default)
                        'json':             Print in JSON format
  -H, --human           Print sizes and dates in human readable format (default true)
      --no-trunc        Don't truncate output
  -q, --quiet           Only show image IDs
`,
  inspect: `Usage:  docker inspect [OPTIONS] NAME|ID [NAME|ID...]

Return low-level information on Docker objects

Options:
  -f, --format string   Format output using a custom template:
                        'json':             Print in JSON format
                        'TEMPLATE':         Print output using the given Go template.
                        Refer to https://docs.docker.com/go/formatting/ for more information about formatting output with templates
  -s, --size            Display total file sizes if the type is container
      --type string     Return JSON for specified type
`,
  build: `Usage:  docker buildx build [OPTIONS] PATH | URL | -

Start a build

Aliases:
  docker build, docker builder build, docker image build, docker buildx b

Options:
      --add-host strings              Add a custom host-to-IP mapping (format: "host:ip")
      --build-arg stringArray         Set build-time variables
      --cache-from stringArray        External cache sources (e.g., "user/app:cache", "type=local,src=path/to/dir")
      --cache-to stringArray          Cache export destinations (e.g., "user/app:cache", "type=local,dest=path/to/dir")
  -f, --file string                   Name of the Dockerfile (default: "PATH/Dockerfile")
      --label stringArray             Set metadata for an image
      --load                          Shorthand for "--output=type=docker"
      --no-cache                      Do not use cache when building the image
      --platform stringArray          Set target platform for build
      --progress string               Set type of progress output ("auto", "quiet", "plain", "tty", "rawjson"). Use plain to show container output (default "auto")
      --pull                          Always attempt to pull all referenced images
      --push                          Shorthand for "--output=type=registry"
  -q, --quiet                         Suppress the build output and print image ID on success
      --secret stringArray            Secret to expose to the build (format: "id=mysecret[,src=/local/secret]")
  -t, --tag stringArray               Image identifier (format: "[registry/]repository[:tag]")
      --target string                 Set the target build stage to build
`,
  port: `Usage:  docker container port CONTAINER [PRIVATE_PORT[/PROTO]]

List port mappings or a specific mapping for the container

Aliases:
  docker container port, docker port
`,
  diff: `Usage:  docker container diff CONTAINER

Inspect changes to files or directories on a container's filesystem

Aliases:
  docker container diff, docker diff
`,
  top: `Usage:  docker container top CONTAINER [ps OPTIONS]

Display the running processes of a container

Aliases:
  docker container top, docker top
`,
  update: `Usage:  docker container update [OPTIONS] CONTAINER [CONTAINER...]

Update configuration of one or more containers

Aliases:
  docker container update, docker update

Options:
      --cpus decimal                   Number of CPUs
  -m, --memory bytes                   Memory limit
      --memory-swap bytes              Swap limit equal to memory plus swap: -1 to enable unlimited swap
      --pids-limit int                 Tune container pids limit (set -1 for unlimited)
      --restart string                 Restart policy to apply when a container exits
`,
  network: `Usage:  docker network COMMAND

Manage networks

Commands:
  connect     Connect a container to a network
  create      Create a network
  disconnect  Disconnect a container from a network
  inspect     Display detailed information on one or more networks
  ls          List networks
  prune       Remove all unused networks
  rm          Remove one or more networks

Run 'docker network COMMAND --help' for more information on a command.
`,
  'network create': `Usage:  docker network create [OPTIONS] NETWORK

Create a network

Options:
      --attachable           Enable manual container attachment
      --aux-address map      Auxiliary IPv4 or IPv6 addresses used by Network driver (default map[])
  -d, --driver string        Driver to manage the Network (default "bridge")
      --gateway strings      IPv4 or IPv6 Gateway for the master subnet
      --internal             Restrict external access to the network
      --ip-range strings     Allocate container ip from a sub-range
      --ipv6                 Enable or disable IPv6 networking
      --label list           Set metadata on a network
  -o, --opt map              Set driver specific options (default map[])
      --subnet strings       Subnet in CIDR format that represents a network segment
`,
  'network connect': `Usage:  docker network connect [OPTIONS] NETWORK CONTAINER

Connect a container to a network

Options:
      --alias strings           Add network-scoped alias for the container
      --ip string               IPv4 address (e.g., "172.30.100.104")
`,
  'network ls': `Usage:  docker network ls [OPTIONS]

List networks

Aliases:
  docker network ls, docker network list

Options:
  -f, --filter filter   Provide filter values (e.g. "driver=bridge")
      --format string   Format output using a custom template
      --no-trunc        Do not truncate the output
  -q, --quiet           Only display network IDs
`,
  volume: `Usage:  docker volume COMMAND

Manage volumes

Commands:
  create      Create a volume
  inspect     Display detailed information on one or more volumes
  ls          List volumes
  prune       Remove unused local volumes
  rm          Remove one or more volumes

Run 'docker volume COMMAND --help' for more information on a command.
`,
  'volume create': `Usage:  docker volume create [OPTIONS] [VOLUME]

Create a volume

Options:
  -d, --driver string   Specify volume driver name (default "local")
      --label list      Set metadata for a volume
  -o, --opt map         Set driver specific options (default map[])
`,
  'volume ls': `Usage:  docker volume ls [OPTIONS]

List volumes

Aliases:
  docker volume ls, docker volume list

Options:
  -f, --filter filter   Provide filter values (e.g. "dangling=true")
      --format string   Format output using a custom template
  -q, --quiet           Only display volume names
`,
  compose: `Usage:  docker compose [OPTIONS] COMMAND

Define and run multi-container applications with Docker

Options:
      --env-file stringArray       Specify an alternate environment file
  -f, --file stringArray           Compose configuration files
      --profile stringArray        Specify a profile to enable
  -p, --project-name string        Project name

Commands:
  config      Parse, resolve and render compose file in canonical format
  down        Stop and remove containers, networks
  exec        Execute a command in a running container
  logs        View output from containers
  ps          List containers
  up          Create and start containers

Run 'docker compose COMMAND --help' for more information on a command.
`,
  'compose up': `Usage:  docker compose up [OPTIONS] [SERVICE...]

Create and start containers

Options:
      --abort-on-container-exit   Stops all containers if any container was stopped. Incompatible with -d
      --build                     Build images before starting containers
  -d, --detach                    Detached mode: Run containers in the background
      --force-recreate            Recreate containers even if their configuration and image haven't changed
      --no-build                  Don't build an image, even if it's policy
      --no-deps                   Don't start linked services
      --no-recreate               If containers already exist, don't recreate them. Incompatible with --force-recreate.
      --pull string               Pull image before running ("always"|"missing"|"never") (default "policy")
      --remove-orphans            Remove containers for services not defined in the Compose file
  -t, --timeout int               Use this timeout in seconds for container shutdown when attached or when containers are already running
      --wait                      Wait for services to be running|healthy. Implies detached mode.
      --wait-timeout int          Maximum duration in seconds to wait for the project to be running|healthy
`,
  'compose down': `Usage:  docker compose down [OPTIONS] [SERVICES]

Stop and remove containers, networks

Options:
      --remove-orphans    Remove containers for services not defined in the Compose file
      --rmi string        Remove images used by services. "local" remove only images that don't have a custom tag ("local"|"all")
  -t, --timeout int       Specify a shutdown timeout in seconds
  -v, --volumes           Remove named volumes declared in the "volumes" section of the Compose file and anonymous volumes attached to containers
`,
  'compose ps': `Usage:  docker compose ps [OPTIONS] [SERVICE...]

List containers

Options:
  -a, --all                  Show all stopped containers (including those created by the run command)
      --format string        Format output using a custom template
  -q, --quiet                Only display IDs
      --services             Display services
`,
  'system df': `Usage:  docker system df [OPTIONS]

Show docker disk usage

Options:
      --format string   Format output using a custom template
  -v, --verbose         Show detailed information on space usage
`,
};

/** The help of a subcommand with unsimulated run/create flags printed faint. */
export function helpText(path: string): string | undefined {
  const text = HELP[path];
  if (!text) return undefined;
  if (path !== 'run' && path !== 'create') return text;
  return text
    .split('\n')
    .map((l) => {
      const m = /^\s+(?:-\w, )?--([\w-]+)/.exec(l);
      return m && !SIMULATED_RUN_FLAGS.has(m[1]) ? `\x1b[2m${l}\x1b[0m` : l;
    })
    .join('\n');
}
