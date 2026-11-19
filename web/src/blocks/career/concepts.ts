// Concepts of the career block and the final segment. Every term here is an
// everyday word too ("interview", "CV", "status"), so the glossary scan is
// off for all of them: links and introduces/uses are still checked.

import { bi } from '../../core/i18n';
import type { Concept } from '../../core/types';

const c = (id: string, ru: string, en: string, shortRu: string, shortEn: string, introducedIn: string): Concept => ({ id, term: bi(ru, en), short: bi(shortRu, shortEn), introducedIn, scan: false });

export const CONCEPTS: Concept[] = [
  // final
  c('career.oncall', 'смена дежурного', 'on-call shift', 'Работа дежурного инженера: принять алерт, оценить влияние, вернуть сервис, найти причину и рассказать команде.', 'The on-call engineer’s job: take the alert, judge the impact, restore the service, find the cause and tell the team.', 'final.oncall'),
  c('career.priority', 'приоритет по влиянию', 'priority by impact', 'Первым берут инцидент, от которого сильнее всего страдают пользователи, а не тот, что пришёл раньше.', 'The incident that hurts users most is taken first, not the one that came first.', 'final.oncall'),
  c('career.blameless', 'разбор без виноватых', 'blameless review', 'Разбор инцидента, который ищет условия системы, сделавшие ошибку возможной, а не человека, который её сделал.', 'An incident review that looks for the conditions of the system that made the mistake possible, not for the person who made it.', 'final.oncall'),
  c('career.capstone', 'итоговый экзамен', 'final exam', 'Построить, починить и защитить небольшую, но настоящую систему на трёх облачных машинах.', 'Build, fix and defend a small but real system on three cloud machines.', 'final.capstone'),
  c('career.cleanup', 'уборка', 'cleanup', 'Последний шаг работы с платными ресурсами: машины удалены, и это проверено.', 'The last step of work with paid resources: the machines are deleted, and that is verified.', 'final.capstone'),
  // career
  c('career.interview', 'собеседование джуна', 'junior interview', 'Скрининг, техническое интервью, иногда практика в песочнице и финал: на каждом этапе проверяют своё.', 'A screening, a technical interview, sometimes a practical sandbox, and a final round: each stage checks something else.', 'career.interviews'),
  c('career.logic', 'логика, а не команды', 'logic, not commands', 'Главное правило ответа: объяснить механизм, а команду назвать как способ его увидеть.', 'The main rule of an answer: explain the mechanism and name the command as a way to see it.', 'career.interviews'),
  c('career.answer-structure', 'структура ответа', 'answer structure', 'Что это → зачем → как работает → когда вы этим пользуетесь: четыре части ответа на технический вопрос.', 'What it is → why it exists → how it works → when you use it: the four parts of an answer to a technical question.', 'career.answer'),
  c('career.dont-know', 'честное «не знаю»', 'an honest “I don’t know”', 'Признать незнание, связать с тем, что знаете, и назвать, где и как выяснили бы.', 'Admit you do not know, link it to what you do know, and say where and how you would find out.', 'career.answer'),
  c('career.q-vm-container', 'ВМ против контейнера', 'VM vs container', 'Своё ядро на гипервизоре против процесса хоста в пространствах имён и cgroups; они вкладываются друг в друга.', 'Its own kernel on a hypervisor versus a host process in namespaces and cgroups; they nest inside each other.', 'career.classics'),
  c('career.q-ci-cd', 'CI, доставка и развёртывание', 'CI, delivery and deployment', 'Частое слияние с проверкой; всегда готово к выкладке по решению человека; выкладка без ручного шага.', 'Frequent merging with checks; always releasable on a person’s decision; release with no manual step.', 'career.classics'),
  c('career.situational', 'ситуационный вопрос', 'situational question', '«504 — что будете делать?»: проверяют метод — от симптома к причине по уровням, с уликами до изменений.', '“504 — what do you do?”: the method is checked — from symptom to cause layer by layer, with evidence before changes.', 'career.situational'),
  c('career.mitigate-first', 'сначала вернуть сервис', 'mitigate first', 'Сначала откатить то изменение, которое вызвало сбой, и вернуть пользователям сервис, потом чинить причину.', 'First roll back the change that caused the failure and give users the service back, then fix the cause.', 'career.situational'),
  c('career.status-update', 'статус команде', 'status update', 'Короткое сообщение: кто страдает и насколько, что делаем, когда следующий статус.', 'A short message: who is affected and how badly, what we are doing, when the next update is.', 'career.situational'),
  c('career.mock-interview', 'мок-интервью', 'mock interview', 'Учебное собеседование по настоящему сценарию, с разбором по рубрике.', 'A practice interview following a real script, reviewed with a rubric.', 'career.mock'),
  c('career.rubric', 'рубрика', 'rubric', 'Критерии с баллами 0–3 и описанием каждого балла; балл без цитаты из ответа не засчитывается.', 'Criteria scored 0–3 with a description of each score; a score without a quote from the answer does not count.', 'career.mock'),
  c('career.pitch', 'самопрезентация', 'self-presentation', 'Ответ на «расскажите о себе» за 60–90 секунд: кто я, что умею с доказательствами, одна история, почему DevOps, что ищу.', 'The answer to “tell me about yourself” in 60–90 seconds: who I am, what I can do with proof, one story, why DevOps, what I am looking for.', 'career.pitch'),
  c('career.awkward', 'неудобный вопрос', 'awkward question', 'Вопрос о слабом месте кандидата; хороший ответ честен и показывает план.', 'A question about the candidate’s weak spot; a good answer is honest and shows a plan.', 'career.pitch'),
  c('career.evidence', 'подтверждение навыка', 'skill evidence', 'То, что можно открыть и проверить: репозиторий, сданный экзамен, протокол.', 'Something one can open and check: a repository, a passed exam, a protocol.', 'career.resume'),
  c('career.bridge', 'опыт-мост', 'bridge experience', 'Прежний опыт, честно переписанный словами, понятными нанимающему DevOps-менеджеру.', 'Earlier experience honestly rewritten in words a DevOps hiring manager understands.', 'career.resume'),
  c('career.pet-project', 'пет-проект', 'pet project', 'Свой проект на настоящей машине с измеримыми критериями приёмки; его защищают на собеседовании.', 'Your own project on a real machine with measurable acceptance criteria; you defend it at an interview.', 'career.pets'),
  c('career.readme', 'README проекта', 'project README', 'Что это и зачем, схема, как запустить, решения и почему, что сломалось и как чинил, что дальше.', 'What it is and why, a diagram, how to run it, decisions and why, what broke and how you fixed it, what next.', 'career.pets'),
  c('career.rule-60', 'правило 60%', 'the 60% rule', 'Совпадаете с вакансией на 60% — откликайтесь: требования завышают намеренно.', 'If you match 60% of a vacancy, apply: requirements are inflated on purpose.', 'career.search'),
  c('career.funnel', 'воронка откликов', 'application funnel', 'Отклики как поток: отклик → ответ → скрининг → техническое → финал → оффер, с метриками потока.', 'Applications as a flow: apply → reply → screening → technical → final → offer, with flow metrics.', 'career.search'),
  c('career.retro', 'ретро собеседования', 'interview retro', 'Короткий разбор после каждого собеседования: какие вопросы, где было трудно, что повторить.', 'A short review after each interview: which questions, where it was hard, what to review.', 'career.search'),
];
