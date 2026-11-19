// Offline pages of the methodology's own documentation for the doc ladder
// (07 §6): the Scrum Guide and the Kanban Guide (both CC BY-SA 4.0, quoted
// in short fragments with attribution), and reading notes on the SRE
// Workbook's error budget policy (a summary, not a copy). Each page is split
// into sections so DL2 tasks can point at a section and highlight a line.

import type { DocPage } from '../../core/types';

export const docs: DocPage[] = [
  {
    id: 'web/scrumguides.org/scrum-guide',
    source: 'scrum-guide',
    title: 'The Scrum Guide (2020)',
    url: 'https://scrumguides.org/scrum-guide.html',
    license: 'CC BY-SA 4.0, Ken Schwaber and Jeff Sutherland; quoted in fragments',
    version: '2020',
    sections: [
      {
        id: 'DEFINITION',
        title: 'Scrum Definition',
        body: 'Scrum is a lightweight framework that helps people, teams and organizations generate value through adaptive solutions for complex problems.\nThe Scrum framework is purposefully incomplete, only defining the parts required to implement Scrum theory.',
      },
      {
        id: 'TEAM',
        title: 'Scrum Team',
        body: 'The fundamental unit of Scrum is a small team of people, a Scrum Team.\nThe Scrum Team consists of one Scrum Master, one Product Owner, and Developers.\nWithin a Scrum Team, there are no sub-teams or hierarchies.\nThe Scrum Team is small enough to remain nimble and large enough to complete significant work within a Sprint, typically 10 or fewer people.\nThe Product Owner is accountable for maximizing the value of the product resulting from the work of the Scrum Team.\nThe Scrum Master is accountable for establishing Scrum as defined in the Scrum Guide.\nDevelopers are the people in the Scrum Team that are committed to creating any aspect of a usable Increment each Sprint.',
      },
      {
        id: 'EVENTS',
        title: 'Scrum Events',
        body: 'The Sprint is a container for all other events.\nSprints are fixed length events of one month or less to create consistency.\nSprint Planning initiates the Sprint by laying out the work to be performed for the Sprint.\nThe Daily Scrum is a 15-minute event for the Developers of the Scrum Team.\nThe purpose of the Sprint Review is to inspect the outcome of the Sprint and determine future adaptations.\nThe purpose of the Sprint Retrospective is to plan ways to increase quality and effectiveness.',
      },
      {
        id: 'ARTIFACTS',
        title: 'Scrum Artifacts',
        body: 'Each artifact contains a commitment to ensure it provides information that enhances transparency and focus against which progress can be measured:\n  For the Product Backlog it is the Product Goal.\n  For the Sprint Backlog it is the Sprint Goal.\n  For the Increment it is the Definition of Done.',
      },
    ],
  },
  {
    id: 'web/kanbanguides.org/kanban-guide',
    source: 'kanban-guide',
    title: 'The Kanban Guide',
    url: 'https://kanbanguides.org/english/',
    license: 'CC BY-SA 4.0, Daniel Vacanti and Jim Coleman; quoted in fragments',
    sections: [
      {
        id: 'DEFINITION',
        title: 'Definition of Kanban',
        body: 'Kanban is a strategy for optimizing the flow of value through a process that uses a visual, pull-based system.\nThe Kanban practices are: defining and visualizing a workflow; actively managing items in a workflow; improving the workflow.',
      },
      {
        id: 'WORKFLOW',
        title: 'Definition of Workflow (DoW)',
        body: 'The minimum elements of a Definition of Workflow are:\n  a definition of the units of value that are moving through the workflow (work items);\n  a definition for when work items are started and finished within the workflow;\n  one or more defined states that the work items flow through from started to finished;\n  a definition of how WIP will be controlled from started to finished;\n  explicit policies about how work items can flow through each state from started to finished;\n  a service level expectation (SLE), which is a forecast of how long it should take a work item to flow from started to finished.',
      },
      {
        id: 'MEASURES',
        title: 'Flow Measures',
        body: 'The four mandatory flow measures to track are:\n  WIP: the number of work items started but not finished.\n  Throughput: the number of work items finished per unit of time.\n  Work Item Age: the amount of elapsed time between when a work item started and the current time.\n  Cycle Time: the amount of elapsed time between when a work item started and when a work item finished.',
      },
    ],
  },
  {
    id: 'web/sre.google/workbook/error-budget-policy',
    source: 'sre-book',
    title: 'The Site Reliability Workbook — Example Error Budget Policy (reading notes)',
    url: 'https://sre.google/workbook/error-budget-policy/',
    license: 'Summary of a chapter of "The Site Reliability Workbook" (O’Reilly, 2018), not a copy; read the original at the URL',
    sections: [
      { id: 'GOALS', title: 'Goals', body: 'Protect customers from repeated SLO misses.\nGive an incentive to balance reliability with other features.' },
      { id: 'NON-GOALS', title: 'Non-goals', body: 'The policy is not a punishment for missing SLOs.\nHalting change is undesirable; the policy gives teams permission to focus on reliability when the data says it is more important than other product features.' },
      {
        id: 'POLICY',
        title: 'SLO miss policy',
        body: 'If the service is performing at or above its SLO, releases (including data changes) proceed according to the release policy.\nIf the service has exceeded its error budget for the preceding four-week window, all changes and releases are halted other than P0 issues or security fixes until the service is back within its SLO.\nDepending upon the cause of the SLO miss, the team may devote additional resources to reliability instead of feature work.',
      },
      { id: 'OUTAGE', title: 'Outage policy', body: 'If a single incident consumes more than 20% of the error budget over four weeks, the team conducts a postmortem with at least one P0 action item to address the root cause.' },
    ],
  },
];
