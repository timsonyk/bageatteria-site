import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — Bageatteria",
  description:
    "Политика обработки персональных данных и информация о данных, которые используются на сайте Bageatteria.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-[800px] mx-auto px-4 md:px-8 py-8 md:py-12">
        <Link
          href="/menu"
          className="inline-flex items-center gap-2 text-[14px] text-[#8E8E93] hover:text-black mb-6"
        >
          ← В каталог
        </Link>

        <h1 className="text-[28px] md:text-[36px] font-normal text-black tracking-[-0.6px] leading-tight mb-2">
          Политика конфиденциальности
        </h1>
        <p className="text-[13px] text-[#8E8E93] mb-8">
          Действует с 13 мая 2026 года
        </p>

        <div className="space-y-6 text-[15px] leading-relaxed text-black">
          <section>
            <h2 className="text-[20px] font-medium mb-2">1. Общие положения</h2>
            <p>
              Настоящая Политика разработана в соответствии с Федеральным законом
              от 27.07.2006 № 152-ФЗ «О персональных данных» и определяет порядок
              использования данных пользователей сайта{" "}
              <a href="https://bageatteria.com" className="underline">
                bageatteria.com
              </a>{" "}
              (далее — «Сайт»).
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-medium mb-2">2. Оператор</h2>
            <p>
              <strong>ООО «БАГЕТТЕРИЯ»</strong>
              <br />
              ИНН 9704158488 · КПП 770401001 · ОГРН 1227700512643
              <br />
              Адрес: 121069, г. Москва, муниципальный округ Арбат, б-р Новинский,
              д. 18, к. 2, помещ. 1/1
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-medium mb-2">
              3. Какие данные обрабатываются
            </h2>
            <p className="mb-3">
              Сайт работает в режиме каталога — регистрация и оформление заказов
              на сайте не предусмотрены. Сервер не собирает и не хранит
              персональные данные посетителей.
            </p>
            <p className="mb-3">
              Для удобства работы интерфейса в локальном хранилище браузера
              (<code className="px-1 py-0.5 bg-[#F2F2F7] rounded text-[13px]">localStorage</code>)
              сохраняются исключительно функциональные данные:
            </p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>
                выбранная точка продаж (для отображения её меню) — хранится не
                более 12 часов;
              </li>
              <li>
                избранные товары — хранятся до тех пор, пока пользователь сам их
                не удалит или не очистит данные браузера.
              </li>
            </ul>
            <p className="mt-3">
              Эти данные находятся только в браузере пользователя, не передаются
              на сервер Оператора и не позволяют идентифицировать конкретного
              человека.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-medium mb-2">
              4. Cookies и аналитика
            </h2>
            <p>
              Сайт не устанавливает cookies на устройство пользователя и не
              использует системы веб-аналитики (Яндекс.Метрика, Google Analytics
              и аналогичные).
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-medium mb-2">
              5. Передача данных третьим лицам
            </h2>
            <p>
              Никакие данные пользователей не передаются третьим лицам.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-medium mb-2">
              6. Права пользователя
            </h2>
            <p className="mb-3">Пользователь вправе:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>
                в любой момент очистить локальное хранилище браузера: убрать
                товары из избранного, выбрать другую точку или очистить данные
                сайта в настройках браузера;
              </li>
              <li>
                запросить информацию о том, какие данные о нём хранятся (через
                контакты ниже).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[20px] font-medium mb-2">
              7. Изменения политики
            </h2>
            <p>
              Оператор вправе в одностороннем порядке вносить изменения в
              настоящую Политику. Актуальная редакция всегда доступна по адресу
              bageatteria.com/privacy.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-medium mb-2">8. Контакты</h2>
            <p>
              По вопросам, связанным с обработкой персональных данных, можно
              обращаться через контактные данные, указанные на странице кафе или
              в подвале сайта.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
