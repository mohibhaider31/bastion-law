'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PageShell } from '../dashboard/page';
import { Shield, ShieldCheck, Trash2, RefreshCw, Mail, Save } from 'lucide-react';

interface FirmSettingsRow {
  id: string;
  from_email: string;
  from_name: string;
  reply_to: string | null;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  firm_address: string | null;
}

interface MFAFactor {
  id: string;
  factor_type: string;
  friendly_name: string | null;
  status: string;
}

interface ProfileUser {
  id: string;
  email: string;
  full_name: string;
}

export default function SettingsPage() {
  const [firmSettings, setFirmSettings] = useState<FirmSettingsRow | null>(null);
  const [savingEmail, setSavingEmail]   = useState(false);
  const [emailSaved, setEmailSaved]     = useState(false);

  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [users, setUsers] = useState<ProfileUser[]>([]);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => { loadFactors(); loadUsers(); loadFirmSettings(); }, []);

  async function loadFirmSettings() {
    const { data } = await supabase.from('firm_settings').select('*').limit(1).single();
    if (data) setFirmSettings(data as FirmSettingsRow);
  }

  async function saveFirmSettings() {
    if (!firmSettings) return;
    setSavingEmail(true);
    await supabase.from('firm_settings').update({
      from_email:    firmSettings.from_email,
      from_name:     firmSettings.from_name,
      reply_to:      firmSettings.reply_to || null,
      logo_url:      firmSettings.logo_url || null,
      primary_color: firmSettings.primary_color,
      accent_color:  firmSettings.accent_color,
      firm_address:  firmSettings.firm_address || null,
      updated_at:    new Date().toISOString(),
    }).eq('id', firmSettings.id);
    setSavingEmail(false);
    setEmailSaved(true);
    setTimeout(() => setEmailSaved(false), 2500);
  }

  async function loadFactors() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as MFAFactor[]);
  }

  async function loadUsers() {
    const { data } = await supabase.from('profiles').select('id, full_name').in('role', ['lawyer', 'owner']);
    if (data) {
      const { data: { user } } = await supabase.auth.getUser();
      setUsers(data.map((u: any) => ({ id: u.id, email: '', full_name: u.full_name })));
    }
  }

  async function startEnroll() {
    setEnrolling(true);
    setMsg(null);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Bastion Law' });
    if (error || !data) { setMsg({ type: 'err', text: error?.message ?? 'Failed to start enrollment' }); setEnrolling(false); return; }
    setQrCode(data.totp.qr_code);
    setTotpUri(data.totp.uri);
    setEnrollFactorId(data.id);
    setEnrolling(false);
  }

  async function verifyEnroll() {
    if (!enrollFactorId || !verifyCode) return;
    setVerifying(true);
    const challengeRes = await supabase.auth.mfa.challenge({ factorId: enrollFactorId });
    if (challengeRes.error) { setMsg({ type: 'err', text: challengeRes.error.message }); setVerifying(false); return; }
    const { error } = await supabase.auth.mfa.verify({ factorId: enrollFactorId, challengeId: challengeRes.data.id, code: verifyCode });
    if (error) { setMsg({ type: 'err', text: error.message }); setVerifying(false); return; }
    setMsg({ type: 'ok', text: 'MFA enrolled successfully. You\'ll be prompted for a code on next sign-in.' });
    setQrCode(null); setTotpUri(null); setEnrollFactorId(null); setVerifyCode('');
    setVerifying(false);
    loadFactors();
  }

  async function unenroll(factorId: string) {
    if (!confirm('Remove this MFA factor? You will no longer need a code to sign in.')) return;
    await supabase.auth.mfa.unenroll({ factorId });
    loadFactors();
  }

  async function revokeUserSessions(userId: string) {
    setRevokingId(userId);
    const res = await fetch('/api/revoke-sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) });
    const data = await res.json();
    if (data.error) setMsg({ type: 'err', text: data.error });
    else setMsg({ type: 'ok', text: 'Sessions revoked. User will be signed out on next API call.' });
    setRevokingId(null);
  }

  return (
    <PageShell title="Settings & Security">
      {msg && (
        <div className={`mb-5 px-4 py-3 rounded-xl text-sm font-medium ${msg.type === 'ok' ? 'bg-[#EAF1EC] text-[#3F7A5B]' : 'bg-[#FDF0EE] text-[#C0392B]'}`}>
          {msg.text}
        </div>
      )}

      {/* Email Settings */}
      {firmSettings && (
        <div className="bg-white border border-[#ECE4D9] rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Mail size={20} className="text-[#6B1E2B]" strokeWidth={1.7} />
              <h2 className="text-base font-semibold text-[#241D1C]">Email Configuration</h2>
            </div>
            <button onClick={saveFirmSettings} disabled={savingEmail}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6B1E2B] text-white text-sm font-medium hover:bg-[#4A141E] transition-colors disabled:opacity-60">
              {savingEmail ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              {emailSaved ? 'Saved!' : 'Save'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'From Name',     key: 'from_name',    placeholder: 'Bastion Law' },
              { label: 'From Email',    key: 'from_email',   placeholder: 'noreply@bastionlaw.pk' },
              { label: 'Reply-To',      key: 'reply_to',     placeholder: 'info@bastionlaw.pk (optional)' },
              { label: 'Firm Address',  key: 'firm_address', placeholder: 'e.g. Plot 42, PECHS, Karachi (optional)' },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className={key === 'firm_address' ? 'col-span-2' : ''}>
                <label className="block text-xs font-medium text-[#8A817B] uppercase tracking-wider mb-1.5">{label}</label>
                <input
                  value={(firmSettings as any)[key] ?? ''}
                  onChange={e => setFirmSettings((s: any) => ({ ...s, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full border border-[#ECE4D9] rounded-xl px-4 py-2.5 text-sm bg-[#F6F1EA] focus:outline-none focus:border-[#6B1E2B]"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-[#8A817B] uppercase tracking-wider mb-1.5">Primary Color</label>
              <div className="flex items-center gap-3">
                <input type="color" value={firmSettings.primary_color}
                  onChange={e => setFirmSettings(s => s ? { ...s, primary_color: e.target.value } : s)}
                  className="w-10 h-10 rounded-lg border border-[#ECE4D9] cursor-pointer"
                />
                <span className="text-sm font-mono text-[#6E635F]">{firmSettings.primary_color}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8A817B] uppercase tracking-wider mb-1.5">Accent Color</label>
              <div className="flex items-center gap-3">
                <input type="color" value={firmSettings.accent_color}
                  onChange={e => setFirmSettings(s => s ? { ...s, accent_color: e.target.value } : s)}
                  className="w-10 h-10 rounded-lg border border-[#ECE4D9] cursor-pointer"
                />
                <span className="text-sm font-mono text-[#6E635F]">{firmSettings.accent_color}</span>
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#8A817B] uppercase tracking-wider mb-1.5">Logo URL</label>
              <input
                value={firmSettings.logo_url ?? ''}
                onChange={e => setFirmSettings(s => s ? { ...s, logo_url: e.target.value } : s)}
                placeholder="https://... (leave blank to use firm name as text)"
                className="w-full border border-[#ECE4D9] rounded-xl px-4 py-2.5 text-sm bg-[#F6F1EA] focus:outline-none focus:border-[#6B1E2B]"
              />
            </div>
          </div>
          <p className="text-xs text-[#A89F99] mt-4">
            Add <code className="bg-[#F6F1EA] px-1 rounded font-mono">RESEND_API_KEY</code> to your <code className="bg-[#F6F1EA] px-1 rounded font-mono">.env.local</code> to activate email sending. Without it, emails are logged to console only.
          </p>
        </div>
      )}

      {/* MFA Section */}
      <div className="bg-white border border-[#ECE4D9] rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <Shield size={20} className="text-[#6B1E2B]" strokeWidth={1.7} />
          <h2 className="text-base font-semibold text-[#241D1C]">Two-Factor Authentication</h2>
        </div>

        {factors.length > 0 && (
          <div className="mb-5 space-y-3">
            {factors.map((f) => (
              <div key={f.id} className="flex items-center justify-between bg-[#EAF1EC] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-[#3F7A5B]" />
                  <span className="text-sm font-medium text-[#241D1C]">{f.friendly_name ?? 'Authenticator App'}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${f.status === 'verified' ? 'bg-[#3F7A5B] text-white' : 'bg-[#F6ECD8] text-[#9A6B1E]'}`}>
                    {f.status}
                  </span>
                </div>
                <button onClick={() => unenroll(f.id)} className="text-[#C0392B] hover:text-[#8B1D17] p-1 transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        {!qrCode && (
          <button onClick={startEnroll} disabled={enrolling}
            className="flex items-center gap-2 bg-[#6B1E2B] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#4A141E] transition-colors disabled:opacity-60">
            {enrolling ? <RefreshCw size={14} className="animate-spin" /> : <Shield size={14} />}
            {factors.length > 0 ? 'Add another authenticator' : 'Enable 2FA'}
          </button>
        )}

        {qrCode && (
          <div className="mt-2">
            <p className="text-sm text-[#6E635F] mb-4">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code to confirm.</p>
            <div className="inline-block bg-white p-3 rounded-xl border border-[#ECE4D9] mb-4">
              <img src={qrCode} alt="TOTP QR code" className="w-40 h-40" />
            </div>
            <p className="text-[10px] text-[#A89F99] mb-4 font-mono break-all">{totpUri}</p>
            <div className="flex gap-3 items-center max-w-sm">
              <input
                type="text" inputMode="numeric" maxLength={6}
                placeholder="Enter 6-digit code"
                value={verifyCode} onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                className="flex-1 h-11 border border-[#ECE4D9] rounded-xl px-4 text-center text-lg font-mono tracking-widest text-[#241D1C] outline-none focus:border-[#6B1E2B] bg-[#F6F1EA]"
              />
              <button onClick={verifyEnroll} disabled={verifyCode.length !== 6 || verifying}
                className="h-11 px-5 bg-[#6B1E2B] text-white rounded-xl text-sm font-semibold hover:bg-[#4A141E] transition-colors disabled:opacity-60">
                {verifying ? 'Verifying…' : 'Confirm'}
              </button>
              <button onClick={() => { setQrCode(null); setEnrollFactorId(null); setVerifyCode(''); }}
                className="h-11 px-4 border border-[#ECE4D9] rounded-xl text-sm text-[#6E635F] hover:bg-[#F6F1EA] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Session Revocation */}
      <div className="bg-white border border-[#ECE4D9] rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <RefreshCw size={20} className="text-[#6B1E2B]" strokeWidth={1.7} />
          <h2 className="text-base font-semibold text-[#241D1C]">Session Management</h2>
        </div>
        <p className="text-sm text-[#6E635F] mb-5">Force sign-out all active sessions for a user. Useful if an account is compromised.</p>
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between bg-[#F6F1EA] rounded-xl px-4 py-3">
              <span className="text-sm font-medium text-[#241D1C]">{u.full_name}</span>
              <button
                onClick={() => revokeUserSessions(u.id)}
                disabled={revokingId === u.id}
                className="text-xs font-semibold text-[#C0392B] hover:underline disabled:opacity-60 flex items-center gap-1">
                {revokingId === u.id ? <RefreshCw size={12} className="animate-spin" /> : null}
                Revoke sessions
              </button>
            </div>
          ))}
          {users.length === 0 && <p className="text-sm text-[#A89F99]">No lawyers or owners found.</p>}
        </div>
      </div>
    </PageShell>
  );
}
