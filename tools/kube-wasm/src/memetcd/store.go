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

// Package memetcd is a small in-memory implementation of the subset of the
// etcd v3 gRPC API that kube-apiserver uses: KV (Range, Put, DeleteRange,
// Txn, Compact), Watch (with history replay, prev_kv and progress
// requests), Lease (grant, revoke, keep-alive, TTL expiry) and
// Maintenance.Status. It keeps a full MVCC history until the apiserver
// compacts it, so paginated and resource-version-pinned reads behave like
// they do against a real etcd.
package memetcd

import (
	"bytes"
	"encoding/json"
	"sort"
	"sync"
	"time"

	"github.com/google/btree"
	pb "go.etcd.io/etcd/api/v3/etcdserverpb"
	"go.etcd.io/etcd/api/v3/mvccpb"
	"go.etcd.io/etcd/api/v3/v3rpc/rpctypes"
)

// keyHistory holds every retained revision of one key, oldest first.
// A revision with a nil value marks a deletion (tombstone).
type keyHistory struct {
	key  []byte
	revs []*mvccpb.KeyValue // tombstones have Version == 0
}

func lessKey(a, b *keyHistory) bool { return bytes.Compare(a.key, b.key) < 0 }

// at returns the key-value visible at revision rev, or nil.
func (h *keyHistory) at(rev int64) *mvccpb.KeyValue {
	i := sort.Search(len(h.revs), func(i int) bool { return h.revs[i].ModRevision > rev }) - 1
	if i < 0 || h.revs[i].Version == 0 {
		return nil
	}
	return h.revs[i]
}

func (h *keyHistory) latest() *mvccpb.KeyValue {
	if len(h.revs) == 0 {
		return nil
	}
	kv := h.revs[len(h.revs)-1]
	if kv.Version == 0 {
		return nil
	}
	return kv
}

type lease struct {
	id     int64
	ttl    int64
	expiry time.Time
	keys   map[string]struct{}
}

// Store is the in-memory MVCC key-value store shared by all gRPC services.
type Store struct {
	mu         sync.Mutex
	keys       *btree.BTreeG[*keyHistory]
	rev        int64
	compactRev int64
	events     []*mvccpb.Event // ordered by Kv.ModRevision; PrevKv always filled when known
	notify     chan struct{}   // closed and replaced on every committed write
	leases     map[int64]*lease
	nextLease  int64
	bytes      int64
}

// NewStore returns an empty store at revision 1, like a fresh etcd member.
func NewStore() *Store {
	s := &Store{
		keys:      btree.NewG[*keyHistory](32, lessKey),
		rev:       1,
		notify:    make(chan struct{}),
		leases:    map[int64]*lease{},
		nextLease: 0x7a11 << 32,
	}
	go s.expireLeases()
	return s
}

func (s *Store) header() *pb.ResponseHeader {
	return &pb.ResponseHeader{ClusterId: clusterID, MemberId: memberID, Revision: s.rev, RaftTerm: 1}
}

// rangeKeys calls fn for every key in [key, end) following etcd range rules.
func (s *Store) rangeKeys(key, end []byte, fn func(h *keyHistory) bool) {
	pivot := &keyHistory{key: key}
	switch {
	case len(end) == 0:
		if h, ok := s.keys.Get(pivot); ok {
			fn(h)
		}
	case len(end) == 1 && end[0] == 0:
		s.keys.AscendGreaterOrEqual(pivot, fn)
	default:
		s.keys.AscendRange(pivot, &keyHistory{key: end}, fn)
	}
}

func (s *Store) rangeLocked(r *pb.RangeRequest) (*pb.RangeResponse, error) {
	rev := r.Revision
	if rev <= 0 {
		rev = s.rev
	}
	if rev > s.rev {
		return nil, rpctypes.ErrGRPCFutureRev
	}
	if rev < s.compactRev {
		return nil, rpctypes.ErrGRPCCompacted
	}
	resp := &pb.RangeResponse{Header: s.header()}
	s.rangeKeys(r.Key, r.RangeEnd, func(h *keyHistory) bool {
		kv := h.at(rev)
		if kv == nil {
			return true
		}
		resp.Count++
		if r.CountOnly {
			return true
		}
		if r.Limit > 0 && int64(len(resp.Kvs)) >= r.Limit {
			resp.More = true
			return true
		}
		if r.KeysOnly {
			kv = &mvccpb.KeyValue{Key: kv.Key, CreateRevision: kv.CreateRevision, ModRevision: kv.ModRevision, Version: kv.Version, Lease: kv.Lease}
		}
		resp.Kvs = append(resp.Kvs, kv)
		return true
	})
	if r.SortOrder == pb.RangeRequest_DESCEND && r.SortTarget == pb.RangeRequest_KEY {
		for i, j := 0, len(resp.Kvs)-1; i < j; i, j = i+1, j-1 {
			resp.Kvs[i], resp.Kvs[j] = resp.Kvs[j], resp.Kvs[i]
		}
	}
	return resp, nil
}

// Range serves a read, optionally at a historical revision.
func (s *Store) Range(r *pb.RangeRequest) (*pb.RangeResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.rangeLocked(r)
}

// txnState accumulates writes of one transaction; they all share one revision.
type txnState struct {
	rev     int64
	written bool
	events  []*mvccpb.Event
}

func (s *Store) begin() *txnState { return &txnState{rev: s.rev + 1} }

func (s *Store) commit(t *txnState) {
	if !t.written {
		return
	}
	s.rev = t.rev
	s.events = append(s.events, t.events...)
	close(s.notify)
	s.notify = make(chan struct{})
}

func (s *Store) putLocked(t *txnState, r *pb.PutRequest) (*pb.PutResponse, error) {
	h, ok := s.keys.Get(&keyHistory{key: r.Key})
	var prev *mvccpb.KeyValue
	if ok {
		prev = h.latest()
	}
	value, leaseID := r.Value, r.Lease
	if r.IgnoreValue || r.IgnoreLease {
		if prev == nil {
			return nil, rpctypes.ErrGRPCKeyNotFound
		}
		if r.IgnoreValue {
			value = prev.Value
		}
		if r.IgnoreLease {
			leaseID = prev.Lease
		}
	}
	if leaseID != 0 {
		if _, ok := s.leases[leaseID]; !ok {
			return nil, rpctypes.ErrGRPCLeaseNotFound
		}
	}
	kv := &mvccpb.KeyValue{Key: r.Key, Value: value, ModRevision: t.rev, Version: 1, CreateRevision: t.rev, Lease: leaseID}
	if prev != nil {
		kv.CreateRevision = prev.CreateRevision
		kv.Version = prev.Version + 1
		s.bytes -= int64(len(prev.Value))
		if prev.Lease != 0 && prev.Lease != leaseID {
			if l := s.leases[prev.Lease]; l != nil {
				delete(l.keys, string(r.Key))
			}
		}
	}
	if !ok {
		h = &keyHistory{key: r.Key}
		s.keys.ReplaceOrInsert(h)
	}
	s.appendRev(h, kv)
	s.bytes += int64(len(value))
	if leaseID != 0 {
		s.leases[leaseID].keys[string(r.Key)] = struct{}{}
	}
	t.written = true
	t.events = append(t.events, &mvccpb.Event{Type: mvccpb.PUT, Kv: kv, PrevKv: prev})
	resp := &pb.PutResponse{}
	if r.PrevKv {
		resp.PrevKv = prev
	}
	return resp, nil
}

// appendRev adds kv as the newest revision of h, replacing an entry written
// earlier in the same transaction.
func (s *Store) appendRev(h *keyHistory, kv *mvccpb.KeyValue) {
	if n := len(h.revs); n > 0 && h.revs[n-1].ModRevision == kv.ModRevision {
		h.revs[n-1] = kv
		return
	}
	h.revs = append(h.revs, kv)
}

func (s *Store) deleteLocked(t *txnState, r *pb.DeleteRangeRequest) *pb.DeleteRangeResponse {
	resp := &pb.DeleteRangeResponse{}
	var targets []*keyHistory
	s.rangeKeys(r.Key, r.RangeEnd, func(h *keyHistory) bool {
		if h.latest() != nil {
			targets = append(targets, h)
		}
		return true
	})
	for _, h := range targets {
		prev := h.latest()
		tomb := &mvccpb.KeyValue{Key: h.key, ModRevision: t.rev}
		s.appendRev(h, tomb)
		s.bytes -= int64(len(prev.Value))
		if prev.Lease != 0 {
			if l := s.leases[prev.Lease]; l != nil {
				delete(l.keys, string(h.key))
			}
		}
		t.written = true
		t.events = append(t.events, &mvccpb.Event{Type: mvccpb.DELETE, Kv: tomb, PrevKv: prev})
		resp.Deleted++
		if r.PrevKv {
			resp.PrevKvs = append(resp.PrevKvs, prev)
		}
	}
	return resp
}

// Put writes a single key.
func (s *Store) Put(r *pb.PutRequest) (*pb.PutResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	t := s.begin()
	resp, err := s.putLocked(t, r)
	if err != nil {
		return nil, err
	}
	s.commit(t)
	resp.Header = s.header()
	return resp, nil
}

// DeleteRange deletes a key or a range of keys.
func (s *Store) DeleteRange(r *pb.DeleteRangeRequest) (*pb.DeleteRangeResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	t := s.begin()
	resp := s.deleteLocked(t, r)
	s.commit(t)
	resp.Header = s.header()
	return resp, nil
}

func compareInt(a, b int64) int {
	switch {
	case a < b:
		return -1
	case a > b:
		return 1
	}
	return 0
}

func (s *Store) compareLocked(c *pb.Compare) bool {
	match := func(kv *mvccpb.KeyValue) bool {
		var cmp int
		switch c.Target {
		case pb.Compare_VERSION:
			var v int64
			if kv != nil {
				v = kv.Version
			}
			cmp = compareInt(v, c.GetVersion())
		case pb.Compare_CREATE:
			var v int64
			if kv != nil {
				v = kv.CreateRevision
			}
			cmp = compareInt(v, c.GetCreateRevision())
		case pb.Compare_MOD:
			var v int64
			if kv != nil {
				v = kv.ModRevision
			}
			cmp = compareInt(v, c.GetModRevision())
		case pb.Compare_VALUE:
			if kv == nil {
				return false
			}
			cmp = bytes.Compare(kv.Value, c.GetValue())
		case pb.Compare_LEASE:
			var v int64
			if kv != nil {
				v = kv.Lease
			}
			cmp = compareInt(v, c.GetLease())
		}
		switch c.Result {
		case pb.Compare_EQUAL:
			return cmp == 0
		case pb.Compare_NOT_EQUAL:
			return cmp != 0
		case pb.Compare_GREATER:
			return cmp > 0
		case pb.Compare_LESS:
			return cmp < 0
		}
		return false
	}
	if len(c.RangeEnd) == 0 {
		var kv *mvccpb.KeyValue
		if h, ok := s.keys.Get(&keyHistory{key: c.Key}); ok {
			kv = h.latest()
		}
		return match(kv)
	}
	ok := true
	s.rangeKeys(c.Key, c.RangeEnd, func(h *keyHistory) bool {
		if kv := h.latest(); kv != nil && !match(kv) {
			ok = false
			return false
		}
		return true
	})
	return ok
}

func (s *Store) applyOps(t *txnState, ops []*pb.RequestOp) ([]*pb.ResponseOp, error) {
	out := make([]*pb.ResponseOp, 0, len(ops))
	for _, op := range ops {
		switch {
		case op.GetRequestRange() != nil:
			r := *op.GetRequestRange()
			r.Revision = 0
			resp, err := s.rangeLocked(&r)
			if err != nil {
				return nil, err
			}
			out = append(out, &pb.ResponseOp{Response: &pb.ResponseOp_ResponseRange{ResponseRange: resp}})
		case op.GetRequestPut() != nil:
			resp, err := s.putLocked(t, op.GetRequestPut())
			if err != nil {
				return nil, err
			}
			out = append(out, &pb.ResponseOp{Response: &pb.ResponseOp_ResponsePut{ResponsePut: resp}})
		case op.GetRequestDeleteRange() != nil:
			resp := s.deleteLocked(t, op.GetRequestDeleteRange())
			out = append(out, &pb.ResponseOp{Response: &pb.ResponseOp_ResponseDeleteRange{ResponseDeleteRange: resp}})
		case op.GetRequestTxn() != nil:
			resp, err := s.txnLocked(t, op.GetRequestTxn())
			if err != nil {
				return nil, err
			}
			out = append(out, &pb.ResponseOp{Response: &pb.ResponseOp_ResponseTxn{ResponseTxn: resp}})
		}
	}
	return out, nil
}

func (s *Store) txnLocked(t *txnState, r *pb.TxnRequest) (*pb.TxnResponse, error) {
	succeeded := true
	for _, c := range r.Compare {
		if !s.compareLocked(c) {
			succeeded = false
			break
		}
	}
	ops := r.Success
	if !succeeded {
		ops = r.Failure
	}
	responses, err := s.applyOps(t, ops)
	if err != nil {
		return nil, err
	}
	return &pb.TxnResponse{Succeeded: succeeded, Responses: responses}, nil
}

// Txn evaluates compares and applies one branch atomically.
func (s *Store) Txn(r *pb.TxnRequest) (*pb.TxnResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	t := s.begin()
	resp, err := s.txnLocked(t, r)
	if err != nil {
		// Roll back is not needed for the apiserver's usage: failing ops
		// (missing lease) are validated before any mutation in putLocked.
		return nil, err
	}
	s.commit(t)
	resp.Header = s.header()
	for _, op := range resp.Responses {
		setHeaders(op, resp.Header)
	}
	return resp, nil
}

func setHeaders(op *pb.ResponseOp, h *pb.ResponseHeader) {
	switch r := op.Response.(type) {
	case *pb.ResponseOp_ResponsePut:
		r.ResponsePut.Header = h
	case *pb.ResponseOp_ResponseDeleteRange:
		r.ResponseDeleteRange.Header = h
	case *pb.ResponseOp_ResponseRange:
		r.ResponseRange.Header = h
	case *pb.ResponseOp_ResponseTxn:
		r.ResponseTxn.Header = h
		for _, o := range r.ResponseTxn.Responses {
			setHeaders(o, h)
		}
	}
}

// Compact drops history older than rev.
func (s *Store) Compact(rev int64) (*pb.ResponseHeader, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if rev <= s.compactRev {
		return nil, rpctypes.ErrGRPCCompacted
	}
	if rev > s.rev {
		return nil, rpctypes.ErrGRPCFutureRev
	}
	s.compactRev = rev
	var dead []*keyHistory
	s.keys.Ascend(func(h *keyHistory) bool {
		// keep the newest revision <= rev and everything after it
		i := sort.Search(len(h.revs), func(i int) bool { return h.revs[i].ModRevision > rev }) - 1
		if i > 0 {
			h.revs = append([]*mvccpb.KeyValue(nil), h.revs[i:]...)
		}
		if len(h.revs) == 1 && h.revs[0].Version == 0 {
			dead = append(dead, h)
		}
		return true
	})
	for _, h := range dead {
		s.keys.Delete(h)
	}
	i := sort.Search(len(s.events), func(i int) bool { return s.events[i].Kv.ModRevision > rev })
	s.events = append([]*mvccpb.Event(nil), s.events[i:]...)
	return s.header(), nil
}

// Grant creates a lease.
func (s *Store) Grant(id, ttl int64) (*pb.LeaseGrantResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if id == 0 {
		s.nextLease++
		id = s.nextLease
	}
	if _, ok := s.leases[id]; ok {
		return nil, rpctypes.ErrGRPCLeaseExist
	}
	if ttl < 1 {
		ttl = 1
	}
	s.leases[id] = &lease{id: id, ttl: ttl, expiry: time.Now().Add(time.Duration(ttl) * time.Second), keys: map[string]struct{}{}}
	return &pb.LeaseGrantResponse{Header: s.header(), ID: id, TTL: ttl}, nil
}

// Revoke deletes a lease and every key attached to it.
func (s *Store) Revoke(id int64) (*pb.ResponseHeader, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.leases[id]; !ok {
		return nil, rpctypes.ErrGRPCLeaseNotFound
	}
	s.revokeLocked(id)
	return s.header(), nil
}

func (s *Store) revokeLocked(id int64) {
	l := s.leases[id]
	delete(s.leases, id)
	keys := make([]string, 0, len(l.keys))
	for k := range l.keys {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	t := s.begin()
	for _, k := range keys {
		s.deleteLocked(t, &pb.DeleteRangeRequest{Key: []byte(k)})
	}
	s.commit(t)
}

// KeepAlive refreshes a lease and returns its TTL (0 if it does not exist).
func (s *Store) KeepAlive(id int64) *pb.LeaseKeepAliveResponse {
	s.mu.Lock()
	defer s.mu.Unlock()
	resp := &pb.LeaseKeepAliveResponse{Header: s.header(), ID: id}
	if l, ok := s.leases[id]; ok {
		l.expiry = time.Now().Add(time.Duration(l.ttl) * time.Second)
		resp.TTL = l.ttl
	}
	return resp
}

// TimeToLive reports the remaining TTL of a lease.
func (s *Store) TimeToLive(r *pb.LeaseTimeToLiveRequest) *pb.LeaseTimeToLiveResponse {
	s.mu.Lock()
	defer s.mu.Unlock()
	resp := &pb.LeaseTimeToLiveResponse{Header: s.header(), ID: r.ID, TTL: -1}
	if l, ok := s.leases[r.ID]; ok {
		resp.TTL = int64(time.Until(l.expiry).Seconds())
		resp.GrantedTTL = l.ttl
		if r.Keys {
			for k := range l.keys {
				resp.Keys = append(resp.Keys, []byte(k))
			}
		}
	}
	return resp
}

// Leases lists all leases.
func (s *Store) Leases() *pb.LeaseLeasesResponse {
	s.mu.Lock()
	defer s.mu.Unlock()
	resp := &pb.LeaseLeasesResponse{Header: s.header()}
	for id := range s.leases {
		resp.Leases = append(resp.Leases, &pb.LeaseStatus{ID: id})
	}
	return resp
}

func (s *Store) expireLeases() {
	for range time.Tick(time.Second) {
		now := time.Now()
		s.mu.Lock()
		for id, l := range s.leases {
			if now.After(l.expiry) {
				s.revokeLocked(id)
			}
		}
		s.mu.Unlock()
	}
}

// Status reports store-level numbers used for apiserver metrics and
// feature detection.
func (s *Store) Status() *pb.StatusResponse {
	s.mu.Lock()
	defer s.mu.Unlock()
	return &pb.StatusResponse{
		Header:      s.header(),
		Version:     etcdVersion,
		DbSize:      s.bytes,
		DbSizeInUse: s.bytes,
		Leader:      memberID,
		RaftIndex:   uint64(s.rev),
		RaftTerm:    1,
	}
}

// eventsSince returns events with revision in [from, s.rev] that fall in
// the key range, the current revision, and whether from is compacted.
func (s *Store) eventsSince(from int64, key, end []byte) ([]*mvccpb.Event, int64, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if from <= s.compactRev {
		return nil, s.rev, true
	}
	i := sort.Search(len(s.events), func(i int) bool { return s.events[i].Kv.ModRevision >= from })
	var out []*mvccpb.Event
	for _, ev := range s.events[i:] {
		if inRange(ev.Kv.Key, key, end) {
			out = append(out, ev)
		}
	}
	return out, s.rev, false
}

func (s *Store) current() (int64, chan struct{}) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.rev, s.notify
}

func inRange(k, key, end []byte) bool {
	switch {
	case len(end) == 0:
		return bytes.Equal(k, key)
	case len(end) == 1 && end[0] == 0:
		return bytes.Compare(k, key) >= 0
	default:
		return bytes.Compare(k, key) >= 0 && bytes.Compare(k, end) < 0
	}
}

// snapshot is the serialised form of a Store: the newest revision of every
// live key. History, leases and watchers are not kept.
type snapshot struct {
	Rev int64              `json:"rev"`
	KVs []*mvccpb.KeyValue `json:"kvs"`
}

// Snapshot serialises the current contents of the store.
func (s *Store) Snapshot() ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	snap := snapshot{Rev: s.rev}
	s.keys.Ascend(func(h *keyHistory) bool {
		if kv := h.latest(); kv != nil {
			snap.KVs = append(snap.KVs, kv)
		}
		return true
	})
	return json.Marshal(snap)
}

// NewStoreFrom returns a store holding a Snapshot. Keys lose their leases
// (the leases are gone), and history before the snapshot revision reads as
// compacted, so watchers from older revisions relist.
func NewStoreFrom(data []byte) (*Store, error) {
	var snap snapshot
	if err := json.Unmarshal(data, &snap); err != nil {
		return nil, err
	}
	s := NewStore()
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, kv := range snap.KVs {
		kv.Lease = 0
		s.keys.ReplaceOrInsert(&keyHistory{key: kv.Key, revs: []*mvccpb.KeyValue{kv}})
		s.bytes += int64(len(kv.Value))
	}
	s.rev, s.compactRev = snap.Rev, snap.Rev
	return s, nil
}
