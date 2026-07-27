'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

const links = [
  { href: '/dashboard', label: "Vue d'ensemble" },
  { href: '/dashboard/clients', label: 'Clients & Sites' },
  { href: '/dashboard/templates', label: 'Modèles de questions' },
  { href: '/dashboard/rondes', label: 'Rondes' },
  { href: '/dashboard/alertes', label: 'Alertes' },
];

export default function Shell({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-6 py-5 text-lg font-semibold border-b border-slate-800">GenTrack Admin</div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {links.map((l) => {
            const active = pathname === l.href || (l.href !== '/dashboard' && pathname.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`block px-3 py-2 rounded-md text-sm ${
                  active ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={logout}
          className="m-3 px-3 py-2 text-sm rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200"
        >
          Se déconnecter
        </button>
      </aside>
      <main className="flex-1 bg-gray-50 p-8 overflow-y-auto">{children}</main>
    </div>
  );
}
