import React from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';

export type SearchableSelectOption = {
  value: string;
  label: string;
};

type SearchableSelectProps = {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
};

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Pilih...',
  searchPlaceholder = 'Cari...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filtered = React.useMemo(() => {
    if (!searchTerm.trim()) return options;
    const lower = searchTerm.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(lower));
  }, [options, searchTerm]);

  // Close on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  React.useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-outline-variant/20 bg-surface-high py-2.5 pl-3 pr-3 text-body-sm font-semibold text-on-surface outline-none focus:ring-2 focus:ring-primary/40 transition-colors hover:border-outline-variant/40"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-on-surface-variant flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[220px] rounded-lg border border-outline-variant/20 bg-surface shadow-xl shadow-black/20 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Search input */}
          <div className="p-2 border-b border-outline-variant/15">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-variant" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-outline-variant/15 bg-surface-high py-2 pl-8 pr-8 text-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-on-surface-variant/50"
                aria-label="Cari opsi"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-on-surface-variant hover:text-on-surface"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <ul
            role="listbox"
            className="max-h-[240px] overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-center text-body-sm text-on-surface-variant">
                Tidak ditemukan
              </li>
            ) : (
              filtered.map((opt) => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === value}
                  onClick={() => handleSelect(opt.value)}
                  className={`flex items-center gap-2 px-3 py-2 text-body-sm cursor-pointer transition-colors ${
                    opt.value === value
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-on-surface hover:bg-surface-high'
                  }`}
                >
                  {opt.value === value && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                  <span className={`truncate ${opt.value === value ? '' : 'pl-[22px]'}`}>{opt.label}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
