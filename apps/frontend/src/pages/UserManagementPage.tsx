import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';

const USER_DIRECTORY_PAGE_SIZE = 1000;

/** Protected superadmin — matches the backend SUPERADMIN_EMAIL env value. */
const SUPERADMIN_EMAIL = 'sam@jitims.com';

function isSuperAdmin(user: { email: string }) {
  return user.email.trim().toLowerCase() === SUPERADMIN_EMAIL;
}

type Permission = {
  id: number;
  name: string;
  resource: string;
  action: string;
  description: string | null;
};

type Role = {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionCount: number;
  permissions: Permission[];
};

type User = {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: {
    id: number;
    name: string;
    description: string | null;
  } | null;
  status: string;
  isActive: boolean;
  createdAt: string;
  permissions: Permission[];
};

type UsersResponse = {
  data: User[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type UserSummary = {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  administratorUsers: number;
};

type NewUserForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleId: string;
  isActive: boolean;
};

type CurrentUser = {
  id?: number;
  email?: string;
  role?: string | { name?: string };
  roleName?: string;
  permissions?: Array<string | { name?: string }>;
};

const emptySummary: UserSummary = {
  totalUsers: 0,
  activeUsers: 0,
  inactiveUsers: 0,
  administratorUsers: 0,
};

const emptyNewUserForm: NewUserForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  roleId: '',
  isActive: true,
};

function getPermissionNames(user: CurrentUser) {
  return (user.permissions ?? []).map((permission) => {
    if (typeof permission === 'string') {
      return permission;
    }

    return permission.name ?? '';
  });
}

function hasUserManagementAccess(user: CurrentUser | null) {
  if (!user) {
    return false;
  }

  const roleName =
    typeof user.role === 'string' ? user.role : (user.role?.name ?? user.roleName ?? '');

  const normalizedRole = roleName.toLowerCase();
  const permissions = getPermissionNames(user);

  const hasUserAccess = permissions.includes('users:read') || permissions.includes('users:manage');
  const hasRoleAccess = permissions.includes('roles:read') || permissions.includes('roles:manage');

  return normalizedRole.includes('admin') || (hasUserAccess && hasRoleAccess);
}

function hasUserAccessManagementPermission(user: CurrentUser | null) {
  if (!user) {
    return false;
  }

  const roleName =
    typeof user.role === 'string' ? user.role : (user.role?.name ?? user.roleName ?? '');

  const normalizedRole = roleName.toLowerCase();
  const permissions = getPermissionNames(user);

  return (
    normalizedRole.includes('admin') ||
    (permissions.includes('users:manage') && permissions.includes('roles:manage'))
  );
}

function getApiErrorMessage(error: unknown, fallback: string) {
  const err = error as {
    response?: {
      data?: {
        message?: string | string[];
      };
    };
    message?: string;
  };

  const responseMessage = err.response?.data?.message;

  if (Array.isArray(responseMessage)) {
    return responseMessage.join(', ');
  }

  return responseMessage ?? err.message ?? fallback;
}

export default function UserManagementPage() {
  const { user: currentUser, isLoading: isAuthLoading } = useAuthStore();
  const isLoadingRef = useRef(false);

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [summary, setSummary] = useState<UserSummary>(emptySummary);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState<NewUserForm>(emptyNewUserForm);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRoleId, setEditRoleId] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingAccess, setIsUpdatingAccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isAuthorized = useMemo(() => hasUserManagementAccess(currentUser), [currentUser]);

  const canManageUserAccess = useMemo(
    () => hasUserAccessManagementPermission(currentUser),
    [currentUser],
  );

  const accessMessage = currentUser
    ? 'You do not have permission to access User Management.'
    : 'Please sign in with an authorized account.';

  const loadData = useCallback(async () => {
    if (isLoadingRef.current) {
      return;
    }

    isLoadingRef.current = true;
    setIsLoading(true);
    setErrorMessage('');

    try {
      const [usersResponse, summaryResponse, rolesResponse] = await Promise.all([
        api.get<UsersResponse>('/users', {
          params: {
            page: 1,
            limit: USER_DIRECTORY_PAGE_SIZE,
          },
        }),
        api.get<UserSummary>('/users/summary'),
        api.get<Role[]>('/users/roles'),
      ]);

      setUsers(usersResponse.data.data);
      setSummary(summaryResponse.data);
      setRoles(rolesResponse.data);

      setNewUser((currentForm) => {
        if (currentForm.roleId || rolesResponse.data.length === 0) {
          return currentForm;
        }

        return {
          ...currentForm,
          roleId: String(rolesResponse.data[0].id),
        };
      });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Unable to load user management data.'));
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!isAuthorized) {
      setIsLoading(false);
      return;
    }

    void loadData();
  }, [isAuthLoading, isAuthorized, loadData]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      const fullName = getUserFullName(user).toLowerCase();

      const matchesSearch =
        fullName.includes(normalizedSearch) ||
        user.firstName.toLowerCase().includes(normalizedSearch) ||
        user.lastName.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch);

      const matchesRole =
        selectedRoleId === 'all' || String(user.role?.id ?? '') === selectedRoleId;

      const matchesStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'active' && user.isActive) ||
        (selectedStatus === 'inactive' && !user.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [searchTerm, selectedRoleId, selectedStatus, users]);

  function getDefaultRoleId() {
    return roles[0] ? String(roles[0].id) : '';
  }

  function resetAddUserForm() {
    setNewUser({
      ...emptyNewUserForm,
      roleId: getDefaultRoleId(),
    });
  }

  function openAddUserForm() {
    if (!canManageUserAccess) {
      setErrorMessage('You do not have permission to create users.');
      setSuccessMessage('');
      return;
    }

    resetAddUserForm();
    setEditingUser(null);
    setShowPassword(false);
    setIsAddUserOpen(true);
    setErrorMessage('');
    setSuccessMessage('');
  }

  function cancelAddUser() {
    resetAddUserForm();
    setShowPassword(false);
    setIsAddUserOpen(false);
    setErrorMessage('');
    setSuccessMessage('');
  }

  function openEditAccess(user: User) {
    if (!canManageUserAccess) {
      setErrorMessage('You do not have permission to update user access.');
      setSuccessMessage('');
      return;
    }

    if (isSuperAdmin(user)) {
      setErrorMessage('The superadmin account cannot be edited.');
      setSuccessMessage('');
      return;
    }

    setEditingUser(user);
    setEditFirstName(user.firstName);
    setEditLastName(user.lastName);
    setEditEmail(user.email);
    setEditRoleId(user.role ? String(user.role.id) : '');
    setEditIsActive(user.isActive);
    setIsAddUserOpen(false);
    setErrorMessage('');
    setSuccessMessage('');
  }

  function closeEditAccess() {
    setEditingUser(null);
    setEditFirstName('');
    setEditLastName('');
    setEditEmail('');
    setEditRoleId('');
    setEditIsActive(true);
    setErrorMessage('');
    setSuccessMessage('');
  }

  async function handleAddUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    if (!isAuthorized || !canManageUserAccess) {
      setErrorMessage('You are not authorized to create users.');
      return;
    }

    if (!newUser.roleId) {
      setErrorMessage('Please select a role before saving.');
      return;
    }

    if (newUser.password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    setIsSaving(true);

    try {
      await api.post<User>('/users', {
        firstName: newUser.firstName.trim(),
        lastName: newUser.lastName.trim(),
        email: newUser.email.trim().toLowerCase(),
        password: newUser.password,
        roleId: Number(newUser.roleId),
        isActive: newUser.isActive,
      });

      setSuccessMessage('User added successfully.');
      setIsAddUserOpen(false);
      resetAddUserForm();

      await loadData();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Unable to add user.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingUser) {
      return;
    }

    if (!isAuthorized || !canManageUserAccess) {
      setErrorMessage('You are not authorized to update user access.');
      return;
    }

    if (!editRoleId) {
      setErrorMessage('Please select a role before saving.');
      return;
    }

    setIsUpdatingAccess(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await api.patch<User>(`/users/${editingUser.id}`, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        email: editEmail.trim().toLowerCase(),
        roleId: Number(editRoleId),
        isActive: editIsActive,
      });

      setSuccessMessage('User updated successfully.');
      closeEditAccess();

      await loadData();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Unable to update user access.'));
    } finally {
      setIsUpdatingAccess(false);
    }
  }

  if (isAuthLoading) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-6 py-8 text-[var(--text-primary)]">
        <section className="mx-auto max-w-3xl rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
          <h1 className="text-xl font-semibold">Checking access...</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Verifying whether you can access User Management.
          </p>
        </section>
      </main>
    );
  }

  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-6 py-8 text-[var(--text-primary)]">
        <section className="mx-auto max-w-3xl rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
          <p className="text-sm font-medium text-[var(--accent)]">Access Restricted</p>
          <h1 className="mt-1 text-2xl font-semibold">User Management access is restricted</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{accessMessage}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-8 text-[var(--text-primary)]">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="mt-1 text-2xl font-semibold">User and Role Access Management</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
              Display and monitor system users, assigned roles, account statuses, and permission
              visibility across the inventory system.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={isLoading}
              className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>

            {canManageUserAccess && (
              <button
                type="button"
                onClick={openAddUserForm}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--accent-hover)]"
              >
                Add User
              </button>
            )}
          </div>
        </header>

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        {isAddUserOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in">
            <section className="w-full max-w-lg rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-xl animate-fade-in-up">
              <div className="mb-5 flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
                <div>
                  <h2 className="text-lg font-semibold">Add User</h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Add a new user account and save it to the backend database.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cancelAddUser}
                  className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)] transition"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddUser} className="grid gap-3 md:grid-cols-2">
                <input
                  required
                  value={newUser.firstName}
                  onChange={(event) =>
                    setNewUser((currentUser) => ({
                      ...currentUser,
                      firstName: event.target.value,
                    }))
                  }
                  placeholder="First name"
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)]"
                />

                <input
                  required
                  value={newUser.lastName}
                  onChange={(event) =>
                    setNewUser((currentUser) => ({
                      ...currentUser,
                      lastName: event.target.value,
                    }))
                  }
                  placeholder="Last name"
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)]"
                />

                <input
                  required
                  type="email"
                  value={newUser.email}
                  onChange={(event) =>
                    setNewUser((currentUser) => ({
                      ...currentUser,
                      email: event.target.value,
                    }))
                  }
                  placeholder="Email address"
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)]"
                />

                <div className="relative">
                  <input
                    required
                    minLength={8}
                    type={showPassword ? 'text' : 'password'}
                    value={newUser.password}
                    onChange={(event) =>
                      setNewUser((currentUser) => ({
                        ...currentUser,
                        password: event.target.value,
                      }))
                    }
                    placeholder="Temporary password"
                    className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 pr-10 text-sm outline-none focus:border-[var(--input-border-focus)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>

                <select
                  required
                  value={newUser.roleId}
                  onChange={(event) =>
                    setNewUser((currentUser) => ({
                      ...currentUser,
                      roleId: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)]"
                >
                  <option value="" disabled>
                    Select role
                  </option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>

                <select
                  value={newUser.isActive ? 'active' : 'inactive'}
                  onChange={(event) =>
                    setNewUser((currentUser) => ({
                      ...currentUser,
                      isActive: event.target.value === 'active',
                    }))
                  }
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)]"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>

                <div className="flex flex-wrap gap-3 md:col-span-2">
                  <button
                    type="submit"
                    disabled={isSaving || roles.length === 0}
                    className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? 'Saving...' : 'Save User'}
                  </button>

                  <button
                    type="button"
                    onClick={cancelAddUser}
                    className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--surface-hover)]"
                  >
                    Cancel
                  </button>
                </div>
              </form>

              {roles.length === 0 && (
                <p className="mt-3 text-sm text-[var(--text-secondary)]">
                  No roles found. Add roles to the database before creating users.
                </p>
              )}
            </section>
          </div>
        )}

        {editingUser && canManageUserAccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in">
            <section className="w-full max-w-lg rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-xl animate-fade-in-up">
              <div className="mb-5 flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
                <div>
                  <h2 className="text-lg font-semibold">Edit User</h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Update details for {getUserFullName(editingUser)}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEditAccess}
                  className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)] transition"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdateAccess} className="grid gap-3 md:grid-cols-2">
                <input
                  required
                  value={editFirstName}
                  onChange={(event) => setEditFirstName(event.target.value)}
                  placeholder="First name"
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)]"
                />

                <input
                  required
                  value={editLastName}
                  onChange={(event) => setEditLastName(event.target.value)}
                  placeholder="Last name"
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)]"
                />

                <input
                  required
                  type="email"
                  value={editEmail}
                  onChange={(event) => setEditEmail(event.target.value)}
                  placeholder="Email address"
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)] md:col-span-2"
                />

                <select
                  required
                  value={editRoleId}
                  onChange={(event) => setEditRoleId(event.target.value)}
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)]"
                >
                  <option value="" disabled>
                    Select role
                  </option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>

                <select
                  value={editIsActive ? 'active' : 'inactive'}
                  onChange={(event) => setEditIsActive(event.target.value === 'active')}
                  className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)]"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>

                <div className="flex flex-wrap gap-3 md:col-span-2">
                  <button
                    type="submit"
                    disabled={isUpdatingAccess || roles.length === 0}
                    className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isUpdatingAccess ? 'Saving...' : 'Save Changes'}
                  </button>

                  <button
                    type="button"
                    onClick={closeEditAccess}
                    className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--surface-hover)]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="Total Users" value={summary.totalUsers} />
          <SummaryCard title="Active Users" value={summary.activeUsers} />
          <SummaryCard title="Inactive Users" value={summary.inactiveUsers} />
          <SummaryCard title="Administrators" value={summary.administratorUsers} />
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
              value={selectedRoleId}
              onChange={(event) => setSelectedRoleId(event.target.value)}
              className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
            >
              <option value="all">All Roles</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
              className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--input-border-focus)]"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {isLoading ? (
            <div className="mt-5 rounded-xl border border-dashed border-[var(--surface-border)] p-8 text-center">
              <h3 className="font-medium">Loading users...</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Fetching user data from the backend.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-5 hidden overflow-x-auto rounded-xl border border-[var(--surface-border)] md:block">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-[var(--background-tertiary)] text-[var(--text-secondary)]">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Created At</th>
                      {canManageUserAccess && <th className="px-4 py-3 font-medium">Action</th>}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[var(--surface-border)]">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="transition hover:bg-[var(--surface-hover)]">
                        <td className="px-4 py-3 font-medium">{getUserFullName(user)}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{user.email}</td>
                        <td className="px-4 py-3">
                          <Badge variant={getUserRoleName(user)}>{getUserRoleName(user)}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={user.status}>{user.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">
                          {formatDate(user.createdAt)}
                        </td>
                        {canManageUserAccess && (
                          <td className="px-4 py-3">
                            {isSuperAdmin(user) ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--background-tertiary)] px-2.5 py-1 text-xs font-medium text-[var(--text-tertiary)]" title="Superadmin — protected">
                                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                Protected
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openEditAccess(user)}
                                className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-sm font-medium transition hover:bg-[var(--surface-hover)]"
                              >
                                Edit
                              </button>
                            )}
                          </td>
                        )}
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
                        <h3 className="font-semibold">{getUserFullName(user)}</h3>
                        <p className="text-sm text-[var(--text-secondary)]">{user.email}</p>
                      </div>

                      <Badge variant={user.status}>{user.status}</Badge>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Badge variant={getUserRoleName(user)}>{getUserRoleName(user)}</Badge>
                      <span className="text-sm text-[var(--text-tertiary)]">
                        Created: {formatDate(user.createdAt)}
                      </span>
                    </div>

                    {canManageUserAccess && (
                      isSuperAdmin(user) ? (
                        <span className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--background-tertiary)] px-3 py-2 text-xs font-medium text-[var(--text-tertiary)]" title="Superadmin — protected">
                          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          Protected Account
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openEditAccess(user)}
                          className="mt-4 w-full rounded-lg border border-[var(--surface-border)] px-3 py-2 text-sm font-medium transition hover:bg-[var(--surface-hover)]"
                        >
                          Edit
                        </button>
                      )
                    )}
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
            </>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Permission Visibility</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Review access sections for each role to support administrator monitoring.
            </p>
          </div>

          {roles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--surface-border)] p-8 text-center">
              <h3 className="font-medium">No roles found</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Role and permission data will appear here once available.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {roles.map((role) => (
                <article
                  key={role.id}
                  className="rounded-xl border border-[var(--surface-border)] bg-[var(--background-secondary)] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold">{role.name}</h3>
                    <Badge variant={role.name}>{role.name}</Badge>
                  </div>

                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    {role.description ?? 'No role description available.'}
                  </p>

                  <p className="mt-3 text-xs font-medium text-[var(--text-tertiary)]">
                    {role.userCount} user/s • {role.permissionCount} permission/s
                  </p>

                  <ul className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
                    {role.permissions.length === 0 ? (
                      <li>No permissions assigned.</li>
                    ) : (
                      role.permissions.map((permission) => (
                        <li key={permission.id} className="flex gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                          <span>
                            {permission.name}{' '}
                            <span className="text-[var(--text-tertiary)]">
                              ({permission.action} {permission.resource})
                            </span>
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </article>
              ))}
            </div>
          )}
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

function Badge({ children, variant }: { children: ReactNode; variant: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
        variant,
      )}`}
    >
      {children}
    </span>
  );
}

function getUserFullName(user: User) {
  const fullName = user.fullName?.trim();

  if (fullName) {
    return fullName;
  }

  return `${user.firstName} ${user.lastName}`.trim() || 'Unnamed User';
}

function getUserRoleName(user: User) {
  return user.role?.name ?? 'No role assigned';
}

function getBadgeClass(variant: string) {
  const normalizedVariant = variant.toLowerCase();

  if (normalizedVariant.includes('admin')) {
    return 'bg-[var(--accent-muted)] text-[var(--accent)]';
  }

  if (normalizedVariant.includes('staff')) {
    return 'bg-[var(--info-muted)] text-[var(--info)]';
  }

  if (normalizedVariant.includes('inactive')) {
    return 'bg-[var(--background-tertiary)] text-[var(--text-secondary)]';
  }

  if (normalizedVariant.includes('active')) {
    return 'bg-[var(--success-muted)] text-[var(--success)]';
  }

  return 'bg-[var(--background-tertiary)] text-[var(--text-secondary)]';
}

function formatDate(dateValue: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateValue));
}
