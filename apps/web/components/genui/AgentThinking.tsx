'use client'

type AgentThinkingProps = {
  toolName?: string
}

export function AgentThinking({
  toolName = 'Thinking...'
}: AgentThinkingProps) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3
                 rounded-2xl rounded-tl-sm
                 bg-zinc-800 dark:bg-zinc-800
                 w-fit max-w-[200px]"
      data-testid="agent-thinking"
      aria-label="Agent is thinking"
      aria-live="polite"
    >
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full
                       bg-zinc-400 dark:bg-zinc-400
                       animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <span className="text-xs text-zinc-400 dark:text-zinc-400
                       truncate">
        {toolName}
      </span>
    </div>
  )
}
