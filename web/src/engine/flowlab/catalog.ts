// Names of work items for the model business: a small online tea shop
// (07 §7.1). Cards carry roles and job titles, never personal names.

import { bi, type Bi } from '../../core/i18n';

export const FEATURES: Bi[] = [
  bi('Оплата картой', 'Card payment'),
  bi('Подписка на чай', 'Tea subscription'),
  bi('Фильтр по сортам', 'Filter by tea type'),
  bi('Отзывы на странице товара', 'Product reviews'),
  bi('Подарочная упаковка', 'Gift wrapping'),
  bi('Доставка в пункт выдачи', 'Pickup-point delivery'),
  bi('Скидка на второй пакет', 'Second-pack discount'),
  bi('Поиск по названию', 'Search by name'),
  bi('Рассылка о новинках', 'New-arrivals newsletter'),
  bi('Калькулятор заварки', 'Brewing calculator'),
  bi('Корзина на телефоне', 'Mobile cart'),
  bi('Бонусные баллы', 'Loyalty points'),
  bi('Карта чайных регионов', 'Tea-region map'),
  bi('Сравнение сортов', 'Compare teas'),
  bi('Оплата при получении', 'Cash on delivery'),
  bi('Страница статуса заказа', 'Order status page'),
  bi('Наборы пробников', 'Sample packs'),
  bi('Английская версия сайта', 'English version of the site'),
  bi('Отслеживание посылки', 'Parcel tracking'),
  bi('Рекомендации к заказу', 'Order recommendations'),
];

export const BUGS: Bi[] = [
  bi('Неверная цена в корзине', 'Wrong price in the cart'),
  bi('Не приходит письмо о заказе', 'Order email is not sent'),
  bi('Сбрасывается адрес доставки', 'Delivery address resets'),
  bi('Дубли в каталоге', 'Duplicates in the catalogue'),
  bi('Кнопка «купить» не видна на телефоне', '“Buy” button hidden on phones'),
];

export const TOIL: Bi[] = [
  bi('Выдать доступ к админке', 'Grant access to the admin panel'),
  bi('Сбросить пароль сотруднику', 'Reset a staff password'),
  bi('Выгрузить отчёт для бухгалтерии', 'Export a report for accounting'),
  bi('Почистить место на сервере', 'Free up disk space on the server'),
  bi('Продлить сертификат сайта', 'Renew the site certificate'),
];

export const TRAFFIC_INCIDENT = bi('Сайт тормозит под нагрузкой', 'The site slows down under load');
export const CAUSE_CARD = bi('Разобраться в причине сбоя', 'Find the cause of the outage');
