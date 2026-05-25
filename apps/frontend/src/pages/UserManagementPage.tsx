import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useAuthStore } from "../store/authStore";

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string) || "http://localhost:3001/api";

const USER_DIRECTORY_PAGE_SIZE = 1000;

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

type AuthState = {
  isChecking: boolean;
  isAuthorized: boolean;
  token: string;
  user: CurrentUser | null;
  message: string;
};

const emptySummary: UserSummary = {
  totalUsers: 0,
  activeUsers: 0,
  inactiveUsers: 0,
  administratorUsers: 0,
};

const emptyNewUserForm: NewUserForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  roleId: "",
  isActive: true,
};

const initialAuthState: AuthState = {
  isChecking: true,
  isAuthorized: false,
  token: "",
  user: null,
  message: "",
};

function getStoredToken() {
  const memToken = useAuthStore.getState().accessToken;
  if (memToken) {
    return memToken;
  }

  const tokenKeys = [
    "accessToken",
    "access_token",
    "token",
    "jwt",
    "jit_access_token",
  ];

  for (const key of tokenKeys) {
    const token = window.localStorage.getItem(key);

    if (token) {
      return token;
    }
  }

  return "";
}

function getStoredUser() {
  const memUser = useAuthStore.getState().user;
  if (memUser) {
    return memUser;
  }

  const userKeys = ["currentUser", "authUser", "user"];

  for (const key of userKeys) {
    const storedUser = window.localStorage.getItem(key);

    if (!storedUser) {
      continue;
    }

    try {
      return JSON.parse(storedUser) as CurrentUser;
    } catch {
      continue;
    }
  }

  return null;
}

function decodeJwtPayload(token: string): CurrentUser | null {
  try {
    const payload = token.split(".")[1];

    if (!payload) {
      return null;
    }

    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "=",
    );

    return JSON.parse(window.atob(paddedPayload)) as CurrentUser;
  } catch {
    return null;
  }
}

function getPermissionNames(user: CurrentUser) {
  return (user.permissions ?? []).map((permission) => {
    if (typeof permission === "string") {
      return permission;
    }

    return permission.name ?? "";
  });
}

function hasUserManagementAccess(user: CurrentUser | null) {
  if (!user) {
    return false;
  }

  const roleName =
    typeof user.role === "string"
      ? user.role
      : user.role?.name ?? user.roleName ?? "";

  const normalizedRole = roleName.toLowerCase();
  const permissions = getPermissionNames(user);

  const hasUserAccess =
    permissions.includes("users:read") || permissions.includes("users:manage");
  const hasRoleAccess =
    permissions.includes("roles:read") || permissions.includes("roles:manage");

  return normalizedRole.includes("admin") || (hasUserAccess && hasRoleAccess);
}

function getClientAuth(): AuthState {
  const token = getStoredToken();

  if (!token) {
    return {
      isChecking: false,
      isAuthorized: false,
      token: "",
      user: null,
      message: "Please sign in with an administrator account.",
    };
  }

  const storedUser = getStoredUser();
  const tokenUser = decodeJwtPayload(token);
  const user = {
    ...(tokenUser ?? {}),
    ...(storedUser ?? {}),
  };

  if (!hasUserManagementAccess(user)) {
    return {
      isChecking: false,
      isAuthorized: false,
      token,
      user,
      message: "You do not have permission to access User Management.",
    };
  }

  return {
    isChecking: false,
    isAuthorized: true,
    token,
    user,
    message: "",
  };
}

async function requestJson<T>(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;

    const message = Array.isArray(errorBody?.message)
      ? errorBody.message.join(", ")
      : errorBody?.message ?? "Request failed.";

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export default function UserManagementPage() {
  const [authState, setAuthState] = useState<AuthState>(initialAuthState);

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [summary, setSummary] = useState<UserSummary>(emptySummary);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState<NewUserForm>(emptyNewUserForm);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRoleId, setEditRoleId] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingAccess, setIsUpdatingAccess] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadData = useCallback(async (token: string) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const usersUrl = new URL(`${API_BASE_URL}/users`);
      usersUrl.searchParams.set("page", "1");
      usersUrl.searchParams.set("limit", String(USER_DIRECTORY_PAGE_SIZE));

      const [usersResponse, summaryResponse, rolesResponse] = await Promise.all([
        requestJson<UsersResponse>(usersUrl.toString(), token),
        requestJson<UserSummary>(`${API_BASE_URL}/users/summary`, token),
        requestJson<Role[]>(`${API_BASE_URL}/users/roles`, token),
      ]);

      setUsers(usersResponse.data);
      setSummary(summaryResponse);
      setRoles(rolesResponse);

      setNewUser((currentUser) => {
        if (currentUser.roleId || rolesResponse.length === 0) {
          return currentUser;
        }

        return {
          ...currentUser,
          roleId: String(rolesResponse[0].id),
        };
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load user management data.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const auth = getClientAuth();

      setAuthState(auth);

      if (!auth.isAuthorized) {
        setIsLoading(false);
        return;
      }

      void loadData(auth.token);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

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
        selectedRoleId === "all" ||
        String(user.role?.id ?? "") === selectedRoleId;

      const matchesStatus =
        selectedStatus === "all" ||
        (selectedStatus === "active" && user.isActive) ||
        (selectedStatus === "inactive" && !user.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [searchTerm, selectedRoleId, selectedStatus, users]);

  function getDefaultRoleId() {
    return roles[0] ? String(roles[0].id) : "";
  }

  function resetAddUserForm() {
    setNewUser({
      ...emptyNewUserForm,
      roleId: getDefaultRoleId(),
    });
  }

  function openAddUserForm() {
    resetAddUserForm();
    setEditingUser(null);
    setIsAddUserOpen(true);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function cancelAddUser() {
    resetAddUserForm();
    setIsAddUserOpen(false);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function openEditAccess(user: User) {
    setEditingUser(user);
    setEditRoleId(user.role ? String(user.role.id) : "");
    setEditIsActive(user.isActive);
    setIsAddUserOpen(false);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function closeEditAccess() {
    setEditingUser(null);
    setEditRoleId("");
    setEditIsActive(true);
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function handleAddUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!authState.isAuthorized) {
      setErrorMessage("You are not authorized to create users.");
      return;
    }

    if (!newUser.roleId) {
      setErrorMessage("Please select a role before saving.");
      return;
    }

    if (newUser.password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    setIsSaving(true);

    try {
      await requestJson<User>(`${API_BASE_URL}/users`, authState.token, {
        method: "POST",
        body: JSON.stringify({
          firstName: newUser.firstName.trim(),
          lastName: newUser.lastName.trim(),
          email: newUser.email.trim().toLowerCase(),
          password: newUser.password,
          roleId: Number(newUser.roleId),
          isActive: newUser.isActive,
        }),
      });

      setSuccessMessage("User added successfully.");
      setIsAddUserOpen(false);
      resetAddUserForm();

      await loadData(authState.token);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to add user.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingUser) {
      return;
    }

    if (!authState.isAuthorized) {
      setErrorMessage("You are not authorized to update user access.");
      return;
    }

    if (!editRoleId) {
      setErrorMessage("Please select a role before saving.");
      return;
    }

    setIsUpdatingAccess(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await requestJson<User>(
        `${API_BASE_URL}/users/${editingUser.id}/access`,
        authState.token,
        {
          method: "PATCH",
          body: JSON.stringify({
            roleId: Number(editRoleId),
            isActive: editIsActive,
          }),
        },
      );

      setSuccessMessage("User access updated successfully.");
      closeEditAccess();

      await loadData(authState.token);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update user access.",
      );
    } finally {
      setIsUpdatingAccess(false);
    }
  }

  if (authState.isChecking) {
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

  if (!authState.isAuthorized) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-6 py-8 text-[var(--text-primary)]">
        <section className="mx-auto max-w-3xl rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
          <p className="text-sm font-medium text-[var(--accent)]">
            Access Restricted
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            User Management is admin-only
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {authState.message}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-8 text-[var(--text-primary)]">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--accent)]">
              User Story 204748
            </p>
            <h1 className="mt-1 text-2xl font-semibold">
              User and Role Access Management
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
              Display and monitor system users, assigned roles, account
              statuses, and permission visibility across the inventory system.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadData(authState.token)}
              className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--surface-hover)]"
            >
              Refresh
            </button>

            <button
              type="button"
              onClick={openAddUserForm}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--accent-hover)]"
            >
              Add User
            </button>
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
          <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Add User</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Add a new user account and save it to the backend database.
              </p>
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

              <input
                required
                minLength={8}
                type="password"
                value={newUser.password}
                onChange={(event) =>
                  setNewUser((currentUser) => ({
                    ...currentUser,
                    password: event.target.value,
                  }))
                }
                placeholder="Temporary password"
                className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--input-border-focus)]"
              />

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
                value={newUser.isActive ? "active" : "inactive"}
                onChange={(event) =>
                  setNewUser((currentUser) => ({
                    ...currentUser,
                    isActive: event.target.value === "active",
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
                  {isSaving ? "Saving..." : "Save User"}
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
        )}

        {editingUser && (
          <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Edit User Access</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Update the role and account status for{" "}
                {getUserFullName(editingUser)}.
              </p>
            </div>

            <form
              onSubmit={handleUpdateAccess}
              className="grid gap-3 md:grid-cols-2"
            >
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
                value={editIsActive ? "active" : "inactive"}
                onChange={(event) =>
                  setEditIsActive(event.target.value === "active")
                }
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
                  {isUpdatingAccess ? "Updating..." : "Save Changes"}
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
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="Total Users" value={summary.totalUsers} />
          <SummaryCard title="Active Users" value={summary.activeUsers} />
          <SummaryCard title="Inactive Users" value={summary.inactiveUsers} />
          <SummaryCard
            title="Administrators"
            value={summary.administratorUsers}
          />
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
                      <th className="px-4 py-3 font-medium">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[var(--surface-border)]">
                    {filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="transition hover:bg-[var(--surface-hover)]"
                      >
                        <td className="px-4 py-3 font-medium">
                          {getUserFullName(user)}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">
                          {user.email}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={getUserRoleName(user)}>
                            {getUserRoleName(user)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={user.status}>{user.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openEditAccess(user)}
                            className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-sm font-medium transition hover:bg-[var(--surface-hover)]"
                          >
                            Edit Role
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
                        <h3 className="font-semibold">
                          {getUserFullName(user)}
                        </h3>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {user.email}
                        </p>
                      </div>

                      <Badge variant={user.status}>{user.status}</Badge>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Badge variant={getUserRoleName(user)}>
                        {getUserRoleName(user)}
                      </Badge>
                      <span className="text-sm text-[var(--text-tertiary)]">
                        Created: {formatDate(user.createdAt)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => openEditAccess(user)}
                      className="mt-4 w-full rounded-lg border border-[var(--surface-border)] px-3 py-2 text-sm font-medium transition hover:bg-[var(--surface-hover)]"
                    >
                      Edit Role
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
            </>
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
                    {role.description ?? "No role description available."}
                  </p>

                  <p className="mt-3 text-xs font-medium text-[var(--text-tertiary)]">
                    {role.userCount} user/s • {role.permissionCount}{" "}
                    permission/s
                  </p>

                  <ul className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
                    {role.permissions.length === 0 ? (
                      <li>No permissions assigned.</li>
                    ) : (
                      role.permissions.map((permission) => (
                        <li key={permission.id} className="flex gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                          <span>
                            {permission.name}{" "}
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

function Badge({
  children,
  variant,
}: {
  children: ReactNode;
  variant: string;
}) {
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

  return `${user.firstName} ${user.lastName}`.trim() || "Unnamed User";
}

function getUserRoleName(user: User) {
  return user.role?.name ?? "No role assigned";
}

function getBadgeClass(variant: string) {
  const normalizedVariant = variant.toLowerCase();

  if (normalizedVariant.includes("admin")) {
    return "bg-[var(--accent-muted)] text-[var(--accent)]";
  }

  if (normalizedVariant.includes("staff")) {
    return "bg-[var(--info-muted)] text-[var(--info)]";
  }

  if (normalizedVariant.includes("inactive")) {
    return "bg-[var(--background-tertiary)] text-[var(--text-secondary)]";
  }

  if (normalizedVariant.includes("active")) {
    return "bg-[var(--success-muted)] text-[var(--success)]";
  }

  return "bg-[var(--background-tertiary)] text-[var(--text-secondary)]";
}

function formatDate(dateValue: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateValue));
}
