'use client';

const TOOL_LABELS: Record<string, string> = {
  search_catalog: 'Searching catalog',
  get_budget_status: 'Checking budget',
  manage_purchase_request: 'Updating PR',
  submit_for_approval: 'Submitting PR',
  get_purchase_requests: 'Loading PRs',
  process_approval: 'Processing approval',
  raise_dispute: 'Raising dispute',
  default: 'Thinking',
};

interface Props {
  toolName?: string;
}

export function AgentThinking({ toolName }: Props) {
  const label = (toolName && TOOL_LABELS[toolName]) ?? TOOL_LABELS.default;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 w-fit max-w-[240px]"
      role="status"
      aria-live="polite"
      aria-label={`${label}...`}
    >
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-zinc-500 dark:bg-zinc-400 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
      <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
        {label}…
      </span>
    </div>
  );
}