/*
Copyright 2026 The damn.academy Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package memetcd

import (
	"context"
	"io"
	"net"
	"sync"
	"time"

	pb "go.etcd.io/etcd/api/v3/etcdserverpb"
	"go.etcd.io/etcd/api/v3/mvccpb"
	"go.etcd.io/etcd/api/v3/v3rpc/rpctypes"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/keepalive"
)

const (
	clusterID = 0x6b7562650a
	memberID  = 0x7761736d
	// etcdVersion is reported by Maintenance.Status. kube-apiserver uses it
	// to decide whether RequestWatchProgress is available (>= 3.4.31 / 3.5.13).
	etcdVersion = "3.6.5"
)

// Serve starts the etcd gRPC services for store on lis and returns the
// server so that callers can stop it.
func Serve(store *Store, lis net.Listener) *grpc.Server {
	// The etcd client pings every 30s; accept that like etcd does.
	srv := grpc.NewServer(grpc.KeepaliveEnforcementPolicy(keepalive.EnforcementPolicy{MinTime: 5 * time.Second, PermitWithoutStream: true}))
	pb.RegisterKVServer(srv, &kvServer{s: store})
	pb.RegisterWatchServer(srv, &watchServer{s: store})
	pb.RegisterLeaseServer(srv, &leaseServer{s: store})
	pb.RegisterMaintenanceServer(srv, &maintenanceServer{s: store})
	pb.RegisterClusterServer(srv, &clusterServer{s: store, url: "http://" + lis.Addr().String()})
	healthpb.RegisterHealthServer(srv, health.NewServer())
	go srv.Serve(lis) //nolint:errcheck // Serve returns when the listener closes
	return srv
}

type kvServer struct {
	pb.UnimplementedKVServer
	s *Store
}

func (k *kvServer) Range(_ context.Context, r *pb.RangeRequest) (*pb.RangeResponse, error) {
	return k.s.Range(r)
}

func (k *kvServer) Put(_ context.Context, r *pb.PutRequest) (*pb.PutResponse, error) {
	return k.s.Put(r)
}

func (k *kvServer) DeleteRange(_ context.Context, r *pb.DeleteRangeRequest) (*pb.DeleteRangeResponse, error) {
	return k.s.DeleteRange(r)
}

func (k *kvServer) Txn(_ context.Context, r *pb.TxnRequest) (*pb.TxnResponse, error) {
	return k.s.Txn(r)
}

func (k *kvServer) Compact(_ context.Context, r *pb.CompactionRequest) (*pb.CompactionResponse, error) {
	h, err := k.s.Compact(r.Revision)
	if err != nil {
		return nil, err
	}
	return &pb.CompactionResponse{Header: h}, nil
}

type leaseServer struct {
	pb.UnimplementedLeaseServer
	s *Store
}

func (l *leaseServer) LeaseGrant(_ context.Context, r *pb.LeaseGrantRequest) (*pb.LeaseGrantResponse, error) {
	return l.s.Grant(r.ID, r.TTL)
}

func (l *leaseServer) LeaseRevoke(_ context.Context, r *pb.LeaseRevokeRequest) (*pb.LeaseRevokeResponse, error) {
	h, err := l.s.Revoke(r.ID)
	if err != nil {
		return nil, err
	}
	return &pb.LeaseRevokeResponse{Header: h}, nil
}

func (l *leaseServer) LeaseKeepAlive(stream grpc.BidiStreamingServer[pb.LeaseKeepAliveRequest, pb.LeaseKeepAliveResponse]) error {
	for {
		req, err := stream.Recv()
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}
		if err := stream.Send(l.s.KeepAlive(req.ID)); err != nil {
			return err
		}
	}
}

func (l *leaseServer) LeaseTimeToLive(_ context.Context, r *pb.LeaseTimeToLiveRequest) (*pb.LeaseTimeToLiveResponse, error) {
	return l.s.TimeToLive(r), nil
}

func (l *leaseServer) LeaseLeases(context.Context, *pb.LeaseLeasesRequest) (*pb.LeaseLeasesResponse, error) {
	return l.s.Leases(), nil
}

type maintenanceServer struct {
	pb.UnimplementedMaintenanceServer
	s *Store
}

func (m *maintenanceServer) Status(context.Context, *pb.StatusRequest) (*pb.StatusResponse, error) {
	return m.s.Status(), nil
}

type clusterServer struct {
	pb.UnimplementedClusterServer
	s   *Store
	url string
}

func (c *clusterServer) MemberList(context.Context, *pb.MemberListRequest) (*pb.MemberListResponse, error) {
	s := c.s.Status()
	return &pb.MemberListResponse{
		Header:  s.Header,
		Members: []*pb.Member{{ID: memberID, Name: "kube-wasm", PeerURLs: []string{c.url}, ClientURLs: []string{c.url}}},
	}, nil
}

type watchServer struct {
	pb.UnimplementedWatchServer
	s *Store
}

// watcher is one watch on a stream; next is the first revision not yet sent.
type watcher struct {
	id       int64
	key, end []byte
	next     int64
	prevKV   bool
	noPut    bool
	noDelete bool
}

// watchStream multiplexes the watchers of one Watch RPC. Only the send loop
// calls stream.Send; the receive loop queues control responses.
type watchStream struct {
	s        *Store
	stream   grpc.BidiStreamingServer[pb.WatchRequest, pb.WatchResponse]
	mu       sync.Mutex
	watchers map[int64]*watcher
	nextID   int64
	control  []*pb.WatchResponse
	progress bool
	wake     chan struct{}
}

func (w *watchServer) Watch(stream grpc.BidiStreamingServer[pb.WatchRequest, pb.WatchResponse]) error {
	ws := &watchStream{s: w.s, stream: stream, watchers: map[int64]*watcher{}, wake: make(chan struct{}, 1)}
	errc := make(chan error, 2)
	go func() { errc <- ws.recvLoop() }()
	go func() { errc <- ws.sendLoop(stream.Context()) }()
	err := <-errc
	if err == io.EOF {
		return nil
	}
	return err
}

func (ws *watchStream) kick() {
	select {
	case ws.wake <- struct{}{}:
	default:
	}
}

func (ws *watchStream) recvLoop() error {
	for {
		req, err := ws.stream.Recv()
		if err != nil {
			return err
		}
		ws.mu.Lock()
		switch {
		case req.GetCreateRequest() != nil:
			cr := req.GetCreateRequest()
			rev, _ := ws.s.current()
			id := cr.WatchId
			if id == 0 {
				id = ws.nextID
				ws.nextID++
			}
			wt := &watcher{id: id, key: cr.Key, end: cr.RangeEnd, next: cr.StartRevision, prevKV: cr.PrevKv}
			if wt.next <= 0 {
				wt.next = rev + 1
			}
			for _, f := range cr.Filters {
				switch f {
				case pb.WatchCreateRequest_NOPUT:
					wt.noPut = true
				case pb.WatchCreateRequest_NODELETE:
					wt.noDelete = true
				}
			}
			ws.watchers[id] = wt
			ws.control = append(ws.control, &pb.WatchResponse{Header: hdr(rev), WatchId: id, Created: true})
		case req.GetCancelRequest() != nil:
			id := req.GetCancelRequest().WatchId
			delete(ws.watchers, id)
			rev, _ := ws.s.current()
			ws.control = append(ws.control, &pb.WatchResponse{Header: hdr(rev), WatchId: id, Canceled: true})
		case req.GetProgressRequest() != nil:
			ws.progress = true
		}
		ws.mu.Unlock()
		ws.kick()
	}
}

func hdr(rev int64) *pb.ResponseHeader {
	return &pb.ResponseHeader{ClusterId: clusterID, MemberId: memberID, Revision: rev, RaftTerm: 1}
}

func (ws *watchStream) sendLoop(ctx context.Context) error {
	for {
		_, notify := ws.s.current()
		ws.mu.Lock()
		control := ws.control
		ws.control = nil
		progress := ws.progress
		ws.progress = false
		watchers := make([]*watcher, 0, len(ws.watchers))
		for _, wt := range ws.watchers {
			watchers = append(watchers, wt)
		}
		ws.mu.Unlock()

		for _, resp := range control {
			if err := ws.stream.Send(resp); err != nil {
				return err
			}
		}
		for _, wt := range watchers {
			events, cur, compacted := ws.s.eventsSince(wt.next, wt.key, wt.end)
			if compacted {
				ws.mu.Lock()
				delete(ws.watchers, wt.id)
				ws.mu.Unlock()
				compactRev := ws.s.compactRevision()
				if err := ws.stream.Send(&pb.WatchResponse{Header: hdr(cur), WatchId: wt.id, CompactRevision: compactRev, Canceled: true, CancelReason: rpctypes.ErrCompacted.Error()}); err != nil {
					return err
				}
				continue
			}
			wt.next = cur + 1
			out := filterEvents(events, wt)
			if len(out) == 0 {
				continue
			}
			if err := ws.stream.Send(&pb.WatchResponse{Header: hdr(cur), WatchId: wt.id, Events: out}); err != nil {
				return err
			}
		}
		if progress {
			// Report the newest revision every watcher of the stream has
			// been brought up to, as etcd does for RequestProgress.
			rev, _ := ws.s.current()
			for _, wt := range watchers {
				if wt.next-1 < rev {
					rev = wt.next - 1
				}
			}
			if err := ws.stream.Send(&pb.WatchResponse{Header: hdr(rev), WatchId: -1}); err != nil {
				return err
			}
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-notify:
		case <-ws.wake:
		}
	}
}

func filterEvents(events []*mvccpb.Event, wt *watcher) []*mvccpb.Event {
	out := make([]*mvccpb.Event, 0, len(events))
	for _, ev := range events {
		if (ev.Type == mvccpb.PUT && wt.noPut) || (ev.Type == mvccpb.DELETE && wt.noDelete) {
			continue
		}
		if !wt.prevKV && ev.PrevKv != nil {
			ev = &mvccpb.Event{Type: ev.Type, Kv: ev.Kv}
		}
		out = append(out, ev)
	}
	return out
}

func (s *Store) compactRevision() int64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.compactRev
}
