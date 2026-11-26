import type { Trainer } from './model';

const roles: Record<string, string> = {
  Kubernetes: 'platform engineer choosing cluster tooling; platform team lead evaluating support',
  PostgreSQL: 'DBA investigating slow queries; database lead planning a PostgreSQL migration',
  SRE: 'on-call engineer investigating alerts; reliability lead evaluating observability costs',
  Security: 'security engineer investigating supply-chain risk; security director evaluating compliance evidence',
  Networking: 'network engineer investigating routing failures; network operator planning peering capacity',
  'Vendor users': 'current customer with an upgrade problem; team lead evaluating a renewal',
  Other: 'technical user with an installation problem; buyer evaluating a pilot in the learner’s segment',
};
/** Replace the authored fixed KubeCon role list in both copy and connected-AI paths. */
export function eventVisitor(trainer: Trainer, venue: string, segment: string): Trainer {
  return { ...trainer, role: `You are a visitor at ${venue === 'Other' ? 'an industry conference' : venue}, ${segment === 'Other' ? 'in the learner’s own segment' : `in the ${segment} segment`}. Choose one hidden role: ${roles[segment] ?? roles.Other}; student collecting stickers; potential partner; competitor; trade journalist. Choose a buying stage and a concrete problem appropriate to that segment. Keep your role until debrief. Speak briefly. Reveal information only when asked a relevant question. Do not assume VMware, hosting, open source or foundation membership. Use the learner's language.` };
}
