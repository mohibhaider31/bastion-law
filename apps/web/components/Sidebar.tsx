'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import {
  LayoutDashboard, Users, Scale, Briefcase, Calendar, Receipt, LogOut, BarChart2, Settings, Mail,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard',   label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/analytics',   label: 'Analytics',    icon: BarChart2 },
  { href: '/clients',     label: 'Clients',      icon: Users },
  { href: '/lawyers',     label: 'Lawyers',      icon: Scale },
  { href: '/matters',     label: 'Matters',      icon: Briefcase },
  { href: '/appointments',label: 'Appointments', icon: Calendar },
  { href: '/billing',     label: 'Billing',      icon: Receipt },
  { href: '/emails',      label: 'Emails',       icon: Mail },
  { href: '/settings',    label: 'Settings',     icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <aside className="w-60 min-h-screen bg-[#1C1512] flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/8">
        <div className="w-9 h-9 rounded-lg bg-[#6B1E2B] flex items-center justify-center flex-shrink-0">
          <span className="font-bold text-[#F6F1EA] text-lg">B</span>
        </div>
        <div>
          <p className="text-[#F6F1EA] font-semibold text-sm tracking-wide">BASTION</p>
          <p className="text-[rgba(246,241,234,0.45)] text-[10px] tracking-widest">OWNER PORTAL</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-sm font-medium transition-colors ${
                active
                  ? 'bg-[#6B1E2B] text-[#F6F1EA]'
                  : 'text-[rgba(246,241,234,0.45)] hover:text-[#F6F1EA] hover:bg-white/5'
              }`}>
              <Icon size={18} strokeWidth={active ? 2 : 1.7} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-white/8">
        <button onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-[rgba(246,241,234,0.45)] hover:text-[#F6F1EA] hover:bg-white/5 text-sm font-medium transition-colors">
          <LogOut size={18} strokeWidth={1.7} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
