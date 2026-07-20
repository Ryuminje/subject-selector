import React, { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

interface SearchableSelectProps {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export const SearchableSelect = ({ options, value, onChange, placeholder = "검색..." }: SearchableSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div
        className="flex items-center justify-between w-full bg-white border border-stone-300 rounded-md px-3 py-2 text-stone-700 cursor-pointer hover:border-stone-400 transition-colors"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setSearch("");
        }}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className="w-4 h-4 text-stone-400 shrink-0 ml-2" />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-stone-300 rounded-md shadow-xl overflow-hidden">
          <div className="p-2 border-b border-stone-200 bg-white/90 backdrop-blur-sm">
            <input
              type="text"
              autoFocus
              className="w-full bg-stone-50 border border-stone-300 rounded px-2 py-1.5 text-sm text-stone-700 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50"
              placeholder={placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => (
                <div
                  key={opt}
                  className={`px-3 py-2 text-sm cursor-pointer transition-colors ${value === opt ? 'bg-amber-100 text-amber-700 font-medium' : 'text-stone-600 hover:bg-stone-100'}`}
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                  }}
                >
                  {opt}
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-center text-stone-400">
                검색 결과가 없습니다
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
