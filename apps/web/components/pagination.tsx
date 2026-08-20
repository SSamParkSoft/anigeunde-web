"use client";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label: string;
};

export function Pagination({ currentPage, totalPages, onPageChange, label }: PaginationProps) {
  return (
    <nav className="pagination" aria-label={label}>
      <button
        type="button"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="이전 페이지"
      >
        이전
      </button>
      <div>
        {pageItems(currentPage, totalPages).map((item, index) => (
          item === "ellipsis" ? (
            <span aria-hidden="true" key={`ellipsis-${index}`}>…</span>
          ) : (
            <button
              type="button"
              className={item === currentPage ? "active" : ""}
              aria-current={item === currentPage ? "page" : undefined}
              onClick={() => onPageChange(item)}
              key={item}
            >
              {item}
            </button>
          )
        ))}
      </div>
      <button
        type="button"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="다음 페이지"
      >
        다음
      </button>
    </nav>
  );
}

function pageItems(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const visible = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const items: Array<number | "ellipsis"> = [];

  visible.forEach((page, index) => {
    if (index > 0 && page - visible[index - 1] > 1) items.push("ellipsis");
    items.push(page);
  });

  return items;
}
