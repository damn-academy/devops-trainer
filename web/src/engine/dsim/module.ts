// dsim — the Docker engine simulator (04 §11): the `docker` and `crun`
// commands, facts for checks and the `docker` setup hook for terminal
// sections. The hook also installs, on that machine only, a `curl` that knows
// Docker's addresses (see http.ts; the global curl belongs to sim-net).
//
// Setup (TerminalSetup.ext.docker):
//   { pull?: string[]; run?: string[]; busyPorts?: number[]; ipForward?: boolean; timeScale?: number }
// `pull` images into the local store, `run` docker command lines (as root,
// before the learner gets the prompt), mark host ports as taken by other
// programs, switch the host's ip_forward, scale the real-time wait of stops.

import { defineModule } from '../../core/define';
import type { SetupHook } from '../../core/types';
import { docker } from './cli';
import { crun } from './crun';
import { DSIM_DOCS } from './docs';
import { dockerOf, ensureDaemon } from './engine';
import { DSIM_FACTS } from './facts';
import { curl } from './http';

export interface DockerSetup {
  pull?: string[];
  run?: string[];
  busyPorts?: number[];
  ipForward?: boolean;
  timeScale?: number;
}

export const dockerSetup: SetupHook = {
  key: 'docker',
  async apply(m, value) {
    const v = (value ?? {}) as DockerSetup;
    const ds = dockerOf(m);
    // Docker labs use the curl that knows Docker's addresses (published ports, container IPs);
    // it is local to this machine, so the global curl of sim-net stays the default elsewhere.
    m.addLocalCommand?.(curl);
    if (v.timeScale !== undefined) ds.timeScale = v.timeScale;
    ensureDaemon(m, ds.s);
    if (v.busyPorts) ds.s.hostPortsBusy = [...v.busyPorts];
    if (v.ipForward !== undefined) ds.s.ipForward = v.ipForward;
    for (const ref of v.pull ?? []) await m.exec(`docker pull -q ${ref}`);
    for (const line of v.run ?? []) await m.exec(line);
  },
};

export default defineModule({
  commands: [docker, crun],
  facts: DSIM_FACTS,
  setup: [dockerSetup],
  docs: DSIM_DOCS,
});
