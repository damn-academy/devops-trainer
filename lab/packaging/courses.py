#!/usr/bin/env python3
"""Create release bundles without staging a second copy of the site."""
import hashlib
import json
import pathlib
import re
import sys
import tarfile


def group(name):
    if name.startswith('v86/') or re.match(r'assets/(?:lib)?v86[^/]*\.(?:js|wasm)(?:\.map)?$', name):
        return 'v86'
    if name.startswith('rv64/') or re.match(r'assets/rv64[^/]*\.(?:js|wasm|bin|img)(?:\.map)?$', name):
        return 'rv64'
    return 'academy'


def main():
    if len(sys.argv) != 4:
        sys.exit('usage: release-courses.sh <version> <web/dist> <out-dir>')
    version, source, output = sys.argv[1:]
    if not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', version):
        sys.exit('version must look like 1.2.3')
    source, output = pathlib.Path(source).resolve(), pathlib.Path(output).resolve()
    if source == output or source in output.parents:
        sys.exit('output must be outside the source tree')
    if not (source / 'index.html').is_file():
        sys.exit('source must be an already-built web/dist with index.html')
    courses = json.loads((source / 'catalog-courses.json').read_text())
    if not isinstance(courses, list) or not courses or any(not c.get('id') or not all(c.get('title', {}).get(k) for k in ('ru', 'en')) for c in courses):
        sys.exit('catalog-courses.json must contain course ids and bilingual titles')
    labels = json.loads((source / 'catalog-labels.json').read_text())
    for id in ('academy', 'v86', 'rv64'):
        if not all(labels.get(id, {}).get(field, {}).get(lang) for field in ('title', 'description') for lang in ('ru', 'en')):
            sys.exit(f'missing bilingual package labels: {id}')
    groups = {'academy': [], 'v86': [], 'rv64': []}
    for file in sorted(source.rglob('*')):
        if file.is_symlink():
            sys.exit(f'symlink is forbidden: {file}')
        if file.is_file():
            groups[group(file.relative_to(source).as_posix())].append(file)
    output.mkdir(parents=True, exist_ok=True)
    packages = []
    for id, files in groups.items():
        if not files:
            print(f'Skipping {id}: no assets in this build')
            continue
        name = f'{id}-{version}.tar.gz'
        target = output / name
        with tarfile.open(target, 'w:gz', format=tarfile.USTAR_FORMAT) as archive:
            for file in files:
                archive.add(file, arcname=file.relative_to(source).as_posix(), recursive=False)
        with target.open('rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        package = dict(id=id, kind='course' if id == 'academy' else 'pack', version=version,
                       file=name, bytes=target.stat().st_size, sha256=digest,
                       title=labels[id]['title'], description=labels[id]['description'],
                       requires=[] if id == 'academy' else ['academy'])
        if id == 'academy':
            package['courses'] = courses
        packages.append(package)
    (output / 'catalog.json').write_text(json.dumps(dict(schemaVersion=1, packages=packages), indent=2) + '\n')


if __name__ == '__main__':
    main()
