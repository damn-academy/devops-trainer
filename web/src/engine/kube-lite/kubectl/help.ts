// `kubectl <command> --help`, as kubectl v1.37 prints it (description,
// Examples, Options, Usage — the anatomy of 05 §7.1: kubectl puts examples
// before the flags and the Usage template at the end). The texts follow the
// upstream help of kubernetes/kubectl (Apache-2.0), shortened to the flags
// kube-lite supports plus the ones a doc-ladder task looks for.

import type { DocPage } from '../../../core/types';

const tail = (usage: string, cmd: string) => `\nUsage:\n  ${usage}\n\nUse "kubectl options" for a list of global command-line options (applies to all commands).\n`.replace('{cmd}', cmd);

export const HELP: Record<string, string> = {
  '': `kubectl controls the Kubernetes cluster manager.

 Find more information at: https://kubernetes.io/docs/reference/kubectl/

Basic Commands (Beginner):
  create          Create a resource from a file or from stdin
  expose          Take a replication controller, service, deployment or pod and expose it as a new Kubernetes service
  run             Run a particular image on the cluster
  set             Set specific features on objects

Basic Commands (Intermediate):
  explain         Get documentation for a resource
  get             Display one or many resources
  edit            Edit a resource on the server
  delete          Delete resources by file names, stdin, resources and names, or by resources and label selector

Deploy Commands:
  rollout         Manage the rollout of a resource
  scale           Set a new size for a deployment, replica set, or replication controller

Cluster Management Commands:
  cluster-info    Display cluster information
  top             Display resource (CPU/memory) usage
  cordon          Mark node as unschedulable
  uncordon        Mark node as schedulable
  drain           Drain node in preparation for maintenance
  taint           Update the taints on one or more nodes

Troubleshooting and Debugging Commands:
  describe        Show details of a specific resource or group of resources
  logs            Print the logs for a container in a pod
  exec            Execute a command in a container
  port-forward    Forward one or more local ports to a pod
  events          List events

Advanced Commands:
  apply           Apply a configuration to a resource by file name or stdin
  patch           Update fields of a resource
  wait            Experimental: Wait for a specific condition on one or many resources

Settings Commands:
  label           Update the labels on a resource
  annotate        Update the annotations on a resource

Other Commands:
  api-resources   Print the supported API resources on the server
  config          Modify kubeconfig files
  version         Print the client and server version information

Usage:
  kubectl [flags] [options]

Use "kubectl <command> --help" for more information about a given command.
Use "kubectl options" for a list of global command-line options (applies to all commands).
`,
  get: `Display one or many resources.

 Prints a table of the most important information about the specified resources. You can filter the list using a label selector and the --selector flag. If the desired resource type is namespaced you will only see results in the current namespace unless you pass --all-namespaces.

 By specifying the output as 'template' and providing a Go template as the value of the --template flag, you can filter the attributes of the fetched resources.

Use "kubectl api-resources" for a complete list of supported resources.

Examples:
  # List all pods in ps output format
  kubectl get pods

  # List all pods in ps output format with more information (such as node name)
  kubectl get pods -o wide

  # List a single replication controller with specified NAME in ps output format
  kubectl get replicationcontroller web

  # List deployments in JSON output format, in the "v1" version of the "apps" API group
  kubectl get deployments.v1.apps -o json

  # List a single pod in JSON output format
  kubectl get -o json pod web-pod-13je7

  # List resources from a directory with kustomization.yaml - e.g. dir/kustomization.yaml
  kubectl get -k dir/

  # Return only the phase value of the specified pod
  kubectl get -o template pod/web-pod-13je7 --template={{.status.phase}}

  # List resource information in custom columns
  kubectl get pod test-pod -o custom-columns=CONTAINER:.spec.containers[0].name,IMAGE:.spec.containers[0].image

  # List all replication controllers and services together in ps output format
  kubectl get rc,services

  # List one or more resources by their type and names
  kubectl get rc/web service/frontend pods/web-pod-13je7

  # List the 'status' subresource for a single pod
  kubectl get pod web-pod-13je7 --subresource status

Options:
    -A, --all-namespaces=false:
	If present, list the requested object(s) across all namespaces. Namespace in current context is ignored even if specified with --namespace.

    --field-selector='':
	Selector (field query) to filter on, supports '=', '==', and '!='.(e.g. --field-selector key1=value1,key2=value2). The server only supports a limited number of field queries per type.

    -f, --filename=[]:
	Filename, directory, or URL to files identifying the resource to get from a server.

    --no-headers=false:
	When using the default or custom-column output format, don't print headers (default print headers).

    -o, --output='':
	Output format. One of: (json, yaml, name, go-template, go-template-file, template, templatefile, jsonpath, jsonpath-as-json, jsonpath-file, custom-columns, custom-columns-file, wide). See custom columns [https://kubernetes.io/docs/reference/kubectl/#custom-columns], golang template [http://golang.org/pkg/text/template/#pkg-overview] and jsonpath template [https://kubernetes.io/docs/reference/kubectl/jsonpath/].

    -l, --selector='':
	Selector (label query) to filter on, supports '=', '==', '!=', 'in', 'notin'.(e.g. -l key1=value1,key2=value2,key3 in (value3)). Matching objects must satisfy all of the specified label constraints.

    --show-kind=false:
	If present, list the resource type for the requested object(s).

    --show-labels=false:
	When printing, show all labels as the last column (default hide labels column)

    --sort-by='':
	If non-empty, sort list types using this field specification.  The field specification is expressed as a JSONPath expression (e.g. '{.metadata.name}'). The field in the API resource specified by this JSONPath expression must be an integer or a string.

    -w, --watch=false:
	After listing/getting the requested object, watch for changes.

    -L, --label-columns=[]:
	Accepts a comma separated list of labels that are going to be presented as columns. Names are case-sensitive. You can also use multiple flag options like -L label1 -L label2...
${tail('kubectl get [(-o|--output=)json|yaml|name|go-template|go-template-file|template|templatefile|jsonpath|jsonpath-as-json|jsonpath-file|custom-columns|custom-columns-file|wide] (TYPE[.VERSION][.GROUP] [NAME | -l label] | TYPE[.VERSION][.GROUP]/NAME ...) [flags] [options]', 'get')}`,
  describe: `Show details of a specific resource or group of resources.

 Print a detailed description of the selected resources, including related resources such as events or controllers. You may select a single object by name, all objects of that type, provide a name prefix, or label selector. For example:

  $ kubectl describe TYPE NAME_PREFIX

 will first check for an exact match on TYPE and NAME_PREFIX. If no such resource exists, it will output details for every resource that has a name prefixed with NAME_PREFIX.

Use "kubectl api-resources" for a complete list of supported resources.

Examples:
  # Describe a node
  kubectl describe nodes kubernetes-node-emt8.c.myproject.internal

  # Describe a pod
  kubectl describe pods/nginx

  # Describe a pod identified by type and name in "pod.json"
  kubectl describe -f pod.json

  # Describe all pods
  kubectl describe pods

  # Describe pods by label name=myLabel
  kubectl describe pods -l name=myLabel

  # Describe all pods managed by the 'frontend' replication controller
  # (rc-created pods get the name of the rc as a prefix in the pod name)
  kubectl describe pods frontend

Options:
    -A, --all-namespaces=false:
	If present, list the requested object(s) across all namespaces. Namespace in current context is ignored even if specified with --namespace.

    -f, --filename=[]:
	Filename, directory, or URL to files containing the resource to describe

    -l, --selector='':
	Selector (label query) to filter on, supports '=', '==', '!=', 'in', 'notin'.

    --show-events=true:
	If true, display events related to the described object.
${tail('kubectl describe (-f FILENAME | TYPE [NAME_PREFIX | -l label] | TYPE/NAME) [options]', 'describe')}`,
  apply: `Apply a configuration to a resource by file name or stdin. The resource name must be specified. This resource will be created if it doesn't exist yet. To use 'apply', always create the resource initially with either 'apply' or 'create --save-config'.

 JSON and YAML formats are accepted.

 Alpha Disclaimer: the --prune functionality is not yet complete. Do not use unless you are aware of what the current state is. See https://issues.k8s.io/34274.

Examples:
  # Apply the configuration in pod.json to a pod
  kubectl apply -f ./pod.json

  # Apply resources from a directory containing kustomization.yaml - e.g. dir/kustomization.yaml
  kubectl apply -k dir/

  # Apply the JSON passed into stdin to a pod
  cat pod.json | kubectl apply -f -

  # Apply the configuration from all files that end with '.json'
  kubectl apply -f '*.json'

Options:
    --dry-run='none':
	Must be "none", "server", or "client". If client strategy, only print the object that would be sent, without sending it. If server strategy, submit server-side request without persisting the resource.

    -f, --filename=[]:
	The files that contain the configurations to apply.

    -o, --output='':
	Output format. One of: (json, yaml, name, go-template, go-template-file, template, templatefile, jsonpath, jsonpath-as-json, jsonpath-file).

    -R, --recursive=false:
	Process the directory used in -f, --filename recursively. Useful when you want to manage related manifests organized within the same directory.

    --server-side=false:
	If true, apply runs in the server instead of the client.
${tail('kubectl apply (-f FILENAME | -k DIRECTORY) [options]', 'apply')}`,
  create: `Create a resource from a file or from stdin.

 JSON and YAML formats are accepted.

Examples:
  # Create a pod using the data in pod.json
  kubectl create -f ./pod.json

  # Create a pod based on the JSON passed into stdin
  cat pod.json | kubectl create -f -

Available Commands:
  configmap             Create a config map from a local file, directory or literal value
  deployment            Create a deployment with the specified name
  job                   Create a job with the specified name
  namespace             Create a namespace with the specified name
  secret                Create a secret using a specified subcommand
  service               Create a service using a specified subcommand

Options:
    --dry-run='none':
	Must be "none", "server", or "client". If client strategy, only print the object that would be sent, without sending it.

    -f, --filename=[]:
	Filename, directory, or URL to files to use to create the resource

    -o, --output='':
	Output format. One of: (json, yaml, name, go-template, go-template-file, template, templatefile, jsonpath, jsonpath-as-json, jsonpath-file).
${tail('kubectl create -f FILENAME [options]', 'create')}`,
  'create deployment': `Create a deployment with the specified name.

Aliases:
deployment, deploy

Examples:
  # Create a deployment named my-dep that runs the busybox image
  kubectl create deployment my-dep --image=busybox

  # Create a deployment with a command
  kubectl create deployment my-dep --image=busybox -- date

  # Create a deployment named my-dep that runs the nginx image with 3 replicas
  kubectl create deployment my-dep --image=nginx --replicas=3

  # Create a deployment named my-dep that runs the busybox image and expose port 5701
  kubectl create deployment my-dep --image=busybox --port=5701

  # Create a deployment named my-dep that runs multiple containers
  kubectl create deployment my-dep --image=busybox:latest --image=ubuntu:latest --image=nginx

Options:
    --dry-run='none':
	Must be "none", "server", or "client". If client strategy, only print the object that would be sent, without sending it.

    --image=[]:
	Image names to run. A deployment can have multiple images set for multi-container pod.

    -o, --output='':
	Output format. One of: (json, yaml, name, go-template, go-template-file, template, templatefile, jsonpath, jsonpath-as-json, jsonpath-file).

    --port=-1:
	The containerPort that this deployment exposes.

    -r, --replicas=1:
	Number of replicas to create. Default is 1.
${tail('kubectl create deployment NAME --image=image -- [COMMAND] [args...] [options]', '')}`,
  'create service': `Create a service using a specified subcommand.

Aliases:
service, svc

Available Commands:
  clusterip       Create a ClusterIP service
  externalname    Create an ExternalName service
  loadbalancer    Create a LoadBalancer service
  nodeport        Create a NodePort service
${tail('kubectl create service [flags] [options]', '')}`,
  'create service clusterip': `Create a ClusterIP service with the specified name.

Examples:
  # Create a new ClusterIP service named my-cs
  kubectl create service clusterip my-cs --tcp=5678:8080

  # Create a new ClusterIP service named my-cs (in headless mode)
  kubectl create service clusterip my-cs --clusterip="None"

Options:
    --clusterip='':
	Assign your own ClusterIP or set to 'None' for a 'headless' service (no loadbalancing).

    --dry-run='none':
	Must be "none", "server", or "client". If client strategy, only print the object that would be sent, without sending it.

    --tcp=[]:
	Port pairs can be specified as '<port>:<targetPort>'.
${tail('kubectl create service clusterip NAME [--tcp=<port>:<targetPort>] [--dry-run=server|client|none] [options]', '')}`,
  'create service nodeport': `Create a NodePort service with the specified name.

Examples:
  # Create a new NodePort service named my-ns
  kubectl create service nodeport my-ns --tcp=5678:8080

Options:
    --node-port=0:
	Port used to expose the service on each node in a cluster.

    --tcp=[]:
	Port pairs can be specified as '<port>:<targetPort>'.
${tail('kubectl create service nodeport NAME [--tcp=port:targetPort] [--dry-run=server|client|none] [options]', '')}`,
  'create configmap': `Create a config map based on a file, directory, or specified literal value.

 A single config map may package one or more key/value pairs.

 When creating a config map based on a file, the key will default to the basename of the file, and the value will default to the file content.  If the basename is an invalid key, you may specify an alternate key.

 When creating a config map based on a directory, each file whose basename is a valid key in the directory will be packaged into the config map.  Any directory entries except regular files are ignored (e.g. subdirectories, symlinks, devices, pipes, etc).

Aliases:
configmap, cm

Examples:
  # Create a new config map named my-config based on folder bar
  kubectl create configmap my-config --from-file=path/to/bar

  # Create a new config map named my-config with specified keys instead of file basenames on disk
  kubectl create configmap my-config --from-file=key1=/path/to/bar/file1.txt --from-file=key2=/path/to/bar/file2.txt

  # Create a new config map named my-config with key1=config1 and key2=config2
  kubectl create configmap my-config --from-literal=key1=config1 --from-literal=key2=config2

  # Create a new config map named my-config from the key=value pairs in the file
  kubectl create configmap my-config --from-file=path/to/bar

  # Create a new config map named my-config from an env file
  kubectl create configmap my-config --from-env-file=path/to/foo.env --from-env-file=path/to/bar.env

Options:
    --from-env-file=[]:
	Specify the path to a file to read lines of key=val pairs to create a configmap.

    --from-file=[]:
	Key file can be specified using its file path, in which case file basename will be used as configmap key, or optionally with a key and file path, in which case the given key will be used.  Specifying a directory will iterate each named file in the directory whose basename is a valid configmap key.

    --from-literal=[]:
	Specify a key and literal value to insert in configmap (i.e. mykey=somevalue)
${tail('kubectl create configmap NAME [--from-file=[key=]source] [--from-literal=key1=value1] [--dry-run=server|client|none] [options]', '')}`,
  'create secret generic': `Create a secret based on a file, directory, or specified literal value.

 A single secret may package one or more key/value pairs.

 When creating a secret based on a file, the key will default to the basename of the file, and the value will default to the file content. If the basename is an invalid key or you wish to chose your own, you may specify an alternate key.

Examples:
  # Create a new secret named my-secret with keys for each file in folder bar
  kubectl create secret generic my-secret --from-file=path/to/bar

  # Create a new secret named my-secret with key1=supersecret and key2=topsecret
  kubectl create secret generic my-secret --from-literal=key1=supersecret --from-literal=key2=topsecret

Options:
    --from-env-file=[]:
	Specify the path to a file to read lines of key=val pairs to create a secret.

    --from-file=[]:
	Key files can be specified using their file path, in which case a default name will be given to them, or optionally with a name and file path, in which case the given name will be used.

    --from-literal=[]:
	Specify a key and literal value to insert in secret (i.e. mykey=somevalue)

    --type='':
	The type of secret to create
${tail('kubectl create secret generic NAME [--type=string] [--from-file=[key=]source] [--from-literal=key1=value1] [--dry-run=server|client|none] [options]', '')}`,
  'create namespace': `Create a namespace with the specified name.

Aliases:
namespace, ns

Examples:
  # Create a new namespace named my-namespace
  kubectl create namespace my-namespace
${tail('kubectl create namespace NAME [--dry-run=server|client|none] [options]', '')}`,
  run: `Create and run a particular image in a pod.

Examples:
  # Start a nginx pod
  kubectl run nginx --image=nginx

  # Start a hazelcast pod and let the container expose port 5701
  kubectl run hazelcast --image=hazelcast/hazelcast --port=5701

  # Start a hazelcast pod and set environment variables "DNS_DOMAIN=cluster" and "POD_NAMESPACE=default" in the container
  kubectl run hazelcast --image=hazelcast/hazelcast --env="DNS_DOMAIN=cluster" --env="POD_NAMESPACE=default"

  # Start a hazelcast pod and set labels "app=hazelcast" and "env=prod" in the container
  kubectl run hazelcast --image=hazelcast/hazelcast --labels="app=hazelcast,env=prod"

  # Dry run; print the corresponding API objects without creating them
  kubectl run nginx --image=nginx --dry-run=client

  # Start a busybox pod and keep it in the foreground, don't restart it if it exits
  kubectl run -i -t busybox --image=busybox --restart=Never

  # Start the nginx pod using the default command, but use custom arguments (arg1 .. argN) for that command
  kubectl run nginx --image=nginx -- <arg1> <arg2> ... <argN>

  # Start the nginx pod using a different command and custom arguments
  kubectl run nginx --image=nginx --command -- <cmd> <arg1> ... <argN>

Options:
    --command=false:
	If true and extra arguments are present, use them as the 'command' field in the container, rather than the 'args' field which is the default.

    --dry-run='none':
	Must be "none", "server", or "client". If client strategy, only print the object that would be sent, without sending it.

    --env=[]:
	Environment variables to set in the container.

    --image='':
	The image for the container to run.

    -l, --labels='':
	Comma separated labels to apply to the pod. Will override previous values.

    -o, --output='':
	Output format. One of: (json, yaml, name, go-template, go-template-file, template, templatefile, jsonpath, jsonpath-as-json, jsonpath-file).

    --port='':
	The port that this container exposes.

    --restart='Always':
	The restart policy for this Pod.  Legal values [Always, OnFailure, Never].
${tail('kubectl run NAME --image=image [--env="key=value"] [--port=port] [--dry-run=server|client] [--overrides=inline-json] [--command] -- [COMMAND] [args...] [options]', 'run')}`,
  expose: `Expose a resource as a new Kubernetes service.

 Looks up a deployment, service, replica set, replication controller or pod by name and uses the selector for that resource as the selector for a new service on the specified port. A deployment or replica set will be exposed as a service only if its selector is convertible to a selector that service supports, i.e. when the selector contains only the matchLabels component. Note that if no port is specified via --port and the exposed resource has multiple ports, all will be re-used by the new service. Also if no labels are specified, the new service will re-use the labels from the resource it exposes.

 Possible resources include (case insensitive):

 pod (po), service (svc), replicationcontroller (rc), deployment (deploy), replicaset (rs)

Examples:
  # Create a service for a replicated nginx, which serves on port 80 and connects to the containers on port 8000
  kubectl expose rc nginx --port=80 --target-port=8000

  # Create a service for a pod valid-pod, which serves on port 444 with the name "frontend"
  kubectl expose pod valid-pod --port=444 --name=frontend

  # Create a service for an nginx deployment, which serves on port 80 and connects to the containers on port 8000
  kubectl expose deployment nginx --port=80 --target-port=8000

Options:
    --name='':
	The name for the newly created object.

    --port='':
	The port that the service should serve on. Copied from the resource being exposed, if unspecified

    --protocol='':
	The network protocol for the service to be created. Default is 'TCP'.

    --target-port='':
	Name or number for the port on the container that the service should direct traffic to. Optional.

    --type='':
	Type for this service: ClusterIP, NodePort, LoadBalancer, or ExternalName. Default is 'ClusterIP'.
${tail('kubectl expose (-f FILENAME | TYPE NAME) [--port=port] [--protocol=TCP|UDP|SCTP] [--target-port=number-or-name] [--name=name] [--external-ip=external-ip-of-service] [--type=type] [options]', '')}`,
  scale: `Set a new size for a deployment, replica set, replication controller, or stateful set.

 Scale also allows users to specify one or more preconditions for the scale action.

 If --current-replicas or --resource-version is specified, it is validated before the scale is attempted, and it is guaranteed that the precondition holds true when the scale is sent to the server.

Examples:
  # Scale a replica set named 'foo' to 3
  kubectl scale --replicas=3 rs/foo

  # Scale a resource identified by type and name specified in "foo.yaml" to 3
  kubectl scale --replicas=3 -f foo.yaml

  # If the deployment named mysql's current size is 2, scale mysql to 3
  kubectl scale --current-replicas=2 --replicas=3 deployment/mysql

  # Scale multiple replication controllers
  kubectl scale --replicas=5 rc/example1 rc/example2 rc/example3

Options:
    --current-replicas=-1:
	Precondition for current size. Requires that the current size of the resource match this value in order to scale. -1 (default) for no condition.

    --replicas=0:
	The new desired number of replicas. Required.
${tail('kubectl scale [--resource-version=version] [--current-replicas=count] --replicas=COUNT (-f FILENAME | TYPE NAME) [options]', '')}`,
  delete: `Delete resources by file names, stdin, resources and names, or by resources and label selector.

 JSON and YAML formats are accepted. Only one type of argument may be specified: file names, resources and names, or resources and label selector.

 Some resources, such as pods, support graceful deletion. These resources define a default period before they are forcibly terminated (the grace period) but you may override that value with the --grace-period flag, or pass --now to set a grace-period of 1. Because these resources often represent entities in the cluster, deletion may not be acknowledged immediately. If the node hosting a pod is down or cannot reach the API server, termination may take significantly longer than the grace period. To force delete a resource, you must specify the --force flag.

 IMPORTANT: Force deleting pods does not wait for confirmation that the pod's processes have been terminated, which can leave those processes running until the node detects the deletion and completes graceful deletion.

Examples:
  # Delete a pod using the type and name specified in pod.json
  kubectl delete -f ./pod.json

  # Delete pods and services with same names "baz" and "foo"
  kubectl delete pod,service baz foo

  # Delete pods and services with label name=myLabel
  kubectl delete pods,services -l name=myLabel

  # Delete a pod with minimal delay
  kubectl delete pod foo --now

  # Force delete a pod on a dead node
  kubectl delete pod foo --force

  # Delete all pods
  kubectl delete pods --all

Options:
    --all=false:
	Delete all resources, in the namespace of the specified resource types.

    --cascade='background':
	Must be "background", "orphan", or "foreground". Selects the deletion cascading strategy for the dependents (e.g. Pods created by a ReplicationController). Defaults to background.

    -f, --filename=[]:
	containing the resource to delete.

    --force=false:
	If true, immediately remove resources from API and bypass graceful deletion. Note that immediate deletion of some resources may result in inconsistency or data loss and requires confirmation.

    --grace-period=-1:
	Period of time in seconds given to the resource to terminate gracefully. Ignored if negative. Set to 1 for immediate shutdown. Can only be set to 0 when --force is true (force deletion).

    --now=false:
	If true, resources are signaled for immediate shutdown (same as --grace-period=1).

    -l, --selector='':
	Selector (label query) to filter on, supports '=', '==', '!=', 'in', 'notin'.
${tail("kubectl delete ([-f FILENAME] | [-k DIRECTORY] | TYPE [(NAME | -l label | --all)]) [options]", '')}`,
  logs: `Print the logs for a container in a pod or specified resource. If the pod has only one container, the container name is optional.

Examples:
  # Return snapshot logs from pod nginx with only one container
  kubectl logs nginx

  # Return snapshot logs from pod nginx, prefixing each line with the source pod and container name
  kubectl logs nginx --prefix

  # Return snapshot logs from pod nginx with multi containers
  kubectl logs nginx --all-containers=true

  # Return snapshot logs from all containers in pods defined by label app=nginx
  kubectl logs -l app=nginx --all-containers=true

  # Return snapshot of previous terminated ruby container logs from pod web-1
  kubectl logs -p -c ruby web-1

  # Begin streaming the logs of the ruby container in pod web-1
  kubectl logs -f -c ruby web-1

  # Display only the most recent 20 lines of output in pod nginx
  kubectl logs --tail=20 nginx

  # Show all logs from pod nginx written in the last hour
  kubectl logs --since=1h nginx

  # Return snapshot logs from first container of a job named hello
  kubectl logs job/hello

  # Return snapshot logs from container nginx-1 of a deployment named nginx
  kubectl logs deployment/nginx -c nginx-1

Options:
    --all-containers=false:
	Get all containers' logs in the pod(s).

    -c, --container='':
	Print the logs of this container

    -f, --follow=false:
	Specify if the logs should be streamed.

    --prefix=false:
	Prefix each log line with the log source (pod name and container name)

    -p, --previous=false:
	If true, print the logs for the previous instance of the container in a pod if it exists.

    -l, --selector='':
	Selector (label query) to filter on, supports '=', '==', '!=', 'in', 'notin'.

    --tail=-1:
	Lines of recent log file to display. Defaults to -1 with no selector, showing all log lines otherwise 10, if a selector is provided.

    --timestamps=false:
	Include timestamps on each line in the log output
${tail('kubectl logs [-f] [-p] (POD | TYPE/NAME) [-c CONTAINER] [options]', '')}`,
  exec: `Execute a command in a container.

Examples:
  # Get output from running the 'date' command from pod mypod, using the first container by default
  kubectl exec mypod -- date

  # Get output from running the 'date' command in ruby-container from pod mypod
  kubectl exec mypod -c ruby-container -- date

  # Switch to raw terminal mode; sends stdin to 'bash' in ruby-container from pod mypod
  # and sends stdout/stderr from 'bash' back to the client
  kubectl exec mypod -c ruby-container -i -t -- bash -il

  # Get output from running 'date' command from the first pod of the deployment mydeployment, using the first container by default
  kubectl exec deploy/mydeployment -- date

  # Get output from running 'date' command from the first pod of the service myservice, using the first container by default
  kubectl exec svc/myservice -- date

Options:
    -c, --container='':
	Container name. If omitted, use the kubectl.kubernetes.io/default-container annotation for selecting the container to be attached or the first container in the pod will be chosen

    -i, --stdin=false:
	Pass stdin to the container

    -t, --tty=false:
	Stdin is a TTY
${tail('kubectl exec (POD | TYPE/NAME) [-c CONTAINER] [flags] -- COMMAND [args...] [options]', '')}`,
  rollout: `Manage the rollout of one or many resources.

 Valid resource types include:

  *  deployments
  *  daemonsets
  *  statefulsets

Examples:
  # Rollback to the previous deployment
  kubectl rollout undo deployment/abc

  # Check the rollout status of a daemonset
  kubectl rollout status daemonset/foo

  # Restart a deployment
  kubectl rollout restart deployment/abc

  # Restart deployments with the 'app=nginx' label
  kubectl rollout restart deployment --selector=app=nginx

Available Commands:
  history       View rollout history
  pause         Mark the provided resource as paused
  restart       Restart a resource
  resume        Resume a paused resource
  status        Show the status of the rollout
  undo          Undo a previous rollout
${tail('kubectl rollout SUBCOMMAND [options]', '')}`,
  'rollout status': `Show the status of the rollout.

 By default 'rollout status' will watch the status of the latest rollout until it's done. If you don't want to wait for the rollout to finish then you can use --watch=false. Note that if a new rollout starts in-between, then 'rollout status' will continue watching the latest revision. If you want to pin to a specific revision and abort if it is rolled over by another revision, use --revision=N where N is the revision you need to watch for.

Examples:
  # Watch the rollout status of a deployment
  kubectl rollout status deployment/nginx

Options:
    --revision=0:
	Pin to a specific revision for showing its status. Defaults to 0 (last revision).

    --timeout=0s:
	The length of time to wait before ending watch, zero means never. Any other values should contain a corresponding time unit (e.g. 1s, 2m, 3h).

    -w, --watch=true:
	Watch the status of the rollout until it's done.
${tail('kubectl rollout status (TYPE NAME | TYPE/NAME) [flags] [options]', '')}`,
  'rollout history': `View previous rollout revisions and configurations.

Examples:
  # View the rollout history of a deployment
  kubectl rollout history deployment/abc

  # View the details of daemonset revision 3
  kubectl rollout history daemonset/abc --revision=3

Options:
    --revision=0:
	See the details, including podTemplate of the revision specified
${tail('kubectl rollout history (TYPE NAME | TYPE/NAME) [flags] [options]', '')}`,
  'rollout undo': `Roll back to a previous rollout.

Examples:
  # Roll back to the previous deployment
  kubectl rollout undo deployment/abc

  # Roll back to daemonset revision 3
  kubectl rollout undo daemonset/abc --to-revision=3

  # Roll back to the previous deployment with dry-run
  kubectl rollout undo --dry-run=server deployment/abc

Options:
    --dry-run='none':
	Must be "none", "server", or "client". If client strategy, only print the object that would be sent, without sending it.

    --to-revision=0:
	The revision to rollback to. Default to 0 (last revision).
${tail('kubectl rollout undo (TYPE NAME | TYPE/NAME) [flags] [options]', '')}`,
  'rollout restart': `Restart a resource.

     Resource rollout will be restarted.

Examples:
  # Restart all deployments in the test-namespace namespace
  kubectl rollout restart deployment -n test-namespace

  # Restart a deployment
  kubectl rollout restart deployment/nginx
${tail('kubectl rollout restart RESOURCE [options]', '')}`,
  'set image': `Update existing container image(s) of resources.

 Possible resources include (case insensitive):

        pod (po), replicationcontroller (rc), deployment (deploy), daemonset (ds), statefulset (sts), cronjob (cj), replicaset (rs)

Examples:
  # Set a deployment's nginx container image to 'nginx:1.9.1', and its busybox container image to 'busybox'
  kubectl set image deployment/nginx busybox=busybox nginx=nginx:1.9.1

  # Update all deployments' and rc's nginx container's image to 'nginx:1.9.1'
  kubectl set image deployments,rc nginx=nginx:1.9.1 --all

  # Update image of all containers of daemonset abc to 'nginx:1.9.1'
  kubectl set image daemonset abc *=nginx:1.9.1
${tail('kubectl set image (-f FILENAME | TYPE NAME) CONTAINER_NAME_1=CONTAINER_IMAGE_1 ... CONTAINER_NAME_N=CONTAINER_IMAGE_N [options]', '')}`,
  label: `Update the labels on a resource.

  *  A label key and value must begin with a letter or number, and may contain letters, numbers, hyphens, dots, and underscores, up to 63 characters each.
  *  Optionally, the key can begin with a DNS subdomain prefix and a single '/', like example.com/my-app.
  *  If --overwrite is true, then existing labels can be overwritten, otherwise attempting to overwrite a label will result in an error.

Examples:
  # Update pod 'foo' with the label 'unhealthy' and the value 'true'
  kubectl label pods foo unhealthy=true

  # Update pod 'foo' with the label 'status' and the value 'unhealthy', overwriting any existing value
  kubectl label --overwrite pods foo status=unhealthy

  # Update a pod identified by the type and name in "pod.json"
  kubectl label -f pod.json status=unhealthy

  # Remove a label named 'bar' if it exists
  # Does not require the --overwrite flag
  kubectl label pods foo bar-

Options:
    --overwrite=false:
	If true, allow labels to be overwritten, otherwise reject label updates that overwrite existing labels.
${tail('kubectl label [--overwrite] (-f FILENAME | TYPE NAME) KEY_1=VAL_1 ... KEY_N=VAL_N [--resource-version=version] [options]', '')}`,
  explain: `Describe fields and structure of various resources.

 This command describes the fields associated with each supported API resource. Fields are identified via a simple JSONPath identifier:

        <type>.<fieldName>[.<fieldName>]

 Information about each field is retrieved from the server in OpenAPI format.

Use "kubectl api-resources" for a complete list of supported resources.

Examples:
  # Get the documentation of the resource and its fields
  kubectl explain pods

  # Get all the fields in the resource
  kubectl explain pods --recursive

  # Get the explanation for deployment in supported api versions
  kubectl explain deployments --api-version=apps/v1

  # Get the documentation of a specific field of a resource
  kubectl explain pods.spec.containers

Options:
    --recursive=false:
	When true, print the name of all the fields recursively. Otherwise, print the available fields with their description.
${tail('kubectl explain TYPE [--recursive=FALSE|TRUE] [--api-version=api-version-group] [-o|--output=plaintext|plaintext-openapiv2] [options]', '')}`,
  'port-forward': `Forward one or more local ports to a pod.

 Use resource type/name such as deployment/mydeployment to select a pod. Resource type defaults to 'pod' if omitted.

 If there are multiple pods matching the criteria, a pod will be selected automatically. The forwarding session ends when the selected pod terminates, and a rerun of the command is needed to resume forwarding.

Examples:
  # Listen on ports 5000 and 6000 locally, forwarding data to/from ports 5000 and 6000 in the pod
  kubectl port-forward pod/mypod 5000 6000

  # Listen on ports 5000 and 6000 locally, forwarding data to/from ports 5000 and 6000 in a pod selected by the deployment
  kubectl port-forward deployment/mydeployment 5000 6000

  # Listen on port 8443 locally, forwarding to the targetPort of the service's port named "https" in a pod selected by the service
  kubectl port-forward service/myservice 8443:https

  # Listen on port 8888 locally, forwarding to 5000 in the pod
  kubectl port-forward pod/mypod 8888:5000

Options:
    --address=[localhost]:
	Addresses to listen on (comma separated). Only accepts IP addresses or localhost as a value.
${tail('kubectl port-forward TYPE/NAME [options] [LOCAL_PORT:]REMOTE_PORT [...[LOCAL_PORT_N:]REMOTE_PORT_N]', '')}`,
  config: `Modify kubeconfig files using subcommands like "kubectl config set current-context my-context".

 The loading order follows these rules:

  1.  If the --kubeconfig flag is set, then only that file is loaded. The flag may only be set once and no merging takes place.
  2.  If $KUBECONFIG environment variable is set, then it is used as a list of paths (normal path delimiting rules for your system). These paths are merged.
  3.  Otherwise, \${HOME}/.kube/config is used and no merging takes place.

Available Commands:
  current-context   Display the current-context
  get-contexts      Describe one or many contexts
  set-context       Set a context entry in kubeconfig
  use-context       Set the current-context in a kubeconfig file
  view              Display merged kubeconfig settings or a specified kubeconfig file
${tail('kubectl config SUBCOMMAND [options]', '')}`,
  'config get-contexts': `Display one or many contexts from the kubeconfig file.

Examples:
  # List all the contexts in your kubeconfig file
  kubectl config get-contexts

  # Describe one context in your kubeconfig file
  kubectl config get-contexts my-context

Options:
    --no-headers=false:
	When using the default or custom-column output format, don't print headers (default print headers).

    -o, --output='':
	Output format. One of: (name).
${tail('kubectl config get-contexts [(-o|--output=)name)] [options]', '')}`,
  'config set-context': `Set a context entry in kubeconfig.

 Specifying a name that already exists will merge new fields on top of existing values for those fields.

Examples:
  # Set the user field on the gce context entry without touching other values
  kubectl config set-context gce --user=cluster-admin

Options:
    --cluster='':
	cluster for the context entry in kubeconfig

    --current=false:
	Modify the current context

    --namespace='':
	namespace for the context entry in kubeconfig

    --user='':
	user for the context entry in kubeconfig
${tail('kubectl config set-context [NAME | --current] [--cluster=cluster_nickname] [--user=user_nickname] [--namespace=namespace] [options]', '')}`,
  wait: `Experimental: Wait for a specific condition on one or many resources.

 The command takes multiple resources and waits until the specified condition is seen in the Status field of every given resource.

Examples:
  # Wait for the pod "busybox1" to contain the status condition of type "Ready"
  kubectl wait --for=condition=Ready pod/busybox1

  # Wait for the pod "busybox1" to be deleted, with a timeout of 60s, after having issued the "delete" command
  kubectl delete pod/busybox1
  kubectl wait --for=delete pod/busybox1 --timeout=60s

Options:
    --for='':
	The condition to wait on: [create|delete|condition=condition-name[=condition-value]|jsonpath='{JSONPath expression}'=[JSONPath value]]. The default condition-value is true.  Condition values are compared after Unicode simple case folding, which is a more general form of case-insensitivity.

    --timeout=30s:
	The length of time to wait before giving up.  Zero means check once and don't wait, negative means wait for a week.
${tail('kubectl wait ([-f FILENAME] | resource.group/resource.name | resource.group [(-l label | --all)]) [--for=create|--for=delete|--for condition=available|--for=jsonpath=\'{}\'[=value]] [options]', '')}`,
  patch: `Update fields of a resource using strategic merge patch, a JSON merge patch, or a JSON patch.

 JSON and YAML formats are accepted.

Examples:
  # Partially update a node using a strategic merge patch, specifying the patch as JSON
  kubectl patch node k8s-node-1 -p '{"spec":{"unschedulable":true}}'

  # Update a container's image; spec.containers[*].name is required because it's a merge key
  kubectl patch pod valid-pod -p '{"spec":{"containers":[{"name":"kubernetes-serve-hostname","image":"new image"}]}}'

Options:
    -p, --patch='':
	The patch to be applied to the resource JSON file.

    --type='strategic':
	The type of patch being provided; one of [json merge strategic]
${tail('kubectl patch (-f FILENAME | TYPE NAME) [-p PATCH|--patch-file FILE] [options]', '')}`,
  cordon: `Mark node as unschedulable.

Examples:
  # Mark node "foo" as unschedulable
  kubectl cordon foo
${tail('kubectl cordon NODE [options]', '')}`,
  drain: `Drain node in preparation for maintenance.

 The given node will be marked unschedulable to prevent new pods from arriving. 'drain' evicts the pods if the API server supports https://kubernetes.io/docs/concepts/workloads/pods/disruptions/ eviction. Otherwise, it will use normal DELETE to delete the pods. The 'drain' evicts or deletes all pods except mirror pods (which cannot be deleted through the API server).  If there are daemon set-managed pods, drain will not proceed without --ignore-daemonsets, and regardless it will not delete any daemon set-managed pods, because those pods would be immediately replaced by the daemon set controller, which ignores unschedulable markings.

Examples:
  # Drain node "foo", even if there are pods not managed by a replication controller, replica set, job, daemon set, or stateful set on it
  kubectl drain foo --force

Options:
    --force=false:
	Continue even if there are pods that do not declare a controller.

    --ignore-daemonsets=false:
	Ignore DaemonSet-managed pods.
${tail('kubectl drain NODE [options]', '')}`,
};

/** The page of kubectl reference on kubernetes.io for a (sub)command. */
export function helpUrl(cmd: string): string {
  const parts = cmd.split(' ');
  return `https://kubernetes.io/docs/reference/kubectl/generated/kubectl_${parts[0]}/${parts.length > 1 ? `kubectl_${parts.join('_')}/` : ''}`;
}

/** Corpus pages help/kubectl-<sub> (and help/kubectl for the root). */
export function helpPages(): DocPage[] {
  const pages: DocPage[] = [];
  for (const [cmd, text] of Object.entries(HELP)) {
    if (!cmd) continue;
    const id = `help/kubectl-${cmd.replace(/ /g, '-')}`;
    const sections: { id: string; title: string; body: string }[] = [];
    let cur = { id: 'DESCRIPTION', title: 'Description', lines: [] as string[] };
    for (const line of text.replace(/\n$/, '').split('\n')) {
      const m = /^(Examples|Options|Usage|Aliases|Available Commands):\s*$/.exec(line);
      if (m) {
        if (cur.lines.join('').trim()) sections.push({ id: cur.id, title: cur.title, body: cur.lines.join('\n').replace(/\n+$/, '') });
        cur = { id: m[1] === 'Examples' ? 'EXAMPLES' : m[1] === 'Options' ? 'OPTIONS' : m[1] === 'Usage' ? 'USAGE' : m[1].toUpperCase(), title: m[1], lines: [] };
      } else cur.lines.push(line);
    }
    if (cur.lines.join('').trim()) sections.push({ id: cur.id, title: cur.title, body: cur.lines.join('\n').replace(/\n+$/, '') });
    pages.push({ id, source: 'help', title: `kubectl ${cmd} --help`, url: helpUrl(cmd), version: 'v1.37', license: 'Apache-2.0 (kubectl help text)', sections });
  }
  return pages;
}
