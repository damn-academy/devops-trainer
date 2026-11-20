// Offline reference pages for roles, modules, moved, import and plan modes.
// Short summaries in the structure of the official pages (docs.ansible.com,
// opentofu.org), written for the course; the url points to the original.

import type { DocPage } from '../../core/types';

export const IAC_WEB_DOCS: DocPage[] = [
  {
    id: 'web/docs.ansible.com/roles',
    source: 'ansible-doc',
    title: 'Roles',
    url: 'https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_reuse_roles.html',
    license: 'GPL-3.0',
    version: 'ansible-core 2.19',
    sections: [
      { id: 'structure', title: 'Role directory structure', body: 'An Ansible role has a defined directory structure with seven main standard directories.\nYou must include at least one of these directories in each role. You can omit any\ndirectories the role does not use.\n\n    roles/\n        common/               # this hierarchy represents a "role"\n            tasks/main.yml    # the main list of tasks that the role executes\n            handlers/main.yml # handlers, which may be used within or outside this role\n            templates/        # files for use with the template resource\n            files/            # files for use with the copy resource\n            vars/main.yml     # other variables associated with this role\n            defaults/main.yml # default lower priority variables for this role\n            meta/main.yml     # role dependencies and optional Galaxy info' },
      { id: 'search', title: 'Storing and finding roles', body: 'By default, Ansible looks for roles in the following locations:\n  - in collections, if you are using them\n  - in a directory called roles/, relative to the playbook file\n  - in the configured roles_path (default: ~/.ansible/roles:/usr/share/ansible/roles:/etc/ansible/roles)\n  - in the directory where the playbook file is located\n\nIf a role is not found, the play fails before any task runs:\n    ERROR! the role \'webserver\' was not found in ...' },
      { id: 'using', title: 'Using roles at the play level', body: 'The classic way to use roles is with the roles option for a given play:\n\n    - hosts: webservers\n      roles:\n        - common\n        - role: webservers\n          vars:\n            http_port: 8080\n\nWhen you use the roles option at the play level, Ansible runs, for each play:\n  - any pre_tasks defined in the play\n  - any handlers triggered by pre_tasks\n  - each role listed in roles:, in the order listed; role dependencies from meta/main.yml run first\n  - any tasks defined in the play\n  - any handlers triggered by the roles or tasks\n  - any post_tasks defined in the play\n  - any handlers triggered by post_tasks\n\nThe meta: flush_handlers task runs the handlers notified so far at that point.\n\nTasks of a role are shown as TASK [role_name : task name].' },
      { id: 'defaults-vars', title: 'defaults and vars', body: 'Variables in defaults/main.yml have the lowest priority of any variables available, and can be\neasily overridden by any other variable, including inventory variables. Use them for everything\nthe user of the role is expected to change.\n\nVariables in vars/main.yml have a high priority: they override inventory variables and play vars.\nUse them for values the role relies on and the user should not change.\n\nTemplates and files referenced by tasks of a role are looked up in the role\'s templates/ and\nfiles/ directories first.' },
      { id: 'dependencies', title: 'Using role dependencies', body: 'Role dependencies are prerequisites, not true dependencies. They are stored in meta/main.yml:\n\n    dependencies:\n      - role: common\n\nAnsible always executes roles listed in dependencies before the role that lists them. A role\nthat appears several times in one play runs once.' },
      { id: 'skeleton', title: 'Creating a role skeleton', body: 'ansible-galaxy role init <name> creates the directory structure in the current directory\n(or in the directory given by --init-path).' },
    ],
  },
  {
    id: 'web/docs.ansible.com/variable-precedence',
    source: 'ansible-doc',
    title: 'Understanding variable precedence',
    url: 'https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_variables.html#understanding-variable-precedence',
    license: 'GPL-3.0',
    version: 'ansible-core 2.19',
    sections: [
      { id: 'ladder', title: 'Variable precedence (shortened)', body: 'Ansible does apply variable precedence. Here is the order of precedence from least to greatest\n(the last listed variables override all other variables):\n\n  1. command line values (for example, -u my_user, these are not variables)\n  2. role defaults (defined in role/defaults/main.yml)\n  3. inventory file or script group vars\n  4. inventory group_vars/all\n  5. inventory group_vars/*\n  6. inventory file or script host vars\n  7. inventory host_vars/*\n  8. host facts / cached set_facts\n  9. play vars\n 10. play vars_files\n 11. role vars (defined in role/vars/main.yml)\n 12. block vars (only for tasks in block)\n 13. task vars (only for the task)\n 14. set_facts / registered vars\n 15. role (and include_role) params\n 16. extra vars (for example, -e "user=my_user") (always win precedence)' },
      { id: 'scope', title: 'Tips on where to set variables', body: 'Set defaults in the role, override per group in group_vars/, per host in host_vars/, and keep\n-e for one-off runs. A host belongs to several groups: a child group overrides its parent, and\ngroups of the same level are merged in alphabetical order.' },
    ],
  },
  {
    id: 'web/opentofu.org/language/modules',
    source: 'terraform',
    title: 'Modules',
    url: 'https://opentofu.org/docs/language/modules/',
    license: 'MPL-2.0',
    version: 'OpenTofu 1.10',
    sections: [
      { id: 'overview', title: 'Modules', body: 'A module is a container for multiple resources that are used together. Every configuration has\nat least one module, the root module: the .tf files in the main working directory. A module can\ncall other modules, which lets you include the child module\'s resources in the configuration.' },
      { id: 'calling', title: 'Calling a child module', body: 'To call a module means to include the contents of that module into the configuration with\nspecific values for its input variables:\n\n    module "web" {\n      source     = "./modules/vm"\n      name       = "web"\n      network_id = edu_network.main.id\n    }\n\nThe label after the module keyword is a local name. Resources of the child module get addresses\nof the form module.<NAME>.<TYPE>.<NAME>, for example module.web.edu_vm.this.' },
      { id: 'source', title: 'Module sources', body: 'The source argument tells OpenTofu where to find the module. A local path must begin with ./ or\n../ to indicate that it is a local path. After adding, removing or changing a module block,\nrun tofu init (terraform init): it installs the modules into .terraform/modules.' },
      { id: 'inputs', title: 'Input variables', body: 'The arguments of a module block other than the meta-arguments (source, version, count,\nfor_each, depends_on, providers) set the module\'s input variables, declared inside it with\n\n    variable "cores" {\n      type    = number\n      default = 2\n    }\n\nA variable without a default is required: the call must set it. Inside the module the value is\nvar.cores.' },
      { id: 'outputs', title: 'Accessing module output values', body: 'The resources defined in a module are encapsulated, so the calling module cannot access their\nattributes directly. The child module can declare output values to selectively export:\n\n    output "ip" {\n      value = edu_vm.this.public_ip\n    }\n\nThe calling module refers to it as module.<NAME>.<OUTPUT>, for example module.web.ip.' },
    ],
  },
  {
    id: 'web/opentofu.org/language/moved',
    source: 'terraform',
    title: 'Refactoring: moved blocks',
    url: 'https://opentofu.org/docs/language/modules/develop/refactoring/',
    license: 'MPL-2.0',
    version: 'OpenTofu 1.10',
    sections: [
      { id: 'why', title: 'Refactoring', body: 'OpenTofu compares previous state with new configuration, correlating by each module or resource\'s\nunique address. Therefore by default OpenTofu understands moving or renaming an object as an intent\nto destroy the object at the old address and to create a new object at the new address.' },
      { id: 'moved', title: 'moved block syntax', body: 'A moved block expects no labels and contains only from and to arguments:\n\n    moved {\n      from = edu_vm.web\n      to   = module.web.edu_vm.this\n    }\n\nBefore creating a new plan, OpenTofu checks the state for an object at the from address and, if\nthere is one, records it at the to address instead. The plan shows\n    # edu_vm.web has moved to module.web.edu_vm.this\nand proposes no destroy and no create.' },
      { id: 'keep', title: 'Removing moved blocks', body: 'Keep moved blocks at least until every copy of the state (every environment) has been applied\nwith them. Removing a moved block too early makes the old address look like a destroy again.' },
      { id: 'state-mv', title: 'tofu state mv', body: 'tofu state mv SOURCE DESTINATION moves an object in the state without a code change in review.\nIt changes only the local or remote state; the moved block is preferred because it goes through\nreview and works for every copy of the state.' },
    ],
  },
  {
    id: 'web/opentofu.org/language/import',
    source: 'terraform',
    title: 'Import',
    url: 'https://opentofu.org/docs/language/import/',
    license: 'MPL-2.0',
    version: 'OpenTofu 1.10',
    sections: [
      { id: 'block', title: 'import block syntax', body: 'Use the import block to import existing infrastructure resources into OpenTofu, bringing them\nunder OpenTofu\'s management. Unlike the CLI command, configuration-driven import using import\nblocks is predictable, works with CI/CD pipelines, and lets you preview an import operation before\nmodifying state.\n\n    import {\n      to = edu_vm.legacy\n      id = "vm-4f91"\n    }\n\n    resource "edu_vm" "legacy" {\n      name       = "legacy"\n      image      = "debian-13"\n      cores      = 1\n      network_id = edu_network.main.id\n    }' },
      { id: 'plan', title: 'Plan and apply an import', body: 'The plan shows\n    # edu_vm.legacy will be imported\n    Plan: 1 to import, 0 to add, 0 to change, 0 to destroy.\nIf the configuration does not match the object, the plan also shows an update in place: correct\nthe configuration until the import is the only action, then apply.' },
      { id: 'config', title: 'Configuration is required', body: 'The resource block must exist before the import: OpenTofu attaches the object to it.\nImporting does not create anything: if no object with the given ID exists, the plan fails with\n    Error: Cannot import non-existent remote object' },
      { id: 'cli', title: 'tofu import', body: 'tofu import ADDRESS ID imports one object straight into the state, without a plan. It needs the\nsame resource block and is kept for scripts and older workflows.' },
    ],
  },
  {
    id: 'web/opentofu.org/language/lifecycle',
    source: 'terraform',
    title: 'The lifecycle meta-argument',
    url: 'https://opentofu.org/docs/language/meta-arguments/lifecycle/',
    license: 'MPL-2.0',
    version: 'OpenTofu 1.10',
    sections: [
      { id: 'syntax', title: 'Syntax and arguments', body: 'lifecycle is a nested block that can appear within a resource block. The lifecycle block and its\ncontents are meta-arguments, available for all resource blocks regardless of type.\n\n    resource "edu_vm" "web" {\n      # ...\n\n      lifecycle {\n        create_before_destroy = true\n      }\n    }' },
      { id: 'create_before_destroy', title: 'create_before_destroy', body: 'By default, when OpenTofu must change a resource argument that cannot be updated in-place due to\nremote API limitations, OpenTofu will instead destroy the existing object and then create a new\nreplacement object with the new configured arguments.\n\nThe create_before_destroy meta-argument changes this behavior so that the new replacement object\nis created first, and the prior object is destroyed after the replacement is created. Resources\nthat refer to the replaced object, such as a DNS record pointing at its address, are updated in\nthe same apply.' },
      { id: 'ignore_changes', title: 'ignore_changes', body: 'By default, OpenTofu detects any difference in the current settings of a real infrastructure\nobject and plans to update the remote object to match configuration. ignore_changes lists the\nattributes OpenTofu should ignore when planning updates, for example\n\n    ignore_changes = [cores]' },
    ],
  },
  {
    id: 'web/opentofu.org/cli/plan-modes',
    source: 'terraform',
    title: 'Command: plan — planning modes and exit codes',
    url: 'https://opentofu.org/docs/cli/commands/plan/',
    license: 'MPL-2.0',
    version: 'OpenTofu 1.10',
    sections: [
      { id: 'refresh-only', title: 'Refresh-only mode', body: '-refresh-only creates a plan whose goal is only to update the state and any root module output\nvalues to match changes made to remote objects outside of OpenTofu. This can be useful if you\'ve\nintentionally changed one or more remote objects outside of the usual workflow and you want to\nreconcile the state with those changes. It never proposes actions that change remote objects.' },
      { id: 'destroy', title: 'Destroy mode', body: '-destroy creates a plan whose goal is to destroy all remote objects that currently exist.' },
      { id: 'exit', title: 'Detailed exit codes', body: '-detailed-exitcode returns a detailed exit code when the command exits:\n  0 - Succeeded, diff is empty (no changes)\n  1 - Errored\n  2 - Succeeded, there is a diff\nA scheduled CI job that runs plan with this option fails on exit code 2 and so reports drift.' },
    ],
  },
];
