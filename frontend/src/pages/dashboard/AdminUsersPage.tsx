import React from 'react';
import { ShieldCheck, UserCog } from 'lucide-react';

const users = [
  { id: 'USR-001', name: 'Administrator Tridjaya', role: 'admin', email: 'admin@tridjaya.co.id', status: 'Active' },
  { id: 'USR-043', name: 'Agen Samrat Makassar', role: 'agent', email: 'agent.mks@tridjaya.co.id', status: 'Active' },
  { id: 'USR-057', name: 'Operator Catalog', role: 'operator', email: 'operator.catalog@tridjaya.co.id', status: 'Suspended' },
];

const AdminUsersPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-6">
        <h3 className="font-display text-title-md font-bold text-on-surface inline-flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" /> Manajemen Akses User
        </h3>
        <p className="text-body-sm text-on-surface-variant mt-2">Kontrol role dan status akun untuk admin, agen, dan operator.</p>
      </div>

      <div className="glass-card rounded-3xl p-6 overflow-x-auto">
        <table className="w-full min-w-[680px] text-left">
          <thead>
            <tr className="text-label-sm text-on-surface-variant border-b border-outline-variant/20">
              <th className="py-3 pr-3">ID</th>
              <th className="py-3 pr-3">Nama</th>
              <th className="py-3 pr-3">Role</th>
              <th className="py-3 pr-3">Email</th>
              <th className="py-3 pr-3">Status</th>
              <th className="py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-outline-variant/10">
                <td className="py-3 pr-3 text-on-surface-variant">{user.id}</td>
                <td className="py-3 pr-3 text-on-surface font-semibold">{user.name}</td>
                <td className="py-3 pr-3">
                  <span className="px-2 py-1 rounded-md bg-surface-high text-label-sm text-on-surface-variant uppercase">{user.role}</span>
                </td>
                <td className="py-3 pr-3 text-on-surface-variant">{user.email}</td>
                <td className="py-3 pr-3 text-on-surface-variant">{user.status}</td>
                <td className="py-3">
                  <a
                    href={`mailto:security@tridjaya.co.id?subject=Permintaan%20Perubahan%20Role%20${user.id}`}
                    className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-label-sm font-semibold inline-flex items-center gap-1"
                  >
                    <UserCog className="w-4 h-4" /> Ubah Role
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsersPage;