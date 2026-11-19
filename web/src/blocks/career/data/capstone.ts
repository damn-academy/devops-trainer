// The capstone exam outline as a checklist (10 §6.5): parts A, B, C and the
// cleanup, with what checks each requirement.

import { bi, type Bi } from '../../../core/i18n';
import type { Level } from '../../../core/types';

export interface CapstoneItem {
  id: string;
  text: Bi;
  check: Bi;
  levels?: Level[];
}

export interface CapstonePart {
  id: string;
  title: Bi;
  items: CapstoneItem[];
}

const i = (id: string, ru: string, en: string, checkRu: string, checkEn: string, levels?: Level[]): CapstoneItem => ({ id, text: bi(ru, en), check: bi(checkRu, checkEn), levels });

export const CAPSTONE: CapstonePart[] = [
  {
    id: 'a',
    title: bi('А. Построить', 'A. Build'),
    items: [
      i('A1', 'Публичный репозиторий, README по шаблону', 'A public repository, a README from the template', 'Разделы README по заголовкам', 'README sections by heading'),
      i('A2', 'Конвейер: линтер → тесты → образ с тегом по коммиту → реестр образов → выкладка, причём изменения из других веток не выкладываются', 'A pipeline: lint → tests → image tagged by commit → registry → release; no releases from branches', 'Файл конвейера, статус последнего прогона main, теги образов = SHA коммитов', 'The pipeline file, the last main run status, image tags = commit SHAs'),
      i('A3', 'Terraform создаёт три машины, Ansible готовит узлы, а повторные запуски ничего не меняют', 'Terraform creates three machines, Ansible prepares the nodes; repeated runs change nothing', '`changed=0` и `No changes` в выводе, состояние узлов', '`changed=0` and `No changes` in the output, the node state'),
      i('A4', 'Кластер из трёх узлов, в котором приложение выкладывается Helm-чартом через Argo CD', 'A three-node cluster, the application as a Helm chart through Argo CD', 'Узлы Ready, Application Synced/Healthy, ревизия = HEAD', 'Nodes Ready, Application Synced/Healthy, revision = HEAD'),
      i('A4b', 'Снимок etcd по расписанию и восстановление, обновление на минорную версию, сертификаты > 30 дней', 'A scheduled etcd snapshot and restore, a minor-version upgrade, certificates > 30 days', 'Снимки моложе суток, версии до и после, `kubeadm certs check-expiration`', 'Snapshots under a day old, versions before and after, `kubeadm certs check-expiration`', ['experienced']),
      i('A5', 'Четыре золотых сигнала, алерт на долю ошибок с `for:`, доставка в мессенджер', 'Four golden signals, an error-ratio alert with `for:`, delivery to a messenger', 'Правило загружено, цели `up == 1`, текст пришедшего алерта', 'Rule loaded, targets `up == 1`, the text of the delivered alert'),
      i('A6', 'Вход по ключам, пароль выключен, межсетевой экран, секретов в репозитории нет', 'Key-only login, passwords off, a firewall, no secrets in the repository', '`sshd -T`, правила межсетевого экрана, поиск секретов в репозитории', '`sshd -T`, the firewall rules, a secret scan of the repository'),
      i('A7', 'Задача, которой не было в курсе, решённая по документации: PodDisruptionBudget, распределение по узлам или автомасштабирование', 'A task beyond the course from the documentation: a PodDisruptionBudget, spreading across nodes or autoscaling', 'Объекты в кластере', 'Objects in the cluster'),
      i('A8', 'Вся система создаётся из кода с нуля в пустом проекте', 'Everything comes up from code from scratch in an empty project', 'Время и вывод финальной сборки, все проверки A3–A6 на свежих машинах', 'The time and output of the final build, every A3–A6 check on fresh machines'),
    ],
  },
  {
    id: 'b',
    title: bi('Б. Починить за 60 минут', 'B. Fix in 60 minutes'),
    items: [
      i('B1', 'Поломка найдена по уликам, сервис возвращён, причина устранена', 'The failure is found from evidence, the service restored, the cause removed', 'Все проверки части А снова зелёные, данные целы', 'Every check of part A is green again, the data is intact'),
      i('B2', 'Статус для команды и разбор из четырёх частей', 'A status to the team and a four-line review', 'Рубрика инцидента', 'The incident rubric'),
    ],
  },
  {
    id: 'c',
    title: bi('В. Защитить за 40 минут', 'C. Defend in 40 minutes'),
    items: [
      i('C1', 'Проект защищён перед учебным интервьюером со средним баллом не ниже 2 и без единого нуля по честности', 'The project is defended before the mock interviewer with a mean score of at least 2 and not a single zero for honesty', 'Рубрика интервью с цитатами', 'The interview rubric with quotes'),
      i('C2', 'Та же защита с живым человеком', 'The same defence with a live person', 'Бланк рубрики, заполненный интервьюером', 'The rubric sheet filled in by the interviewer'),
    ],
  },
  {
    id: 'cleanup',
    title: bi('Уборка', 'Cleanup'),
    items: [
      i('D1', 'Команда `terraform destroy` выводит `Destroy complete! Resources: N destroyed.`, где N равно числу ресурсов в состоянии Terraform', '`terraform destroy` prints `Destroy complete! Resources: N destroyed.`, where N equals the number of resources in the Terraform state', 'Вывод команды', 'The command output'),
      i('D2', 'Пустой `terraform state list` и пустой список машин провайдера по метке экзамена', 'An empty `terraform state list` and an empty provider machine list with the exam label', 'Вывод в JSON', 'The JSON output'),
    ],
  },
];
