'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (authErr) { setError(authErr.message); setLoading(false); return; }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
    if (profile?.role !== 'owner') {
      await supabase.auth.signOut();
      setError('Access denied. This portal is for firm owners only.');
      setLoading(false); return;
    }
    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen bg-[#6B1E2B] flex items-end justify-center">
      <div className="w-full max-w-md">
        {/* Hero */}
        <div className="flex flex-col items-center pb-12 pt-20 px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-4">
            <span className="font-bold text-2xl text-[#F6F1EA]">B</span>
          </div>
          <h1 className="text-2xl font-semibold text-[#F6F1EA] mb-2">Bastion Law</h1>
          <p className="text-[rgba(246,241,234,0.7)] text-sm leading-relaxed">Partner & Owner Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-t-3xl px-8 pt-8 pb-16">
          <h2 className="text-lg font-semibold text-[#241D1C] mb-6">Sign in to your account</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-medium text-[#8A817B] tracking-widest mb-2">EMAIL</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 border border-[#ECE4D9] rounded-xl px-4 bg-[#F6F1EA] text-[#241D1C] text-sm focus:outline-none focus:border-[#6B1E2B] focus:ring-1 focus:ring-[#6B1E2B]"
                placeholder="ahmed@bastionlaw.pk" required
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#8A817B] tracking-widest mb-2">PASSWORD</label>
              <div className="flex">
                <input
                  type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 h-12 border border-[#ECE4D9] rounded-l-xl px-4 bg-[#F6F1EA] text-[#241D1C] text-sm focus:outline-none focus:border-[#6B1E2B] focus:ring-1 focus:ring-[#6B1E2B] border-r-0"
                  placeholder="••••••••" required
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="h-12 px-4 border border-[#ECE4D9] border-l-0 rounded-r-xl bg-[#F6F1EA] text-[#6B1E2B] text-sm font-medium">
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {error && <p className="text-[#C0392B] text-sm">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full h-14 rounded-2xl bg-[#6B1E2B] text-white font-semibold text-base hover:bg-[#4A141E] transition-colors disabled:opacity-70 flex items-center justify-center gap-2">
              {loading ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : 'Sign in'}
            </button>
          </form>
          <p className="text-center text-xs text-[#A89F99] mt-5">
            Owner credentials provided by Bastion Law administration.
          </p>
        </div>
      </div>
    </div>
  );
}
