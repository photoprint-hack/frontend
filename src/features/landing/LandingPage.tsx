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

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between py-4 sm:py-5">
        <div className="flex items-center gap-3.5">
          <CompassMark className="h-12 w-12" />
          <div className="leading-tight">
            <p className="text-lg font-semibold tracking-tight">Компас</p>
            <p className="mt-1 text-xs text-ink-400 sm:text-sm">Управление компанией</p>
          </div>
        </div>
        <Link to="/login">
          <Button variant="outline" size="md">
            Войти <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </Link>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 items-center gap-8 py-5 lg:grid-cols-[1.02fr_0.98fr] lg:gap-12 xl:gap-16">
        <section className="max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-ink-700/80 bg-ink-900/60 px-4 py-2 text-xs text-ink-300 sm:text-sm">
            <CircleDot className="h-4 w-4 text-accent-300" aria-hidden />
            Единая система управления компанией
          </div>
          <h1 className="text-balance text-5xl font-semibold leading-[1.04] tracking-tight sm:text-6xl xl:text-7xl">
            Видеть главное.<br />
            <span className="text-accent-300">Двигаться уверенно.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-300 sm:text-lg">
            Компас связывает показатели с причинами и решениями, чтобы команда понимала, что происходит и какой шаг сделать дальше.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to="/login">
              <Button variant="primary" size="lg">
                Открыть рабочее пространство <ArrowRight className="h-5 w-5" aria-hidden />
              </Button>
            </Link>
            <span className="text-xs text-ink-500 sm:text-sm">Для команды ООО «Фотопринт»</span>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-xs text-ink-400 sm:text-sm">
            {['Показатели и отклонения', 'Решения и задачи', 'Производство и качество'].map((item) => (
              <span key={item} className="inline-flex items-center gap-2">
                <Check className="h-4 w-4 text-accent-300" aria-hidden />{item}
              </span>
            ))}
          </div>
        </section>

        <section aria-label="Пример рабочего пространства Компас" className="relative mx-auto hidden w-full max-w-[560px] lg:block">
          <div aria-hidden className="absolute -inset-5 rounded-[2rem] bg-accent-500/10 blur-2xl" />
          <div className="relative rounded-2xl border border-ink-700/80 bg-ink-900/90 p-5 shadow-[0_28px_80px_-38px_rgba(0,0,0,.85)] sm:p-6">
            <div className="flex items-center justify-between border-b border-ink-700/70 pb-5">
              <div className="flex items-center gap-3">
                <CompassMark className="h-10 w-10" />
                <div>
                  <p className="text-sm font-semibold">Обзор компании</p>
                  <p className="mt-1 text-xs text-ink-500">Управленческая сводка</p>
                </div>
              </div>
              <span className="rounded-full border border-signal-warn/30 bg-signal-warn/10 px-3 py-1.5 text-xs text-signal-warn">3 сигнала</span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {signals.map((signal) => (
                <div key={signal.label} className="rounded-xl border border-ink-700/70 bg-ink-850/70 p-3.5">
                  <p className="truncate text-xs text-ink-400">{signal.label}</p>
                  <p className="mt-2 truncate text-base font-semibold">{signal.value}</p>
                  <p className={`mt-1.5 text-xs ${signal.tone}`}>{signal.change}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-ink-700/70 bg-ink-850/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">От сигнала к действию</p>
                  <p className="mt-1 text-xs text-ink-500">Отклонение → причина → решение</p>
                </div>
                <MoveUpRight className="h-5 w-5 text-accent-300" aria-hidden />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2.5">
                {[
                  ['Сигнал', 'Маржа ниже плана', 'border-signal-warn/35'],
                  ['Причина', 'Рост затрат', 'border-ink-600'],
                  ['Решение', 'Проверить закупки', 'border-accent-400/35'],
                ].map(([step, detail, border]) => (
                  <div key={step} className={`min-w-0 rounded-lg border ${border} bg-ink-900/80 p-3`}>
                    <p className="text-[0.6875rem] uppercase tracking-wide text-ink-500">{step}</p>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-200">{detail}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-ink-500">
              <span className="h-2 w-2 rounded-full bg-signal-ok" />Показатели, решения и задачи — в одном месте
            </div>
          </div>
        </section>
      </div>

      <footer className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between border-t border-ink-800/80 py-3 text-xs text-ink-500">
        <span>Компас · ООО «Фотопринт»</span>
        <span>Внутренняя управленческая платформа</span>
      </footer>
    </main>
  );
}
