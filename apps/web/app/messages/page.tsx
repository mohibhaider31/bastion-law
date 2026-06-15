'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { PageShell } from '../../components/PageShell';
import { Send, MessageSquare } from 'lucide-react';

interface ClientThread {
  client_id: string;
  client_name: string;
  last_body: string;
  last_at: string;
  unread: number;
}

interface Message {
  id: string;
  body: string;
  created_at: string;
  sender_id: string;
  attachment_url: string | null;
  attachment_name: string | null;
  sender: { full_name: string; role: string } | null;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function relTime(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d < 1) return new Date(iso).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}

export default function MessagesPage() {
  const [threads, setThreads] = useState<ClientThread[]>([]);
  const [selected, setSelected] = useState<ClientThread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ id: string; full_name: string } | null>(null);
  const msgEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase.from('profiles').select('id, full_name').eq('id', data.user.id).single().then(({ data: p }) => {
        if (p) setProfile(p as any);
      });
    });
    loadThreads();
  }, []);

  async function loadThreads() {
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, body, created_at, sender_id, client_id, read_at, sender:profiles!sender_id(role)')
      .is('matter_id', null)
      .order('created_at', { ascending: false });

    if (!msgs) { setLoading(false); return; }

    // Group by client_id
    const byClient = new Map<string, any[]>();
    for (const m of msgs) {
      const cid = (m as any).client_id;
      if (!cid) continue;
      if (!byClient.has(cid)) byClient.set(cid, []);
      byClient.get(cid)!.push(m);
    }

    // Fetch client names
    const clientIds = Array.from(byClient.keys());
    let clientMap: Record<string, string> = {};
    if (clientIds.length) {
      const { data: clients } = await supabase.from('profiles').select('id, full_name').in('id', clientIds);
      for (const c of (clients ?? []) as any[]) clientMap[c.id] = c.full_name;
    }

    const threadList: ClientThread[] = Array.from(byClient.entries()).map(([cid, cmsgs]) => {
      const last = cmsgs[0];
      const unread = cmsgs.filter((m) => (m.sender as any)?.role === 'client' && !m.read_at).length;
      return {
        client_id: cid,
        client_name: clientMap[cid] ?? 'Unknown',
        last_body: last.body ?? '(attachment)',
        last_at: last.created_at,
        unread,
      };
    }).sort((a, b) => b.last_at.localeCompare(a.last_at));

    setThreads(threadList);
    setLoading(false);
  }

  const loadMessages = useCallback(async (clientId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('id, body, created_at, sender_id, attachment_url, attachment_name, sender:profiles!sender_id(full_name, role)')
      .is('matter_id', null)
      .eq('client_id', clientId)
      .order('created_at');
    if (data) setMessages(data as unknown as Message[]);
    setTimeout(() => msgEndRef.current?.scrollIntoView(), 80);

    // Mark incoming client messages as read
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .is('matter_id', null)
      .eq('client_id', clientId)
      .neq('sender_id', clientId)
      .is('read_at', null);

    setThreads((prev) => prev.map((t) => t.client_id === clientId ? { ...t, unread: 0 } : t));
  }, []);

  useEffect(() => {
    if (!selected) return;
    loadMessages(selected.client_id);
    const channel = supabase.channel(`firm-inbox-${selected.client_id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${selected.client_id}` }, () => {
        loadMessages(selected.client_id);
        loadThreads();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected, loadMessages]);

  async function sendMessage() {
    if (!text.trim() || !selected || !profile) return;
    setSending(true);
    await supabase.from('messages').insert({
      matter_id: null,
      client_id: selected.client_id,
      sender_id: profile.id,
      body: text.trim(),
    });
    setText('');
    setSending(false);
    loadMessages(selected.client_id);
    loadThreads();
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const totalUnread = threads.reduce((s, t) => s + t.unread, 0);

  return (
    <PageShell title={totalUnread > 0 ? `Messages (${totalUnread})` : 'Messages'}>
      <div className="flex gap-4 h-[calc(100vh-10rem)]">
        {/* Thread list */}
        <div className="w-72 flex-shrink-0 bg-white border border-[#ECE4D9] rounded-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[#ECE4D9]">
            <p className="text-[10px] font-semibold text-[#8A817B] tracking-widest">DIRECT MESSAGES</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex justify-center py-10">
                <div className="w-5 h-5 border-2 border-[#6B1E2B]/30 border-t-[#6B1E2B] rounded-full animate-spin" />
              </div>
            )}
            {!loading && threads.length === 0 && (
              <div className="text-center py-12">
                <MessageSquare size={28} className="text-[#C5BBB5] mx-auto mb-2" strokeWidth={1.2} />
                <p className="text-xs text-[#A89F99]">No direct messages yet.</p>
              </div>
            )}
            {threads.map((t) => (
              <button
                key={t.client_id}
                onClick={() => setSelected(t)}
                className={`w-full px-4 py-3.5 text-left border-b border-[#F3EDE3] transition-colors ${selected?.client_id === t.client_id ? 'bg-[#FBF1EE]' : 'hover:bg-[#FBF9F7]'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#F0E3E1] flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-[#6B1E2B]">
                        {t.client_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm truncate ${t.unread > 0 ? 'font-semibold text-[#241D1C]' : 'font-medium text-[#241D1C]'}`}>{t.client_name}</p>
                      <p className="text-xs text-[#A89F99] truncate mt-0.5">{t.last_body}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-[10px] text-[#A89F99]">{relTime(t.last_at)}</span>
                    {t.unread > 0 && (
                      <span className="w-5 h-5 rounded-full bg-[#6B1E2B] text-white text-[10px] font-bold flex items-center justify-center">{t.unread > 9 ? '9+' : t.unread}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Conversation panel */}
        <div className="flex-1 bg-white border border-[#ECE4D9] rounded-2xl flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <MessageSquare size={40} className="text-[#C5BBB5] mb-3" strokeWidth={1.2} />
              <p className="text-sm text-[#A89F99]">Select a conversation to start messaging</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-5 py-4 border-b border-[#ECE4D9] flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#F0E3E1] flex items-center justify-center">
                  <span className="text-[9px] font-bold text-[#6B1E2B]">
                    {selected.client_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#241D1C]">{selected.client_name}</p>
                  <p className="text-xs text-[#A89F99]">Direct message · Bastion Law</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {messages.map((m) => {
                  const isOwn = m.sender_id === profile?.id;
                  return (
                    <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                        {!isOwn && (
                          <span className="text-[10px] text-[#A89F99] px-1">{m.sender?.full_name ?? 'Client'}</span>
                        )}
                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isOwn ? 'bg-[#6B1E2B] text-white rounded-br-sm' : 'bg-[#F6F1EA] text-[#241D1C] rounded-bl-sm'}`}>
                          {m.body}
                          {m.attachment_name && (
                            <a href={m.attachment_url ?? '#'} target="_blank" rel="noopener noreferrer"
                              className={`block text-xs mt-1.5 underline ${isOwn ? 'text-white/80' : 'text-[#6B1E2B]'}`}>
                              📎 {m.attachment_name}
                            </a>
                          )}
                        </div>
                        <span className="text-[10px] text-[#A89F99] px-1">{fmtTime(m.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
                <div ref={msgEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-[#ECE4D9]">
                <div className="flex items-end gap-3 bg-[#F6F1EA] rounded-2xl px-4 py-3">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder={`Reply to ${selected.client_name}…`}
                    rows={1}
                    className="flex-1 bg-transparent text-sm text-[#241D1C] placeholder-[#A89F99] outline-none resize-none max-h-32"
                    style={{ lineHeight: '1.5' }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!text.trim() || sending}
                    className="w-9 h-9 rounded-xl bg-[#6B1E2B] flex items-center justify-center flex-shrink-0 hover:bg-[#4A141E] disabled:opacity-40 transition-colors"
                  >
                    <Send size={15} className="text-white" />
                  </button>
                </div>
                <p className="text-[10px] text-[#C5BBB5] mt-1.5 px-1">Enter to send · Shift+Enter for new line</p>
              </div>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}
