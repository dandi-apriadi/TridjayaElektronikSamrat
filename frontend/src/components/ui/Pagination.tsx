import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
}) => {
  if (totalPages <= 1) return null;

  const renderPageButtons = () => {
    const buttons = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          onClick={() => onPageChange(i)}
          className={`w-9 h-9 rounded-lg text-label-sm font-bold transition-all flex items-center justify-center ${
            currentPage === i
              ? 'bg-primary text-surface shadow-neon-cyan shadow-sm'
              : 'text-on-surface-variant hover:bg-surface-high hover:text-on-surface border border-outline-variant/10'
          }`}
        >
          {i}
        </button>
      );
    }

    return buttons;
  };

  return (
    <div className={`flex items-center justify-between py-4 px-2 ${className}`}>
      <div className="text-label-xs text-on-surface-variant font-medium">
        Halaman <span className="text-on-surface font-bold">{currentPage}</span> dari <span className="text-on-surface font-bold">{totalPages}</span>
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-high disabled:opacity-30 disabled:pointer-events-none transition-all border border-outline-variant/10"
          title="Pertama"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-high disabled:opacity-30 disabled:pointer-events-none transition-all border border-outline-variant/10"
          title="Sebelumnya"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5 mx-1">
          {renderPageButtons()}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-high disabled:opacity-30 disabled:pointer-events-none transition-all border border-outline-variant/10"
          title="Berikutnya"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-high disabled:opacity-30 disabled:pointer-events-none transition-all border border-outline-variant/10"
          title="Terakhir"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
