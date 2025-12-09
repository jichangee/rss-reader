import { useEffect, useRef, useCallback } from "react"
import type { Article } from "../types"

interface UseScrollToReadProps {
  articles: Article[]
  markReadOnScroll: boolean
  onMarkAsReadBatch: (articleIds: string[]) => void
}

export function useScrollToRead({
  articles,
  markReadOnScroll,
  onMarkAsReadBatch,
}: UseScrollToReadProps) {
  const pendingReadIds = useRef<Set<string>>(new Set())
  const processedReadIds = useRef<Set<string>>(new Set())
  const batchSubmitTimer = useRef<NodeJS.Timeout | null>(null)
  const scrollObserverRef = useRef<IntersectionObserver | null>(null)

  const submitBatchRead = useCallback(() => {
    if (pendingReadIds.current.size > 0) {
      const idsToSubmit = Array.from(pendingReadIds.current)
      idsToSubmit.forEach(id => processedReadIds.current.add(id))
      pendingReadIds.current.clear()
      onMarkAsReadBatch(idsToSubmit)
    }
  }, [onMarkAsReadBatch])

  const addToPendingRead = useCallback((articleId: string, article?: Article) => {
    if (processedReadIds.current.has(articleId)) {
      return
    }
    
    if (pendingReadIds.current.has(articleId)) {
      return
    }
    
    if (article && article.readBy.length > 0) {
      processedReadIds.current.add(articleId)
      return
    }
    
    pendingReadIds.current.add(articleId)
    
    if (batchSubmitTimer.current) {
      clearTimeout(batchSubmitTimer.current)
    }
    
    batchSubmitTimer.current = setTimeout(() => {
      submitBatchRead()
    }, 3 * 1000)
  }, [submitBatchRead])

  useEffect(() => {
    return () => {
      if (batchSubmitTimer.current) {
        clearTimeout(batchSubmitTimer.current)
      }
      submitBatchRead()
    }
  }, [submitBatchRead])

  useEffect(() => {
    if (!markReadOnScroll) return

    if (scrollObserverRef.current) {
      scrollObserverRef.current.disconnect()
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
            const articleId = entry.target.getAttribute("data-id")
            if (articleId) {
              if (processedReadIds.current.has(articleId)) {
                observer.unobserve(entry.target)
                return
              }
              
              const article = articles.find(a => a.id === articleId)
              
              if (article && article.readBy.length > 0) {
                processedReadIds.current.add(articleId)
                observer.unobserve(entry.target)
                return
              }
              
              addToPendingRead(articleId, article)
              observer.unobserve(entry.target)
            }
          }
        })
      },
      {
        threshold: 0,
      }
    )

    scrollObserverRef.current = observer

    const unreadArticles = articles.filter(a => 
      a.readBy.length === 0 && !processedReadIds.current.has(a.id)
    )
    
    unreadArticles.forEach((article) => {
      const element = document.querySelector(`article[data-id="${article.id}"]`)
      if (element && !processedReadIds.current.has(article.id)) {
        observer.observe(element)
      }
    })

    return () => {
      if (scrollObserverRef.current) {
        scrollObserverRef.current.disconnect()
        scrollObserverRef.current = null
      }
    }
  }, [articles, markReadOnScroll, addToPendingRead])

  // 同步已读状态
  useEffect(() => {
    articles.forEach(article => {
      if (article.readBy.length > 0) {
        pendingReadIds.current.delete(article.id)
        processedReadIds.current.add(article.id)
      }
    })
  }, [articles])

  const markAsRead = useCallback((articleId: string) => {
    pendingReadIds.current.delete(articleId)
    processedReadIds.current.add(articleId)
  }, [])

  return { markAsRead }
}

