import { Navigate, Link } from 'react-router-dom';
import { ArrowRight, Check, CircleDot, MoveUpRight } from 'lucide-react';
import { CompassMark } from '@/components/brand/CompassMark';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth/auth-context';

const signals = [
  { label: 'Оборот', value: '10 940 BYN', change: '−4,7%', tone: 'text-signal-bad' },
  { label: 'Качество', value: '98,2%', change: '+1,3%', tone: 'text-signal-ok' },
  { label: 'План выпуска', value: '87%', change: 'внимание', tone: 'text-signal-warn' },
];

export function LandingPage() {
  const { status, home } = useAuth();

  if (status === 'authenticated') return <Navigate to={home} replace />;
  if (status === 'loading') {
    return (
      <main className="flex h-[100svh] min-h-[620px] items-center justify-center bg-ink-950">
        <div className="flex items-center gap-3">
          <CompassMark className="h-10 w-10" />
          <div>
            <p className="font-semibold text-ink-100">Компас</p>
            <p className="text-xs text-ink-400">Видеть главное. Двигаться уверенно.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex h-[100svh] min-h-[620px] flex-col overflow-hidden bg-ink-950 px-5 text-ink-50 sm:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_78%_45%,rgba(44,197,176,0.10),transparent_38%),radial-gradient(ellipse_at_12%_5%,rgba(95,126,255,0.08),transparent_32%)]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.13] [background-image:linear-gradient(rgba(148,163,184,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.14)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between py-4 sm:py-5">
        <div className="flex items-center gap-3">
          <CompassMark className="h-10 w-10" />
          <div className="leading-tight">
            <p className="text-base font-semibold tracking-tight">Компас</p>
            <p className="mt-0.5 text-[0.6875rem] text-ink-400">Управление компанией</p>
          </div>
        </div>
        <Link to="/login">
          <Button variant="outline" size="sm">
            Войти <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </Link>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 py-5 lg:grid-cols-[1fr_0.92fr] lg:gap-14">
        <section className="max-w-xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-ink-700/80 bg-ink-900/60 px-3 py-1.5 text-[0.6875rem] text-ink-300">
            <CircleDot className="h-3.5 w-3.5 text-accent-300" aria-hidden />
            Единая система управления компанией
          </div>
          <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl xl:text-[3.5rem]">
            Видеть главное.<br />
            <span className="text-accent-300">Двигаться уверенно.</span>
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-relaxed text-ink-300 sm:text-base">
            Компас связывает показатели с причинами и решениями, чтобы команда понимала, что происходит и какой шаг сделать дальше.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link to="/login">
              <Button variant="primary" size="lg">
                Открыть рабочее пространство <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </Link>
            <span className="text-[0.6875rem] text-ink-500">Для команды ООО «Фотопринт»</span>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[0.6875rem] text-ink-400">
            {['Показатели и отклонения', 'Решения и задачи', 'Производство и качество'].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-accent-300" aria-hidden />{item}
              </span>
            ))}
          </div>
        </section>

        <section aria-label="Пример рабочего пространства Компас" className="relative mx-auto hidden w-full max-w-[490px] lg:block">
          <div aria-hidden className="absolute -inset-5 rounded-[2rem] bg-accent-500/10 blur-2xl" />
          <div className="relative rounded-2xl border border-ink-700/80 bg-ink-900/90 p-4 shadow-[0_28px_80px_-38px_rgba(0,0,0,.85)] sm:p-5">
            <div className="flex items-center justify-between border-b border-ink-700/70 pb-4">
              <div className="flex items-center gap-2.5">
                <CompassMark className="h-8 w-8" />
                <div>
                  <p className="text-xs font-semibold">Обзор компании</p>
                  <p className="mt-0.5 text-[0.625rem] text-ink-500">Управленческая сводка</p>
                </div>
              </div>
              <span className="rounded-full border border-signal-warn/30 bg-signal-warn/10 px-2.5 py-1 text-[0.625rem] text-signal-warn">3 сигнала</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {signals.map((signal) => (
                <div key={signal.label} className="rounded-xl border border-ink-700/70 bg-ink-850/70 p-3">
                  <p className="truncate text-[0.625rem] text-ink-400">{signal.label}</p>
                  <p className="mt-2 truncate text-sm font-semibold">{signal.value}</p>
                  <p className={`mt-1 text-[0.625rem] ${signal.tone}`}>{signal.change}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-ink-700/70 bg-ink-850/50 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.6875rem] font-medium">От сигнала к действию</p>
                  <p className="mt-0.5 text-[0.625rem] text-ink-500">Отклонение → причина → решение</p>
                </div>
                <MoveUpRight className="h-4 w-4 text-accent-300" aria-hidden />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  ['Сигнал', 'Маржа ниже плана', 'border-signal-warn/35'],
                  ['Причина', 'Рост затрат', 'border-ink-600'],
                  ['Решение', 'Проверить закупки', 'border-accent-400/35'],
                ].map(([step, detail, border]) => (
                  <div key={step} className={`min-w-0 rounded-lg border ${border} bg-ink-900/80 p-2`}>
                    <p className="text-[0.5625rem] uppercase tracking-wide text-ink-500">{step}</p>
                    <p className="mt-1 line-clamp-2 text-[0.625rem] leading-relaxed text-ink-200">{detail}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[0.625rem] text-ink-500">
              <span className="h-1.5 w-1.5 rounded-full bg-signal-ok" />Показатели, решения и задачи — в одном месте
            </div>
          </div>
        </section>
      </div>

      <footer className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between border-t border-ink-800/80 py-3 text-[0.625rem] text-ink-500">
        <span>Компас · ООО «Фотопринт»</span>
        <span>Внутренняя управленческая платформа</span>
      </footer>
    </main>
  );
}
