'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { Search, Briefcase, Users, FileText, Clock, ChevronRight } from 'lucide-react';

interface Result {
  type: 'matter' | 'client' | 'document' | 'audit';
  id: string;
  title: string;
  subtitle: string;
  href: string;
  meta?: string;
}

const TYPE_CONFIG = {
  matter:   { icon: Briefcase, label: 'Matter',   cls: 'bg-[#FBF1EE] text-[#6B1E2B]' },
  client:   { icon: Users,     label: 'Client',   cls: 'bg-[#EAF1EC] text-[#3F7A5B]' },
  document: { icon: FileText,  label: 'Document', cls: 'bg-[#F6ECD8] text-[#9A6B1E]' },
  audit:    { icon: Clock,     label: 'Activity', cls: 'bg-[#F3EDE3] text-[#8A817B]'  },
};

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const q = searchParams.get('q');
    if (q) { setQuery(q); runSearch(q); }
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearched(false); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  async function runSearch(q: string) {
    const term = q.trim().toLowerCase();
    if (!term || term.length < 2) return;
    setLoading(true);
    setSearched(true);

    const [mattersRes, clientsRes, docsRes, auditRes] = await Promise.all([
      supabase.from('matters').select('id, matter_ref, title, type, stage, status, client:profiles!client_id(full_name)').or(`title.ilike.%${term}%,matter_ref.ilike.%${term}%,court.ilike.%${term}%,cause_no.ilike.%${term}%`).limit(8),
      supabase.from('profiles').select('id, full_name, email, phone').eq('role', 'client').or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`).limit(6),
      supabase.from('documents').select('id, name, status, matter_id, matter:matters!matter_id(matter_ref, title)').ilike('name', `%${term}%`).limit(6),
      supabase.from('audit_logs').select('id, action, created_at, matter_id, matter:matters!matter_id(matter_ref)').ilike('action', `%${term}%`).order('created_at', { ascending: false }).limit(6),
    ]);

    const out: Result[] = [];

    for (const m of (mattersRes.data ?? []) as any[]) {
      out.push({ type: 'matter', id: m.id, title: m.title, subtitle: `${m.matter_ref} · ${(m.client as any)?.full_name ?? ''} · ${m.type}`, href: `/matters/${m.id}`, meta: m.stage });
    }
    for (const c of (clientsRes.data ?? []) as any[]) {
      out.push({ type: 'client', id: c.id, title: c.full_name, subtitle: [c.email, c.phone].filter(Boolean).join(' · '), href: `/clients/${c.id}` });
    }
    for (const d of (docsRes.data ?? []) as any[]) {
      const m = d.matter as any;
      out.push({ type: 'document', id: d.id, title: d.name, subtitle: m ? `${m.matter_ref} — ${m.title}` : 'Unknown matter', href: `/matters/${d.matter_id}?tab=docs`, meta: d.status });
    }
    for (const a of (auditRes.data ?? []) as any[]) {
      out.push({ type: 'audit', id: a.id, title: a.action, subtitle: (a.matter as any)?.matter_ref ?? '', href: a.matter_id ? `/matters/${a.matter_id}?tab=audit` : '#', meta: relTime(a.created_at) });
    }

    setResults(out);
    setLoading(false);
  }

  function relTime(iso: string) {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    return d < 1 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`;
  }

  const grouped = (['matter', 'client', 'document', 'audit'] as const).map((type) => ({
    type, items: results.filter((r) => r.type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="p-8 max-w-3xl">
      {/* Search input */}
      <div className="flex items-center gap-3 bg-white border border-[#ECE4D9] rounded-2xl px-4 py-3 mb-8 shadow-sm focus-within:border-[#6B1E2B] focus-within:shadow-md transition-all">
        <Search size={18} className="text-[#A89F99] flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search matters, clients, documents, activity…"
          className="flex-1 text-[#241D1C] placeholder-[#C5BBB5] outline-none text-base bg-transparent"
          onKeyDown={(e) => { if (e.key === 'Escape') setQuery(''); }}
        />
        {loading && <div className="w-4 h-4 border-2 border-[#6B1E2B]/30 border-t-[#6B1E2B] rounded-full animate-spin flex-shrink-0" />}
        {query && !loading && (
          <button onClick={() => { setQuery(''); setResults([]); setSearched(false); inputRef.current?.focus(); }} className="text-[#A89F99] hover:text-[#6B1E2B] transition-colors text-sm">✕</button>
        )}
      </div>

      {/* Results */}
      {!searched && (
        <div className="text-center py-16">
          <Search size={32} className="text-[#C5BBB5] mx-auto mb-3" strokeWidth={1.2} />
          <p className="text-sm text-[#A89F99]">Search across all matters, clients, documents and activity</p>
          <p className="text-xs text-[#C5BBB5] mt-1">Type at least 2 characters to search</p>
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <div className="text-center py-16">
          <p className="text-sm text-[#A89F99]">No results for "{query}"</p>
          <p className="text-xs text-[#C5BBB5] mt-1">Try different keywords or check spelling</p>
        </div>
      )}

      <div className="space-y-6">
        {grouped.map(({ type, items }) => {
          const { icon: Icon, label, cls } = TYPE_CONFIG[type];
          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label.toUpperCase()}</span>
                <span className="text-xs text-[#C5BBB5]">{items.length} result{items.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="bg-white border border-[#ECE4D9] rounded-2xl overflow-hidden divide-y divide-[#F3EDE3]">
                {items.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => router.push(r.href)}
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-[#FBF1EE] transition-colors text-left group"
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${cls}`}>
                      <Icon size={14} strokeWidth={1.8} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#241D1C] truncate">{r.title}</p>
                      {r.subtitle && <p className="text-xs text-[#A89F99] truncate mt-0.5">{r.subtitle}</p>}
                    </div>
                    {r.meta && <span className="text-[10px] text-[#A89F99] flex-shrink-0 capitalize">{r.meta}</span>}
                    <ChevronRight size={14} className="text-[#C5BBB5] group-hover:text-[#6B1E2B] transition-colors flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
