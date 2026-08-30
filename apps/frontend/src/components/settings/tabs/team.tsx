'use client';

import { useState } from 'react';
import { toast } from '../../../lib/hooks/use-toast';
import { Button, Input, Field, Badge, EmptyState } from '../../../components/ui';
import { Modal } from '../../../components/ui/modal';
import { Section } from '../primitives';

interface Member { id: string; name: string; email: string; role: string; status: 'active' | 'invited' }

const PERMISSION_GROUPS = ['Products', 'Orders', 'Customers', 'Messages', 'Payment', 'Delivery', 'Analytics', 'Settings'];
const PERMISSION_TYPES = ['View', 'Create', 'Edit', 'Delete'];

export function TeamTab() {
  return (
    <div className="space-y-6">
      <MembersSection />
      <RolesSection />
      <PermissionsMatrixSection />
    </div>
  );
}

function MembersSection() {
  const [members, setMembers] = useState<Member[]>([
    { id: 'm1', name: 'Amina Yusuf', email: 'amina@example.com', role: 'Owner', status: 'active' },
    { id: 'm2', name: 'Tunde Bakare', email: 'tunde@example.com', role: 'Staff', status: 'active' },
  ]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'Staff' });

  function invite() {
    if (!form.email.includes('@')) { toast.error('Enter a valid email'); return; }
    setMembers((m) => [...m, { id: crypto.randomUUID(), name: form.email.split('@')[0], email: form.email, role: form.role, status: 'invited' }]);
    setForm({ email: '', role: 'Staff' });
    setOpen(false);
    toast.success('Invitation sent');
  }

  return (
    <Section
      title="Team members"
      description="People with access to your store."
      action={<Button variant="secondary" onClick={() => setOpen(true)}>Invite member</Button>}
    >
      {members.length === 0 ? <EmptyState title="No team members" /> : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                  {m.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{m.name} <Badge label={m.role} /></p>
                  <p className="truncate text-xs text-slate-500">{m.email}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {m.status === 'invited' ? (
                  <>
                    <Badge label="Invited" tone="PENDING_PAYMENT" />
                    <Button variant="ghost" onClick={() => toast('Invitation resent')}>Resend</Button>
                    <Button variant="ghost" className="text-red-500" onClick={() => toast('Invitation revoked')}>Revoke</Button>
                  </>
                ) : (
                  <Button variant="ghost" className="text-red-500" onClick={() => { setMembers((x) => x.filter((y) => y.id !== m.id)); toast.success('Member removed'); }}>Remove</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Invite team member">
        <div className="space-y-4">
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Role">
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="Admin">Admin</option>
              <option value="Manager">Manager</option>
              <option value="Staff">Staff</option>
              <option value="Viewer">Viewer</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={invite} disabled={!form.email}>Send invite</Button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

interface Role { id: string; name: string; description: string }

function RolesSection() {
  const [roles, setRoles] = useState<Role[]>([
    { id: 'r1', name: 'Owner', description: 'Full access to everything.' },
    { id: 'r2', name: 'Manager', description: 'Manage orders, products and customers.' },
    { id: 'r3', name: 'Staff', description: 'Handle messages and orders.' },
  ]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  function add() {
    if (!form.name.trim()) return;
    setRoles((r) => [...r, { id: crypto.randomUUID(), ...form }]);
    setForm({ name: '', description: '' });
    setOpen(false);
    toast.success('Role created');
  }

  return (
    <Section title="Roles" description="Permission presets you can assign." action={<Button variant="secondary" onClick={() => setOpen(true)}>Create role</Button>}>
      {roles.length === 0 ? <EmptyState title="No roles" /> : (
        <ul className="space-y-2">
          {roles.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{r.name}</p>
                <p className="text-xs text-slate-500">{r.description}</p>
              </div>
              {r.name !== 'Owner' && (
                <Button variant="ghost" className="text-red-500" onClick={() => { setRoles((x) => x.filter((y) => y.id !== r.id)); toast.success('Role deleted'); }}>Delete</Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Create role">
        <div className="space-y-4">
          <Field label="Role name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Description"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={add} disabled={!form.name.trim()}>Save role</Button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

function PermissionsMatrixSection() {
  const [matrix, setMatrix] = useState<Record<string, string[]>>(() => {
    const out: Record<string, string[]> = {};
    for (const g of PERMISSION_GROUPS) {
      const key = g.toLowerCase();
      out[key] = key === 'settings' ? ['View'] : ['View', 'Create', 'Edit', 'Delete'];
    }
    return out;
  });

  function toggle(group: string, perm: string) {
    const key = group.toLowerCase();
    const perms = matrix[key] ?? [];
    const next = perms.includes(perm) ? perms.filter((p) => p !== perm) : [...perms, perm];
    setMatrix((m) => ({ ...m, [key]: next }));
  }

  return (
    <Section title="Permissions" description="Control what each role can do. Applied to the Owner role by default.">
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800">
            <tr>
              <th className="px-3 py-2 font-medium">Area</th>
              {PERMISSION_TYPES.map((p) => <th key={p} className="px-3 py-2 text-center font-medium">{p}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {PERMISSION_GROUPS.map((g) => {
              const key = g.toLowerCase();
              const perms = matrix[key] ?? [];
              return (
                <tr key={g}>
                  <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">{g}</td>
                  {PERMISSION_TYPES.map((p) => (
                    <td key={p} className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${g} ${p}`}
                        checked={perms.includes(p)}
                        onChange={() => toggle(g, p)}
                        className="h-4 w-4 accent-emerald-600"
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-end"><Button onClick={() => toast.success('Permissions saved')}>Save permissions</Button></div>
    </Section>
  );
}
