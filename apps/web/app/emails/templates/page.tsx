'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { ArrowLeft, Zap, MousePointer, Pencil } from 'lucide-react';

interface Template {
  id: string;
  slug: string;
  name: string;
  subject: string;
  is_auto: boolean;
  trigger_event: string | null;
  updated_at: string;
  variables: string[];
}

const TRIGGER_LABELS: Record<string, string> = {
  'user.created':            'When client account is created',
  'matter.created':          'When a matter is opened',
  'matter.stage_changed':    'When matter stage changes',
  'matter.lawyer_assigned':  'When lawyer is assigned',
  'appointment.confirmed':   'When appointment is confirmed',
  'task.due_soon':           'Daily reminder (48h / 24h before due)',
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    supabase.from('email_templates').select('*').order('is_auto', { ascending: false }).order('name')
      .then(({ data }) => { setTemplates(data ?? []); setLoading(false); });
  }, []);

  const auto   = templates.filter(t => t.is_auto);
  const manual = templates.filter(t => !t.is_auto);

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/emails" className="text-[#8A817B] hover:text-[#241D1C]">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#241D1C]">Email Templates</h1>
          <p className="text-sm text-[#8A817B] mt-1">Edit content, subject lines, and branding for each template</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[#8A817B]">Loading…</p>
      ) : (
        <div className="space-y-8">
          {/* Automatic */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Zap size={15} className="text-[#B68A4E]" />
              <h2 className="text-sm font-semibold text-[#241D1C]">Automatic</h2>
              <span className="text-xs text-[#8A817B]">— sent automatically when triggered</span>
            </div>
            <div className="bg-white rounded-2xl border border-[#ECE4D9] overflow-hidden divide-y divide-[#F3EDE3]">
              {auto.map(tpl => (
                <div key={tpl.slug} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#241D1C]">{tpl.name}</p>
                    <p className="text-xs text-[#8A817B] mt-0.5 truncate">{tpl.subject}</p>
                    {tpl.trigger_event && (
                      <p className="text-xs text-[#B68A4E] mt-1">
                        ↯ {TRIGGER_LABELS[tpl.trigger_event] ?? tpl.trigger_event}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-[#B68A4E] font-medium border border-[#B68A4E]/30 rounded-full px-2 py-0.5 flex-shrink-0">
                    AUTO
                  </span>
                  <Link href={`/emails/templates/${tpl.slug}`}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#ECE4D9] text-xs font-medium text-[#6E635F] hover:bg-[#F6F1EA] transition-colors flex-shrink-0">
                    <Pencil size={13} /> Edit
                  </Link>
                </div>
              ))}
            </div>
          </section>

          {/* Manual */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <MousePointer size={15} className="text-[#6B1E2B]" />
              <h2 className="text-sm font-semibold text-[#241D1C]">Manual</h2>
              <span className="text-xs text-[#8A817B]">— sent on demand from the client list</span>
            </div>
            <div className="bg-white rounded-2xl border border-[#ECE4D9] overflow-hidden divide-y divide-[#F3EDE3]">
              {manual.map(tpl => (
                <div key={tpl.slug} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#241D1C]">{tpl.name}</p>
                    <p className="text-xs text-[#8A817B] mt-0.5 truncate">{tpl.subject}</p>
                  </div>
                  <Link href={`/emails/templates/${tpl.slug}`}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#ECE4D9] text-xs font-medium text-[#6E635F] hover:bg-[#F6F1EA] transition-colors flex-shrink-0">
                    <Pencil size={13} /> Edit
                  </Link>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
