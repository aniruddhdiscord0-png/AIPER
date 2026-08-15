import React, { useEffect, useRef } from 'react';

const shimmerStyle = `
@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}
.skeleton-block {
  animation: shimmer 2s infinite linear;
  background: linear-gradient(to right, var(--color-background) 4%, var(--color-surface-hover) 25%, var(--color-background) 36%);
  background-size: 1000px 100%;
  border-radius: 8px;
  height: 80px;
  margin-bottom: 1rem;
  width: 100%;
  border: 1px solid var(--color-border);
}
`;

export default function InfiniteScroll({ hasMore, isLoading, onLoadMore }) {
  const observerTarget = useRef(null);
  const loadMoreRef = useRef(onLoadMore);

  // Keep callback reference fresh without triggering re-renders
  useEffect(() => {
    loadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMoreRef.current();
        }
      },
      { rootMargin: '2000px' }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading]);

  if (!hasMore && !isLoading) return null;

  return (
    <>
      <style>{shimmerStyle}</style>
      <div ref={observerTarget} style={{ padding: '1rem', width: '100%' }}>
        {isLoading && (
          <div>
            <div className="skeleton-block" />
            <div className="skeleton-block" />
            <div className="skeleton-block" />
          </div>
        )}
      </div>
    </>
  );
}
