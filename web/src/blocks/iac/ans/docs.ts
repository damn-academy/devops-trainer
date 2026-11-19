// `ansible-doc` pages for the modules ansim implements. The text follows the
// module documentation of ansible-core (GPL-3.0, generated from the modules
// themselves), shortened to the options the simulator supports, with the real
// anatomy: OPTIONS ("=" required), ATTRIBUTES, NOTES, EXAMPLES, RETURN VALUES.

import type { DocPage } from '../../../core/types';

interface Opt {
  name: string;
  required?: boolean;
  text: string;
  type?: string;
  def?: string;
  choices?: string;
  aliases?: string;
}

function page(mod: string, short: string, desc: string, opts: Opt[], attrs: string, notes: string, examples: string, returns: string): DocPage {
  const options = opts
    .map((o) => `${o.required ? '=' : '-'} ${o.name}\n    ${o.text.split('\n').join('\n    ')}${o.aliases ? `\n    aliases: [${o.aliases}]` : ''}${o.choices ? `\n    choices: [${o.choices}]` : ''}${o.def !== undefined ? `\n    default: ${o.def}` : ''}\n    type: ${o.type ?? 'str'}`)
    .join('\n\n');
  return {
    id: `ansible-doc/ansible.builtin.${mod}`,
    source: 'ansible-doc',
    title: `ansible.builtin.${mod}`,
    url: `https://docs.ansible.com/ansible/latest/collections/ansible/builtin/${mod}_module.html`,
    license: 'GPL-3.0',
    version: 'ansible-core 2.19',
    sections: [
      { id: 'NAME', body: `ansible.builtin.${mod} - ${short}` },
      { id: 'DESCRIPTION', body: desc },
      { id: 'OPTIONS', title: 'OPTIONS (= indicates it is required)', body: options },
      { id: 'ATTRIBUTES', body: attrs },
      ...(notes ? [{ id: 'NOTES', body: notes }] : []),
      { id: 'EXAMPLES', body: examples },
      { id: 'RETURN VALUES', body: returns },
    ],
  };
}

const CHECK_DIFF = (check: string, diff: string) => `check_mode:\n    description: Can run in check_mode and return changed status prediction without modifying target.\n    support: ${check}\ndiff_mode:\n    description: Will return details on what has changed (or possibly needs changing in check_mode), when in diff mode.\n    support: ${diff}`;

export const ANSIBLE_DOCS: DocPage[] = [
  page(
    'apt',
    'Manages apt-packages',
    'Manages apt packages (such as for Debian/Ubuntu).',
    [
      { name: 'name', text: 'A list of package names, like `foo\', or package specifier with version, like `foo=1.0\'.', type: 'list', aliases: 'package, pkg' },
      { name: 'state', text: 'Indicates the desired package state. `latest\' ensures that the latest version is installed. `present\' does not upgrade if the package is already present.', choices: 'absent, latest, present', def: 'present' },
      { name: 'update_cache', text: 'Run the equivalent of `apt-get update\' before the operation.', type: 'bool', def: 'false' },
      { name: 'cache_valid_time', text: 'Update the apt cache if it is older than the `cache_valid_time\'. This option is set in seconds.', type: 'int', def: '0' },
    ],
    CHECK_DIFF('full', 'full'),
    'Three of the upgrade modes (`full\', `safe\' and its alias `true\') required `aptitude\' up to 2.3.',
    '- name: Install apache httpd (state=present is optional)\n  ansible.builtin.apt:\n    name: apache2\n    state: present\n\n- name: Update repositories cache and install "foo" package\n  ansible.builtin.apt:\n    name: foo\n    update_cache: yes',
    'cache_updated\n    if the cache was updated or not\n    returned: success, in some cases\n    type: bool',
  ),
  page(
    'copy',
    'Copy files to remote locations',
    'The `ansible.builtin.copy\' module copies a file from the local or remote machine to a location on the remote machine.\nUse the `ansible.builtin.fetch\' module to copy files from remote locations to the local box.\nIf you need variable interpolation in copied files, use the `ansible.builtin.template\' module.',
    [
      { name: 'dest', required: true, text: 'Remote absolute path where the file should be copied to.\nIf `src\' is a directory, this must be a directory too.', type: 'path' },
      { name: 'src', text: 'Local path to a file to copy to the remote server.\nThis can be absolute or relative; relative paths are looked up in files/ next to the playbook.', type: 'path' },
      { name: 'content', text: 'When used instead of `src\', sets the contents of a file directly to the specified value.' },
      { name: 'mode', text: 'The permissions the resulting filesystem object should have.\nFor those used to /usr/bin/chmod remember that modes are actually octal numbers. You must give Ansible enough information to parse them correctly: add a leading zero (for example, 0644) or quote it (like \'644\' or \'0644\').', type: 'raw' },
      { name: 'owner', text: 'Name of the user that should own the filesystem object.' },
    ],
    CHECK_DIFF('full', 'full'),
    '',
    '- name: Copy file with owner and permissions\n  ansible.builtin.copy:\n    src: /srv/myfiles/foo.conf\n    dest: /etc/foo.conf\n    owner: foo\n    mode: \'0644\'',
    'dest\n    Destination file/path.\n    returned: success\n    type: str',
  ),
  page(
    'template',
    'Template a file out to a target host',
    'Templates are processed by the Jinja2 templating language.\nDocumentation on the template formatting can be found in the Template Designer Documentation.\nAdditional variables listed below can be used in templates: `ansible_managed\', `template_host\', `template_path\'.',
    [
      { name: 'dest', required: true, text: 'Location to render the template to on the remote machine.', type: 'path' },
      { name: 'src', required: true, text: 'Path of a Jinja2 formatted template on the Ansible controller.\nThis can be a relative or an absolute path; relative paths are looked up in templates/ next to the playbook.', type: 'path' },
      { name: 'mode', text: 'The permissions the resulting filesystem object should have.', type: 'raw' },
    ],
    CHECK_DIFF('full', 'full'),
    'Including a string that uses a date in the template will result in the template being marked \'changed\' each time.',
    '- name: Template a file to /etc/file.conf\n  ansible.builtin.template:\n    src: /mytemplates/foo.j2\n    dest: /etc/file.conf\n    mode: \'0644\'',
    'dest\n    Destination file/path, equal to the value passed to dest.\n    returned: success\n    type: str',
  ),
  page(
    'service',
    'Manage services',
    'Controls services on remote hosts. Supported init systems include BSD init, OpenRC, SysV, Solaris SMF, systemd, upstart.',
    [
      { name: 'name', required: true, text: 'Name of the service.' },
      { name: 'state', text: '`started\'/`stopped\' are idempotent actions that will not run commands unless necessary.\n`restarted\' will always bounce the service.\n`reloaded\' will always reload.', choices: 'reloaded, restarted, started, stopped' },
      { name: 'enabled', text: 'Whether the service should start on boot.', type: 'bool' },
    ],
    CHECK_DIFF('full', 'none'),
    '',
    '- name: Start service httpd, if not started\n  ansible.builtin.service:\n    name: httpd\n    state: started\n\n- name: Enable service httpd, and not touch the state\n  ansible.builtin.service:\n    name: httpd\n    enabled: yes',
    '',
  ),
  page(
    'lineinfile',
    'Manage lines in text files',
    'This module ensures a particular line is in a file, or replace an existing line using a back-referenced regular expression.\nThis is primarily useful when you want to change a single line in a file only.\nSee the `ansible.builtin.replace\' module if you want to change multiple, similar lines or check `ansible.builtin.blockinfile\' if you want to insert/update/remove a block of lines in a file.\nFor other cases, see the `ansible.builtin.copy\' or `ansible.builtin.template\' modules.',
    [
      { name: 'path', required: true, text: 'The file to modify.', type: 'path', aliases: 'dest, destfile, name' },
      { name: 'line', text: 'The line to insert/replace into the file.\nRequired for `state=present\'.' },
      { name: 'regexp', text: 'The regular expression to look for in every line of the file.\nFor `state=present\', the pattern to replace if found. Only the last line found will be replaced.\nFor `state=absent\', the pattern of the line(s) to remove.', aliases: 'regex' },
      { name: 'state', text: 'Whether the line should be there or not.', choices: 'absent, present', def: 'present' },
      { name: 'create', text: 'Used with `state=present\'.\nIf specified, the file will be created if it does not already exist.\nBy default it will fail if the file is missing.', type: 'bool', def: 'false' },
    ],
    CHECK_DIFF('full', 'full'),
    '',
    '- name: Ensure SELinux is set to enforcing mode\n  ansible.builtin.lineinfile:\n    path: /etc/selinux/config\n    regexp: \'^SELINUX=\'\n    line: SELINUX=enforcing',
    '',
  ),
  page(
    'file',
    'Manage files and file properties',
    'Set attributes of files, directories, or symlinks and their targets.\nAlternatively, remove files, symlinks or directories.',
    [
      { name: 'path', required: true, text: 'Path to the file being managed.', type: 'path', aliases: 'dest, name' },
      { name: 'state', text: 'If `absent\', directories will be recursively deleted, and files or symlinks will be unlinked.\nIf `directory\', all intermediate subdirectories will be created if they do not exist.\nIf `touch\', an empty file will be created if the file does not exist.', choices: 'absent, directory, file, hard, link, touch', def: 'file' },
      { name: 'mode', text: 'The permissions the resulting filesystem object should have.', type: 'raw' },
    ],
    CHECK_DIFF('full', 'partial'),
    '',
    '- name: Create a directory if it does not exist\n  ansible.builtin.file:\n    path: /etc/some_directory\n    state: directory\n    mode: \'0755\'',
    '',
  ),
  page(
    'command',
    'Execute commands on targets',
    'The `ansible.builtin.command\' module takes the command name followed by a list of space-delimited arguments.\nThe command(s) will not be processed through the shell, so variables like `$HOSTNAME\' and operations like `"*"\', `"<"\', `">"\', `"|"\', `";"\' and `"&"\' will not work. Use the `ansible.builtin.shell\' module if you need these features.',
    [
      { name: 'cmd', text: 'The command to run.' },
      { name: 'creates', text: 'A filename or (since 2.0) glob pattern. If a matching file already exists, this step will not be run.', type: 'path' },
      { name: 'removes', text: 'A filename or (since 2.0) glob pattern. If a matching file exists, this step will be run.', type: 'path' },
      { name: 'chdir', text: 'Change into this directory before running the command.', type: 'path' },
    ],
    CHECK_DIFF('partial (while the command module does not support check mode, if `creates\'/`removes\' are passed it will not run them)', 'none'),
    'If you want to run a command through the shell (say you are using `<\', `>\', `|\', and so on), you actually want the `ansible.builtin.shell\' module instead.\nThe module reports changed for every run: it cannot know what the command did. Use `creates\', `removes\' or `changed_when\' to say when it changed something.',
    '- name: Run command if /path/to/database does not exist (without \'args\')\n  ansible.builtin.command: /usr/bin/make_database.sh db_user db_name creates=/path/to/database',
    'rc\n    The command return code (0 means success).\n    returned: always\n    type: int\nstdout\n    The command standard output.\n    returned: always\n    type: str',
  ),
  page(
    'shell',
    'Execute shell commands on targets',
    'The `ansible.builtin.shell\' module takes the command name followed by a list of space-delimited arguments.\nEither a free form command or `cmd\' parameter is required.\nIt is almost exactly like the `ansible.builtin.command\' module but runs the command through a shell (`/bin/sh\') on the remote node.',
    [
      { name: 'cmd', text: 'The command to run followed by optional arguments.' },
      { name: 'creates', text: 'A filename, when it already exists, this step will not be run.', type: 'path' },
      { name: 'chdir', text: 'Change into this directory before running the command.', type: 'path' },
    ],
    CHECK_DIFF('partial', 'none'),
    'If you want to execute a command securely and predictably, it may be better to use the `ansible.builtin.command\' module instead.',
    '- name: Execute the command in remote shell; stdout goes to the specified file on the remote\n  ansible.builtin.shell: somescript.sh >> somelog.txt',
    'rc\n    The command return code (0 means success).\n    returned: always\n    type: int',
  ),
  page(
    'ping',
    'Try to connect to host, verify a usable python and return pong on success',
    'A trivial test module, this module always returns `pong\' on successful contact. It does not make sense in playbooks, but it is useful from `/usr/bin/ansible\' to verify the ability to login and that a usable Python is configured.\nThis is NOT ICMP ping, this is just a trivial test module that requires Python on the remote-node.',
    [{ name: 'data', text: 'Data to return for the `ping\' return value.', def: 'pong' }],
    CHECK_DIFF('full', 'none'),
    '',
    '# Test we can logon to \'webservers\' and execute python with json lib.\n# ansible webservers -m ansible.builtin.ping',
    'ping\n    Value provided with the `data\' parameter.\n    returned: success\n    type: str\n    sample: pong',
  ),
  page(
    'debug',
    'Print statements during execution',
    'This module prints statements during execution and can be useful for debugging variables or expressions without necessarily halting the playbook.',
    [
      { name: 'msg', text: 'The customized message that is printed. If omitted, prints a generic message.', def: 'Hello world!' },
      { name: 'var', text: 'A variable name to debug.\nMutually exclusive with the `msg\' option.' },
    ],
    CHECK_DIFF('full', 'none'),
    '',
    '- name: Print the gateway for each host when defined\n  ansible.builtin.debug:\n    msg: System {{ inventory_hostname }} has gateway {{ ansible_default_ipv4.gateway }}',
    '',
  ),
  page(
    'user',
    'Manage user accounts',
    'Manage user accounts and user attributes.',
    [
      { name: 'name', required: true, text: 'Name of the user to create, remove or modify.', aliases: 'user' },
      { name: 'state', text: 'Whether the account should exist or not, taking action if the state is different from what is stated.', choices: 'absent, present', def: 'present' },
      { name: 'shell', text: 'Optionally set the user\'s shell.' },
      { name: 'groups', text: 'A list of supplementary groups which the user is also a member of.', type: 'list' },
      { name: 'append', text: 'If `true\', add the user to the groups specified in `groups\'.', type: 'bool', def: 'false' },
    ],
    CHECK_DIFF('full', 'none'),
    '',
    '- name: Add the user \'johnd\' with a specific shell\n  ansible.builtin.user:\n    name: johnd\n    shell: /bin/bash',
    '',
  ),
];

export function renderAnsibleDoc(p: DocPage): string {
  const get = (id: string) => p.sections.find((s) => s.id === id)?.body ?? '';
  const ind = (s: string) => s.split('\n').map((l) => (l ? `  ${l}` : '')).join('\n');
  return `> MODULE ${p.title} (/usr/lib/python3/dist-packages/ansible/modules/${p.title.split('.').pop()}.py)\n\n${ind(get('DESCRIPTION'))}\n\nOPTIONS (= indicates it is required):\n\n${get('OPTIONS')}\n\nATTRIBUTES:\n\n${ind(get('ATTRIBUTES'))}\n${get('NOTES') ? `\nNOTES:\n${ind(get('NOTES'))}\n` : ''}\nEXAMPLES:\n\n${get('EXAMPLES')}\n${get('RETURN VALUES') ? `\nRETURN VALUES:\n${ind(get('RETURN VALUES'))}\n` : ''}`;
}
