'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PageShell } from '../../components/PageShell';
import { Bell, Send, X, CheckCircle, Clock } from 'lucide-react';

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  matter_id: string | null;
  user: { full_name: string; email: string } | null;
  matter: { matter_ref: string } | null;
}

interface Client { id: string; full_name: string; }

const TYPE_COLORS: Record<string, string> = {
  case_update:  'bg-[#FBF1EE] text-[#6B1E2B]',
  invoice_sent: 'bg-[#F6ECD8] text-[#9A6B1E]',
  document:     'bg-[#F6ECD8] text-[#B68A4E]',
  appointment:  'bg-[#EAF1EC] text-[#3F7A5B]',
  general:      'bg-[#F3EDE3] text-[#8A817B]',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function relTime(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');

  const [composeModal, setComposeModal] = useState(false);
  const [composeClient, setComposeClient] = useState('');
  const [composeTitle, setComposeTitle] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeSending, setComposeSending] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const [notifsRes, clientsRes] = await Promise.all([
      supabase
        .from('notifications')
        .select('id, type, title, body, read_at, created_at, matter_id, user:profiles!user_id(full_name, email), matter:matters!matter_id(matter_ref)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('profiles').select('id, full_name').eq('role', 'client').order('full_name'),
    ]);
    if (notifsRes.data) setNotifs(notifsRes.data as unknown as Notif[]);
    if (clientsRes.data) setClients(clientsRes.data);
    setLoading(false);
  }

  async function sendNotification() {
    if (!composeClient || !composeTitle.trim() || !composeBody.trim()) return;
    setComposeSending(true);
    await supabase.from('notifications').insert({
      user_id: composeClient,
      type: 'general',
      title: composeTitle.trim(),
      body: composeBody.trim(),
    });
    setComposeSending(false);
    setComposeModal(false);
    setComposeTitle(''); setComposeBody(''); setComposeClient('');
    load();
  }

  const allTypes = [...new Set(notifs.map((n) => n.type))];
  const filtered = notifs.filter((n) => {
    if (typeFilter !== 'all' && n.type !== typeFilter) return false;
    if (readFilter === 'unread' && n.read_at) return false;
    if (readFilter === 'read' && !n.read_at) return false;
    return true;
  });

  const totalUnread = notifs.filter((n) => !n.read_at).length;

  return (
    <PageShell title="Notifications" action={
      <button onClick={() => setComposeModal(true)}
        className="flex items-center gap-2 bg-[#6B1E2B] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#4A141E] transition-colors">
        <Send size={15} /> Send Notification
      </button>
    }>
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-[#ECE4D9] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-[#FBF1EE] flex items-center justify-center"><Bell size={18} className="text-[#6B1E2B]" /></div>
            <span className="text-[10px] font-semibold text-[#8A817B] tracking-wider">TOTAL SENT</span>
          </div>
          <p className="text-2xl font-bold text-[#241D1C]">{notifs.length}</p>
        </div>
        <div className="bg-white border border-[#ECE4D9] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-[#F6ECD8] flex items-center justify-center"><Clock size={18} className="text-[#9A6B1E]" /></div>
            <span className="text-[10px] font-semibold text-[#8A817B] tracking-wider">UNREAD</span>
          </div>
          <p className="text-2xl font-bold text-[#241D1C]">{totalUnread}</p>
          <p className="text-xs text-[#A89F99] mt-0.5">{notifs.length > 0 ? `${Math.round((1 - totalUnread / notifs.length) * 100)}% read rate` : ''}</p>
        </div>
        <div className="bg-white border border-[#ECE4D9] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-[#EAF1EC] flex items-center justify-center"><CheckCircle size={18} className="text-[#3F7A5B]" /></div>
            <span className="text-[10px] font-semibold text-[#8A817B] tracking-wider">READ</span>
          </div>
          <p className="text-2xl font-bold text-[#241D1C]">{notifs.filter((n) => n.read_at).length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#ECE4D9] rounded-2xl overflow-hidden">
        <div className="flex items-center gap-4 px-5 py-3 border-b border-[#ECE4D9] flex-wrap">
          <div className="flex gap-1">
            {(['all', 'unread', 'read'] as const).map((r) => (
              <button key={r} onClick={() => setReadFilter(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${readFilter === r ? 'bg-[#6B1E2B] text-white' : 'text-[#8A817B] hover:bg-[#F6F1EA]'}`}>
                {r}
              </button>
            ))}
          </div>
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${typeFilter === 'all' ? 'bg-[#241D1C] text-white' : 'text-[#8A817B] hover:bg-[#F6F1EA]'}`}>
              All types
            </button>
            {allTypes.map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${typeFilter === t ? 'bg-[#241D1C] text-white' : 'text-[#8A817B] hover:bg-[#F6F1EA]'}`}>
                {t.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-[#A89F99]">{filtered.length} notifications</span>
        </div>

        {loading ? (
          <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-[#6B1E2B]/30 border-t-[#6B1E2B] rounded-full animate-spin mx-auto" /></div>
        ) : (
          <div className="divide-y divide-[#F3EDE3]">
            {filtered.map((n) => (
              <div key={n.id} className={`flex items-start gap-4 px-5 py-4 transition-colors ${!n.read_at ? 'bg-[#FBF9F7]' : 'hover:bg-[#FBF1EE]'}`}>
                <div className="flex-shrink-0 mt-0.5">
                  <div className={`w-2 h-2 rounded-full mt-1.5 ${!n.read_at ? 'bg-[#6B1E2B]' : 'bg-[#ECE4D9]'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-[#241D1C]">{n.title}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${TYPE_COLORS[n.type] ?? 'bg-[#F3EDE3] text-[#8A817B]'}`}>
                      {n.type.replace(/_/g, ' ')}
                    </span>
                    {!n.read_at && <span className="text-[10px] font-semibold text-[#6B1E2B] bg-[#FBF1EE] px-2 py-0.5 rounded-full">Unread</span>}
                  </div>
                  <p className="text-sm text-[#6E635F] mb-1.5">{n.body}</p>
                  <div className="flex items-center gap-3 text-xs text-[#A89F99]">
                    {n.user && <span className="font-medium text-[#6E635F]">{n.user.full_name}</span>}
                    {n.matter && <span className="font-mono text-[#9A6B1E]">{n.matter.matter_ref}</span>}
                    <span>{relTime(n.created_at)}</span>
                  </div>
                </div>
                <div className="text-xs text-[#C5BBB5] flex-shrink-0 text-right">
                  {n.read_at ? (
                    <span className="text-[#3F7A5B]">✓ Read</span>
                  ) : (
                    <span className="text-[#A89F99]">{fmtDate(n.created_at)}</span>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-[#A89F99]">No notifications match the current filter.</div>
            )}
          </div>
        )}
      </div>

      {/* Compose modal */}
      {composeModal && (
        <div className="fixed inset-0 bg-[rgba(28,21,18,0.5)] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-[#241D1C]">Send Notification</h3>
              <button onClick={() => setComposeModal(false)} className="text-[#A89F99] hover:text-[#241D1C]"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="field-label">CLIENT</label>
                <select className="field-input" value={composeClient} onChange={(e) => setComposeClient(e.target.value)}>
                  <option value="">Select client…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">TITLE</label>
                <input className="field-input" value={composeTitle} onChange={(e) => setComposeTitle(e.target.value)} placeholder="Notification title…" maxLength={100} />
              </div>
              <div>
                <label className="field-label">MESSAGE</label>
                <textarea
                  className="field-input resize-none h-24 py-3"
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your message…"
                  maxLength={500}
                />
                <p className="text-xs text-[#A89F99] mt-1 text-right">{composeBody.length}/500</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setComposeModal(false)} className="flex-1 h-11 rounded-xl border border-[#ECE4D9] text-[#6E635F] text-sm font-medium hover:bg-[#F6F1EA] transition-colors">Cancel</button>
              <button
                onClick={sendNotification}
                disabled={composeSending || !composeClient || !composeTitle.trim() || !composeBody.trim()}
                className="flex-1 h-11 rounded-xl bg-[#6B1E2B] text-white text-sm font-semibold hover:bg-[#4A141E] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {composeSending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send size={14} /> Send</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .field-label { display: block; font-size: 10px; font-weight: 500; color: #8A817B; letter-spacing: 0.1em; margin-bottom: 6px; }
        .field-input { width: 100%; height: 44px; border: 1px solid #ECE4D9; border-radius: 12px; padding: 0 14px; background: #F6F1EA; color: #241D1C; font-size: 14px; outline: none; }
        .field-input:focus { border-color: #6B1E2B; box-shadow: 0 0 0 1px #6B1E2B; }
      `}</style>
    </PageShell>
  );
}
