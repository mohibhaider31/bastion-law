'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabase';
import { buildEmailHtml, replaceVars, TEMPLATE_VARIABLES, type FirmSettings } from '../../../../lib/email';
import { ArrowLeft, Save, RefreshCw, Monitor, Info } from 'lucide-react';

const DEFAULT_SETTINGS: FirmSettings = {
  from_email:    'noreply@bastionlaw.pk',
  from_name:     'Bastion Law',
  reply_to:      null,
  logo_url:      null,
  primary_color: '#6B1E2B',
  accent_color:  '#B68A4E',
  firm_address:  null,
};

const SAMPLE_VARS: Record<string, string> = {
  client_name:      'Tariq Enterprises Ltd',
  client_email:     'tariq@enterprises.pk',
  temp_password:    'TempP@ss123!',
  matter_ref:       'MAT-2026-001',
  matter_type:      'Commercial Dispute',
  new_stage:        'Filing',
  custom_message:   'Your documents have been reviewed and filed with the court.',
  lawyer_name:      'Zara Hussain',
  invoice_ref:      'INV-2026-042',
  amount_pkr:       'PKR 150,000',
  due_date:         '30 June 2026',
  appointment_date: '25 June 2026, 3:00 PM',
  meeting_type:     'Video Call',
  video_room_url:   'https://meet.jit.si/bastion-example',
  task_title:       'Submit signed affidavit',
};

export default function TemplateEditorPage() {
  const { slug }    = useParams<{ slug: string }>();
  const router      = useRouter();
  const iframeRef   = useRef<HTMLIFrameElement>(null);

  const [subject, setSubject]     = useState('');
  const [bodyHtml, setBodyHtml]   = useState('');
  const [settings, setSettings]   = useState<FirmSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [variables, setVariables] = useState<string[]>([]);
  const [showVars, setShowVars]   = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('email_templates').select('*').eq('slug', slug).single(),
      supabase.from('firm_settings').select('*').limit(1).single(),
    ]).then(([tplRes, settingsRes]) => {
      if (tplRes.data) {
        setSubject(tplRes.data.subject);
        setBodyHtml(tplRes.data.body_html);
        setVariables(tplRes.data.variables ?? []);
      }
      if (settingsRes.data) setSettings(settingsRes.data as FirmSettings);
      setLoading(false);
    });
  }, [slug]);

  // Render preview whenever body or settings change
  useEffect(() => {
    if (!iframeRef.current) return;
    const allVars = {
      ...SAMPLE_VARS,
      firm_name:     settings.from_name,
      from_email:    settings.from_email,
      primary_color: settings.primary_color,
      accent_color:  settings.accent_color,
    };
    const renderedBody = replaceVars(bodyHtml, allVars);
    const html         = buildEmailHtml(renderedBody, settings);
    const doc = iframeRef.current.contentDocument;
    if (doc) { doc.open(); doc.write(html); doc.close(); }
  }, [bodyHtml, settings]);

  async function save() {
    setSaving(true);
    await supabase.from('email_templates')
      .update({ subject, body_html: bodyHtml, updated_at: new Date().toISOString() })
      .eq('slug', slug);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function insertVar(v: string) {
    setBodyHtml(prev => prev + `{{${v}}}`);
  }

  if (loading) return <div className="p-8 text-sm text-[#8A817B]">Loading…</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-[#ECE4D9] bg-white">
        <div className="flex items-center gap-3">
          <Link href="/emails/templates" className="text-[#8A817B] hover:text-[#241D1C]">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-base font-semibold text-[#241D1C] capitalize">{slug.replace(/_/g, ' ')} Template</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowVars(!showVars)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
              showVars ? 'border-[#6B1E2B] text-[#6B1E2B] bg-[#F0E3E1]' : 'border-[#ECE4D9] text-[#6E635F] hover:bg-[#F6F1EA]'
            }`}>
            <Info size={13} /> Variables
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6B1E2B] text-white text-sm font-medium hover:bg-[#4A141E] transition-colors disabled:opacity-60">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Editor panel */}
        <div className="w-1/2 flex flex-col border-r border-[#ECE4D9] overflow-y-auto">
          <div className="p-6 space-y-5">
            {/* Subject */}
            <div>
              <label className="block text-xs font-medium text-[#8A817B] uppercase tracking-wider mb-2">Subject Line</label>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full border border-[#ECE4D9] rounded-xl px-4 py-3 text-sm bg-[#F6F1EA] focus:outline-none focus:border-[#6B1E2B] font-medium"
              />
            </div>

            {/* Branding quick-edit */}
            <div className="bg-[#F6F1EA] rounded-xl p-4 space-y-3">
              <p className="text-xs font-medium text-[#8A817B] uppercase tracking-wider">Branding (from Settings)</p>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[11px] text-[#8A817B] mb-1">Header Color</p>
                  <div className="flex items-center gap-2">
                    <input type="color" value={settings.primary_color}
                      onChange={e => setSettings(s => ({ ...s, primary_color: e.target.value }))}
                      className="w-8 h-8 rounded cursor-pointer border border-[#ECE4D9]"
                    />
                    <span className="text-xs text-[#6E635F] font-mono">{settings.primary_color}</span>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-[#8A817B] mb-1">From Name</p>
                  <input value={settings.from_name}
                    onChange={e => setSettings(s => ({ ...s, from_name: e.target.value }))}
                    className="border border-[#ECE4D9] rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-[#6B1E2B]"
                  />
                </div>
              </div>
              <p className="text-[11px] text-[#A89F99]">
                These are preview values. Save permanent changes in{' '}
                <Link href="/settings" className="text-[#6B1E2B] underline">Settings → Email</Link>.
              </p>
            </div>

            {/* Variables panel */}
            {showVars && (
              <div className="bg-white border border-[#ECE4D9] rounded-xl p-4">
                <p className="text-xs font-medium text-[#8A817B] uppercase tracking-wider mb-3">Available Variables</p>
                <div className="flex flex-wrap gap-2">
                  {variables.filter(v => TEMPLATE_VARIABLES[v]).map(v => (
                    <button key={v} onClick={() => insertVar(v)}
                      title={`Example: ${TEMPLATE_VARIABLES[v]?.example}`}
                      className="text-xs bg-[#F6F1EA] border border-[#ECE4D9] rounded-lg px-2.5 py-1 font-mono text-[#6B1E2B] hover:bg-[#F0E3E1] transition-colors">
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[#A89F99] mt-3">Click a variable to insert it at the end of the body.</p>
              </div>
            )}

            {/* Body HTML */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-[#8A817B] uppercase tracking-wider">Email Body (HTML)</label>
                <span className="text-[11px] text-[#A89F99]">Preview updates live →</span>
              </div>
              <textarea
                value={bodyHtml}
                onChange={e => setBodyHtml(e.target.value)}
                rows={22}
                className="w-full border border-[#ECE4D9] rounded-xl px-4 py-3 text-sm bg-[#F6F1EA] focus:outline-none focus:border-[#6B1E2B] font-mono resize-none leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Preview panel */}
        <div className="w-1/2 bg-[#F6F1EA] flex flex-col">
          <div className="flex items-center gap-2 px-6 py-3 border-b border-[#ECE4D9] bg-white">
            <Monitor size={14} className="text-[#8A817B]" />
            <span className="text-xs font-medium text-[#8A817B]">Live Preview — sample data</span>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <iframe
              ref={iframeRef}
              className="w-full rounded-xl border border-[#ECE4D9] bg-white"
              style={{ height: '700px' }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
