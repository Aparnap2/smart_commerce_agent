'use client'

import { cn } from '@/lib/utils'

type MessageProps = {
  role: 'user' | 'assistant'
  content: string | React.ReactNode
}

export function Message({ role, content }: MessageProps) {
  const isUser = role === 'user'

  return (
    <div
      className={cn(
        'flex w-full',
        isUser ? 'justify-end' : 'justify-start'
      )}
      data-testid={`message-${role}`}
    >
      {isUser ? (
        <div
          className={cn(
            'max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-3',
            'bg-purple-600 text-white',
            'dark:bg-purple-500 dark:text-white',
            'text-sm leading-relaxed'
          )}
        >
          {typeof content === 'string' ? content : content}
        </div>
      ) : (
        <div className={cn(
          'w-full',
          typeof content === 'string'
            ? cn(
                'max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3',
                'bg-zinc-800 text-zinc-100',
                'dark:bg-zinc-800 dark:text-zinc-100',
                'text-sm leading-relaxed'
              )
            : 'w-full'
        )}>
          {content}
        </div>
      )}
    </div>
  )
}
