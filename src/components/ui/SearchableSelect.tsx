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
        className="flex items-center justify-between w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-slate-300 cursor-pointer hover:border-slate-500 transition-colors"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setSearch("");
        }}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0 ml-2" />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-600 rounded-md shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-slate-800 bg-slate-900/90 backdrop-blur-sm">
            <input
              type="text"
              autoFocus
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50"
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
                  className={`px-3 py-2 text-sm cursor-pointer transition-colors ${value === opt ? 'bg-amber-500/20 text-amber-400 font-medium' : 'text-slate-300 hover:bg-slate-800'}`}
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                  }}
                >
                  {opt}
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-center text-slate-500">
                검색 결과가 없습니다
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
