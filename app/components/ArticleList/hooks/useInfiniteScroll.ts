import { useEffect, useRef } from "react"

interface UseInfiniteScrollProps {
  hasMore: boolean
  loading: boolean
  onLoadMore: () => void
}

export function useInfiniteScroll({ hasMore, loading, onLoadMore }: UseInfiniteScrollProps) {
  const observerTarget = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          onLoadMore()
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '0px 0px 33% 0px'
      }
    )

    const currentTarget = observerTarget.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [hasMore, loading, onLoadMore])

  return { observerTarget }
}

