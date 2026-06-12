'use client'

import React, { createContext, useContext, useCallback, useState } from 'react'
import type {
  AccountInfo,
  ContactInfo,
  CaseSummary,
  CaseInteraction,
  CaseDetail,
  KBArticle,
  SimilarTicket,
  EscalationInfo,
} from '@/lib/ui-event-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UIContextState {
  /** Latest customer context payload */
  customerContext: {
    account: AccountInfo | null
    contact: ContactInfo | null
    openCases: CaseSummary[]
    recentInteractions: CaseInteraction[]
  }
  /** Latest case detail payload */
  caseDetail: CaseDetail | null
  /** Latest KB results payload */
  kbResults: {
    articles: KBArticle[]
    query: string
    totalCount: number
  }
  /** Latest similar tickets payload */
  similarTickets: {
    tickets: SimilarTicket[]
    query: string
    totalCount: number
  }
  /** Latest case list payload */
  caseList: {
    cases: CaseSummary[]
    query: string
    totalCount: number
  }
  /** Whether any context data is currently being streamed */
  isStreaming: boolean
  /** Register a new UI payload from the SSE stream */
  addUIPayload: (name: string, props: Record<string, unknown>) => void
  /** Set streaming state */
  setStreaming: (loading: boolean) => void
  /** Clear all context data */
  clearContext: () => void
}

const defaultContext: UIContextState = {
  customerContext: { account: null, contact: null, openCases: [], recentInteractions: [] },
  caseDetail: null,
  kbResults: { articles: [], query: '', totalCount: 0 },
  similarTickets: { tickets: [], query: '', totalCount: 0 },
  caseList: { cases: [], query: '', totalCount: 0 },
  isStreaming: false,
  addUIPayload: () => {},
  setStreaming: () => {},
  clearContext: () => {},
}

const UIContext = createContext<UIContextState>(defaultContext)

export function useUIContext() {
  return useContext(UIContext)
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface UIContextProviderProps {
  children: React.ReactNode
}

export function UIContextProvider({ children }: UIContextProviderProps) {
  const [customerContext, setCustomerContext] = useState<UIContextState['customerContext']>(
    defaultContext.customerContext
  )
  const [caseDetail, setCaseDetail] = useState<UIContextState['caseDetail']>(null)
  const [kbResults, setKbResults] = useState<UIContextState['kbResults']>(defaultContext.kbResults)
  const [similarTickets, setSimilarTickets] = useState<UIContextState['similarTickets']>(
    defaultContext.similarTickets
  )
  const [caseList, setCaseList] = useState<UIContextState['caseList']>(defaultContext.caseList)
  const [isStreaming, setIsStreaming] = useState(false)

  const addUIPayload = useCallback((name: string, props: Record<string, unknown>) => {
    switch (name) {
      case 'customer-context':
      case 'customerContext': {
        setCustomerContext({
          account: (props?.account as AccountInfo) ?? null,
          contact: (props?.contact as ContactInfo) ?? null,
          openCases: (Array.isArray(props?.openCases) ? props.openCases : []) as CaseSummary[],
          recentInteractions: (Array.isArray(props?.recentInteractions)
            ? props.recentInteractions
            : []
          ) as CaseInteraction[],
        })
        break
      }
      case 'case-detail':
      case 'caseDetail': {
        setCaseDetail((props?.case as CaseDetail) ?? null)
        break
      }
      case 'kb-results':
      case 'kbResults': {
        setKbResults({
          articles: (Array.isArray(props?.articles) ? props.articles : []) as KBArticle[],
          query: (typeof props?.query === 'string' ? props.query : '') as string,
          totalCount: (typeof props?.totalCount === 'number' ? props.totalCount : 0) as number,
        })
        break
      }
      case 'similar-tickets':
      case 'similarTickets': {
        setSimilarTickets({
          tickets: (Array.isArray(props?.tickets) ? props.tickets : []) as SimilarTicket[],
          query: (typeof props?.query === 'string' ? props.query : '') as string,
          totalCount: (typeof props?.totalCount === 'number' ? props.totalCount : 0) as number,
        })
        break
      }
      case 'case-list':
      case 'caseList': {
        setCaseList({
          cases: (Array.isArray(props?.cases) ? props.cases : []) as CaseSummary[],
          query: (typeof props?.query === 'string' ? props.query : '') as string,
          totalCount: (typeof props?.totalCount === 'number' ? props.totalCount : 0) as number,
        })
        break
      }
      // Payloads that don't populate the context panel are silently accepted
      // (reply-draft, case-created, case-updated, escalation-card)
      default:
        break
    }
  }, [])

  const setStreaming = useCallback((loading: boolean) => {
    setIsStreaming(loading)
  }, [])

  const clearContext = useCallback(() => {
    setCustomerContext(defaultContext.customerContext)
    setCaseDetail(null)
    setKbResults(defaultContext.kbResults)
    setSimilarTickets(defaultContext.similarTickets)
    setCaseList(defaultContext.caseList)
  }, [])

  return (
    <UIContext.Provider
      value={{
        customerContext,
        caseDetail,
        kbResults,
        similarTickets,
        caseList,
        isStreaming,
        addUIPayload,
        setStreaming,
        clearContext,
      }}
    >
      {children}
    </UIContext.Provider>
  )
}
