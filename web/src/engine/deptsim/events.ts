import type { SimOptions } from './types';

/** A format-specific scenario replaces the fixed paid-booth/CNCF premise. */
export function eventDepartment(options: SimOptions): string {
  const booth = options.eventFormat === 'booth';
  return `The learner manages events for the selected company. KubeCon starts in eight weeks. Two engineers have submitted talks; selection results arrive in two weeks. Nearby alternatives include two community days, three local meetups and an industry conference. Adapt audience and alternatives to the company's actual segment.
Participation format: ${booth ? 'booth. A booth is being considered, not prepaid. Ask for a quote and a complete budget before purchase; do not assume eligibility for a startup package.' : 'no booth. No booth has been booked or paid for. Plan prearranged meetings, talks, hallway conversations and small side events. Do not invent booth costs, badge scans or booth incidents.'}
Use only the company description for code model and foundation status. Do not assume CNCF membership or a project-area entitlement. A closed product has customers and users, not an open-source contributor community. Foundation benefits require verified eligibility, even for an open-source company.
Goal: confirmed meetings with unique target accounts, useful second conversations, qualified opportunities and a report comparing gross profit with full costs. Count one company as one account. Community contributions are a goal only for an open project.
Turns: preparation weeks, then half-days during the conference, then follow-up weeks. Track budget, staff time and fatigue, confirmed meetings, talk quality, follow-up within two working days, and opportunities after one to three months.
Hidden variables: meeting relevance, attendance, talk acceptance and quality, follow-up conversion and delayed opportunities. ${booth ? 'Also track booth demo reliability and staff readiness.' : 'Track meeting preparation and side-event attendance.'}
Event deck: accepted or rejected talk (weight 3); demo failure during a ${booth ? 'booth conversation' : 'scheduled meeting'} (3); partner offers a shared reception (2); half the meetings move (2); local organizer needs a replacement speaker (2); competitor announces an event (2); relevant engineer praises the product (1); cancelled flights (1); a target buyer is available while the team is busy (1).
Characters: founder, engineer-speaker, sales lead, local organizer, potential partner. A foundation project manager appears only if the company has a relevant eligible project.
Debrief: meeting quality, useful next steps, talks, timely follow-up, full costs and team fatigue. Evaluate community outcomes only where applicable. Choosing no booth is a valid outcome.`;
}
