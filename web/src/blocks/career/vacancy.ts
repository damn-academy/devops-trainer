// The vacancy analyzer (10 §9.7): the 60% rule made measurable. The learner
// pastes a vacancy; requirements are found by a dictionary mapped to course
// blocks and split into required and nice-to-have by the headings of the
// text; each is credited from the learner's progress. Apply at ≥ 60% overall
// and ≥ 50% of the required ones: requirements are inflated on purpose.

export interface VocabTerm {
  id: string;
  label: string;
  /** Regular expression body, matched case-insensitively on whole words. */
  re: string;
  /** Route block ids that teach it; empty for things outside the course. */
  blocks: string[];
  /** Any one of the blocks teaches it fully (Argo CD is taught both in CI-to-Kubernetes and in the cluster from code); otherwise all are needed. */
  anyBlock?: boolean;
}

export const VOCAB: VocabTerm[] = [
  { id: 'linux', label: 'Linux', re: 'linux|линукс|ubuntu|debian|centos|rhel|astra', blocks: ['linux'] },
  { id: 'bash', label: 'Bash', re: 'bash|shell|скрипт[а-я]*', blocks: ['linux'] },
  { id: 'systemd', label: 'systemd', re: 'systemd', blocks: ['linux'] },
  { id: 'ssh', label: 'SSH', re: 'ssh', blocks: ['linux'] },
  { id: 'networks', label: 'TCP/IP', re: 'tcp\\/ip|tcp|udp|сет[иья]|сетев[а-я]*|networking|network', blocks: ['networks'] },
  { id: 'dns', label: 'DNS', re: 'dns', blocks: ['networks'] },
  { id: 'http', label: 'HTTP', re: 'https?', blocks: ['networks'] },
  { id: 'tls', label: 'TLS/SSL', re: 'tls|ssl', blocks: ['networks'] },
  { id: 'nginx', label: 'nginx', re: 'nginx|haproxy', blocks: ['networks'] },
  { id: 'vpn', label: 'VPN', re: 'vpn|wireguard|openvpn', blocks: ['networks'] },
  { id: 'git', label: 'Git', re: 'git', blocks: ['git-yaml'] },
  { id: 'yaml', label: 'YAML', re: 'yaml', blocks: ['git-yaml'] },
  { id: 'docker', label: 'Docker', re: 'docker|контейнер[а-я]*|containers?|podman|containerd', blocks: ['containers'] },
  { id: 'compose', label: 'docker compose', re: 'docker[- ]compose|compose', blocks: ['containers'] },
  { id: 'cicd', label: 'CI/CD', re: 'ci\\/cd|ci|cd|пайплайн[а-я]*|конвейер[а-я]*|pipelines?', blocks: ['cicd'] },
  { id: 'gitlab-ci', label: 'GitLab CI', re: 'gitlab(?:[- ]ci)?', blocks: ['cicd'] },
  { id: 'gh-actions', label: 'GitHub Actions', re: 'github actions', blocks: ['cicd'] },
  { id: 'k8s', label: 'Kubernetes', re: 'kubernetes|k8s|кубернетес|openshift|k3s', blocks: ['k8s-1', 'k8s-2'] },
  { id: 'helm', label: 'Helm', re: 'helm', blocks: ['k8s-2'] },
  { id: 'argocd', label: 'Argo CD', re: 'argo ?cd|gitops|flux', blocks: ['cicd-k8s', 'k8s-3'], anyBlock: true },
  { id: 'kubeadm', label: 'kubeadm', re: 'kubeadm|cilium|calico|etcd', blocks: ['k8s-3'] },
  { id: 'terraform', label: 'Terraform', re: 'terraform|opentofu|terragrunt', blocks: ['iac'] },
  { id: 'ansible', label: 'Ansible', re: 'ansible', blocks: ['iac'] },
  { id: 'iac', label: 'IaC', re: 'iac|infrastructure as code|инфраструктур[а-я]* как код', blocks: ['iac'] },
  { id: 'prometheus', label: 'Prometheus', re: 'prometheus|promql|alertmanager|victoriametrics', blocks: ['monitoring'] },
  { id: 'grafana', label: 'Grafana', re: 'grafana', blocks: ['monitoring'] },
  { id: 'loki', label: 'Loki', re: 'loki', blocks: ['monitoring'] },
  { id: 'monitoring', label: 'monitoring', re: 'мониторинг[а-я]*|monitoring|observability|наблюдаемост[а-я]*', blocks: ['monitoring'] },
  { id: 'sre', label: 'SRE / SLO', re: 'sre|slo|sla|on-?call|дежурств[а-я]*|incident[a-z]*|инцидент[а-я]*', blocks: ['methodology'] },
  { id: 'agile', label: 'Agile / Kanban', re: 'agile|scrum|kanban|канбан', blocks: ['methodology'] },
  { id: 'python', label: 'Python', re: 'python', blocks: [] },
  { id: 'go', label: 'Go', re: 'golang', blocks: [] },
  { id: 'jenkins', label: 'Jenkins', re: 'jenkins|teamcity', blocks: [] },
  { id: 'zabbix', label: 'Zabbix', re: 'zabbix', blocks: [] },
  { id: 'elk', label: 'ELK', re: 'elk|elasticsearch|opensearch|kibana|logstash', blocks: [] },
  { id: 'cloud', label: 'public cloud', re: 'aws|gcp|azure|yandex ?cloud|яндекс[ .]?облак[а-я]*|vk cloud|selectel', blocks: [] },
  { id: 'sql', label: 'SQL databases', re: 'postgres(?:ql)?|mysql|mariadb|sql', blocks: [] },
  { id: 'redis', label: 'Redis / Kafka', re: 'redis|kafka|rabbitmq', blocks: [] },
  { id: 'vault', label: 'Vault', re: 'vault', blocks: [] },
  { id: 'virt', label: 'virtualization', re: 'kvm|vmware|proxmox|виртуализац[а-я]*|virtuali[sz]ation|openstack', blocks: [] },
];

const REQUIRED_HEAD = /(требовани|требуется|обязательн|ожидаем|ждём|ждем|нужно уметь|нужно знать|необходим|мы ищем|что нужно|ваш опыт|навыки|requirements|must have|you have|you need|you will need|what we expect|we are looking|qualifications|skills)/i;
const DESIRED_HEAD = /(будет плюсом|будет преимуществ|желательн|приветствуется|nice to have|bonus|preferred|a plus|would be great)/i;
const OTHER_HEAD = /(обязанност|задачи|чем заниматься|что делать|мы предлагаем|условия|responsibilities|what you will do|we offer|benefits|о компании|about us)/i;

export interface Requirement {
  term: VocabTerm;
  required: boolean;
  /** The line it was found on. */
  line: string;
}

function termRe(t: VocabTerm): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${t.re})(?![\\p{L}\\p{N}_])`, 'iu');
}

/**
 * Requirements in the text. A heading sets the mode of the lines under it
 * (required, nice-to-have, or other — duties and offers are not
 * requirements); a line that itself says "a plus" is nice-to-have. When a
 * term appears in both, the required mention wins. Without headings every
 * mention counts as required.
 */
export function extractRequirements(text: string, vocab: VocabTerm[] = VOCAB): Requirement[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const hasHeads = lines.some((l) => REQUIRED_HEAD.test(l) || DESIRED_HEAD.test(l));
  let mode: 'req' | 'des' | 'other' = 'req';
  const found = new Map<string, Requirement>();
  for (const line of lines) {
    const short = line.length < 60 || /:$/.test(line);
    if (short && DESIRED_HEAD.test(line)) mode = 'des';
    else if (short && REQUIRED_HEAD.test(line)) mode = 'req';
    else if (short && OTHER_HEAD.test(line)) mode = 'other';
    if (hasHeads && mode === 'other') continue;
    const required = mode === 'req' && !DESIRED_HEAD.test(line);
    for (const t of vocab) {
      if (!termRe(t).test(line)) continue;
      const prev = found.get(t.id);
      if (!prev || (required && !prev.required)) found.set(t.id, { term: t, required, line });
    }
  }
  // A more specific term covers its general neighbour on the same line (GitLab CI ⊃ CI/CD, Argo CD ⊃ CI/CD, docker compose ⊃ Docker).
  const covers: Record<string, string> = { 'gitlab-ci': 'cicd', 'gh-actions': 'cicd', argocd: 'cicd', compose: 'docker' };
  for (const [specific, general] of Object.entries(covers)) {
    const s = found.get(specific);
    const g = found.get(general);
    if (s && g && s.line === g.line) found.delete(general);
  }
  return [...found.values()];
}

export type Credit = 0 | 0.5 | 1;

export interface AnalysisRow {
  req: Requirement;
  credit: Credit;
  /** What the learner has: 'exam' | 'lessons' | 'started' | 'none' | 'outside', or 'known' for an outside skill the learner marked as theirs. */
  status: 'exam' | 'lessons' | 'started' | 'none' | 'outside' | 'known';
}

export interface Analysis {
  rows: AnalysisRow[];
  total: number;
  required: number;
  /** Whether the text separates required items from nice-to-have ones at all. */
  hasRequired: boolean;
  verdict: 'apply' | 'almost' | 'not-yet' | 'empty';
  /** Blocks to work on before the interview, most valuable first. */
  toLearn: string[];
  outside: string[];
}

export const APPLY_TOTAL = 0.6;
export const APPLY_REQUIRED = 0.5;

/**
 * stateOf(block) says what the learner has done in a course block; `known`
 * holds the ids of skills outside the course that the learner marked as
 * their own (experience from an earlier job).
 */
export function analyze(reqs: Requirement[], stateOf: (block: string) => 'exam' | 'lessons' | 'started' | 'none', known: ReadonlySet<string> = new Set()): Analysis {
  const rank = { none: 0, started: 1, lessons: 2, exam: 3 } as const;
  const rows: AnalysisRow[] = reqs.map((req) => {
    if (!req.term.blocks.length) return known.has(req.term.id) ? { req, credit: 1, status: 'known' } : { req, credit: 0, status: 'outside' };
    const states = req.term.blocks.map(stateOf);
    const best = req.term.anyBlock
      ? states.reduce((a, b) => (rank[b] > rank[a] ? b : a), 'none' as 'exam' | 'lessons' | 'started' | 'none')
      : states.includes('exam') ? 'exam' : states.every((s) => s === 'lessons' || s === 'exam') ? 'lessons' : states.some((s) => s !== 'none') ? 'started' : 'none';
    const credit: Credit = best === 'exam' || best === 'lessons' ? 1 : best === 'started' ? 0.5 : 0;
    return { req, credit, status: best };
  });
  // A required item weighs twice a nice-to-have one.
  const weight = (r: AnalysisRow) => (r.req.required ? 2 : 1);
  const mean = (xs: AnalysisRow[]) => {
    const w = xs.reduce((s, r) => s + weight(r), 0);
    return w ? xs.reduce((s, r) => s + weight(r) * r.credit, 0) / w : 0;
  };
  const req = rows.filter((r) => r.req.required);
  const total = mean(rows);
  const required = req.length ? mean(req) : total;
  const verdict = !rows.length ? 'empty' : total >= APPLY_TOTAL && required >= APPLY_REQUIRED ? 'apply' : total >= APPLY_TOTAL - 0.15 ? 'almost' : 'not-yet';
  const gain = new Map<string, number>();
  for (const r of rows) if (r.credit < 1) for (const b of r.req.term.blocks) gain.set(b, (gain.get(b) ?? 0) + (r.req.required ? 2 : 1) * (1 - r.credit));
  const toLearn = [...gain.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b);
  return { rows, total, required, hasRequired: req.length > 0 && req.length < rows.length, verdict, toLearn, outside: rows.filter((r) => r.status === 'outside').map((r) => r.req.term.label) };
}
