"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";

type UserRole = "Administrator" | "Staff" | "Viewer";
type UserStatus = "Active" | "Inactive" | "Pending";

type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastUpdated: string;
};

type PermissionGroup = {
  role: UserRole;
  description: string;
  permissions: string[];
};

const users: User[] = [
  {
    id: 1,
    name: "Noah Philippe Ibay",
    email: "noah.ibay@jairosoft.com",
    role: "Administrator",
    status: "Active",
    lastUpdated: "May 21, 2026",
  },
  {
    id: 2,
    name: "Maria Santos",
    email: "maria.santos@jairosoft.com",
    role: "Staff",
    status: "Active",
    lastUpdated: "May 20, 2026",
  },
  {
    id: 3,
    name: "Juan Dela Cruz",
    email: "juan.delacruz@jairosoft.com",
    role: "Viewer",
    status: "Inactive",
    lastUpdated: "May 18, 2026",
  },
  {
    id: 4,
    name: "Carlo Reyes",
    email: "carlo.reyes@jairosoft.com",
    role: "Staff",
    status: "Pending",
    lastUpdated: "May 17, 2026",
  },
];

const permissionGroups: PermissionGroup[] = [
  {
    role: "Administrator",
    description: "Full access to user monitoring and system management.",
    permissions: [
      "Manage user accounts",
      "Review role access",
      "View inventory records",
      "Update system records",
    ],
  },
  {
    role: "Staff",
    description: "Operational access for inventory-related tasks.",
    permissions: [
      "View inventory records",
      "Update stock records",
      "Monitor inventory movement",
      "Submit record changes",
    ],
  },
  {
    role: "Viewer",
    description: "Limited access for viewing assigned system records.",
    permissions: [
      "View assigned records",
      "Review item information",
      "Cannot manage users",
      "Cannot modify records",
    ],
  },
];

const roleOptions: Array<"All Roles" | UserRole> = [
  "All Roles",
  "Administrator",
  "Staff",
  "Viewer",
];

const statusOptions: Array<"All Statuses" | UserStatus> = [
  "All Statuses",
  "Active",
  "Inactive",
  "Pending",
];

export default function UserManagementPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] =
    useState<(typeof roleOptions)[number]>("All Roles");
  const [selectedStatus, setSelectedStatus] =
    useState<(typeof statusOptions)[number]>("All Statuses");

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase().trim();

    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch);

      const matchesRole =
        selectedRole === "All Roles" || user.role === selectedRole;

      const matchesStatus =
        selectedStatus === "All Statuses" || user.status === selectedStatus;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [searchTerm, selectedRole, selectedStatus]);

  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.status === "Active").length;
  const inactiveUsers = users.filter((user) => user.status === "Inactive").length;
  const adminUsers = users.filter(
    (user) => user.role === "Administrator"
  ).length;

  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-8 text-[var(--text-primary)]">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="mt-1 text-2xl font-semibold">
              User and Role Access Management
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
              Display and monitor system users, assigned roles, account statuses,
              and permission visibility across the inventory system.
            </p>
          </div>

          <button className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--accent-hover)]">
            Add User
          </button>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="Total Users" value={totalUsers} />
          <SummaryCard title="Active Users" value={activeUsers} />
          <SummaryCard title="Inactive Users" value={inactiveUsers} />
          <SummaryCard title="Administrators" value={adminUsers} />
        </section>

        <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">User Directory</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Search users and filter by role or account status.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name or email"
              className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-border-focus)]"
            />

            <select
              value={selectedRole}
              onChange={(event) =>
                setSelectedRole(event.target.value as (typeof roleOptions)[number])
              }
              className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
            >
              {roleOptions.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(event) =>
                setSelectedStatus(
                  event.target.value as (typeof statusOptions)[number]
                )
              }
              className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
            >
              {statusOptions.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </div>

          <div className="mt-5 hidden overflow-x-auto rounded-xl border border-[var(--surface-border)] md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[var(--background-tertiary)] text-[var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last Updated</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[var(--surface-border)]">
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="transition hover:bg-[var(--surface-hover)]"
                  >
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {user.email}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.role}>{user.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.status}>{user.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {user.lastUpdated}
                    </td>
                    <td className="px-4 py-3">
                      <button className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-sm font-medium transition hover:bg-[var(--surface-hover)]">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-3 md:hidden">
            {filteredUsers.map((user) => (
              <article
                key={user.id}
                className="rounded-xl border border-[var(--surface-border)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{user.name}</h3>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {user.email}
                    </p>
                  </div>

                  <Badge variant={user.status}>{user.status}</Badge>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge variant={user.role}>{user.role}</Badge>
                  <span className="text-sm text-[var(--text-tertiary)]">
                    Updated: {user.lastUpdated}
                  </span>
                </div>

                <button className="mt-4 w-full rounded-lg border border-[var(--surface-border)] px-3 py-2 text-sm font-medium transition hover:bg-[var(--surface-hover)]">
                  View Details
                </button>
              </article>
            ))}
          </div>

          {filteredUsers.length === 0 && (
            <div className="mt-5 rounded-xl border border-dashed border-[var(--surface-border)] p-8 text-center">
              <h3 className="font-medium">No users found</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Try changing your search term or selected filters.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Permission Visibility</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Review access sections for each role to support administrator
              monitoring.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {permissionGroups.map((group) => (
              <article
                key={group.role}
                className="rounded-xl border border-[var(--surface-border)] bg-[var(--background-secondary)] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">{group.role}</h3>
                  <Badge variant={group.role}>{group.role}</Badge>
                </div>

                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {group.description}
                </p>

                <ul className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
                  {group.permissions.map((permission) => (
                    <li key={permission} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                      <span>{permission}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
      <p className="text-sm text-[var(--text-secondary)]">{title}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </article>
  );
}

function Badge({
  children,
  variant,
}: {
  children: ReactNode;
  variant: UserRole | UserStatus;
}) {
  const styles: Record<UserRole | UserStatus, string> = {
    Administrator: "bg-[var(--accent-muted)] text-[var(--accent)]",
    Staff: "bg-[var(--info-muted)] text-[var(--info)]",
    Viewer: "bg-[var(--background-tertiary)] text-[var(--text-secondary)]",
    Active: "bg-[var(--success-muted)] text-[var(--success)]",
    Inactive: "bg-[var(--background-tertiary)] text-[var(--text-secondary)]",
    Pending: "bg-[var(--warning-muted)] text-[var(--warning)]",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles[variant]}`}
    >
      {children}
    </span>
  );
}