interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Topbar({ title, subtitle, actions }: TopbarProps) {
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-line bg-white/80 p-4 backdrop-blur-sm sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-xl font-bold text-ink mb-0.5">{title}</h2>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div data-crm-topbar-actions className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap sm:gap-3">{actions}</div>}
    </div>
  );
}
