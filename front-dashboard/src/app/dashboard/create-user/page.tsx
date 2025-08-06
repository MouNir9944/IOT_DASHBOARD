"use client";
import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL; // Base API URL

export default function CreateUserPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [sites, setSites] = useState<string[]>([]);
  const [allSites, setAllSites] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

  if (status === 'loading') return <div className="p-6">Loading...</div>;
  if (
    !session ||
    (session.user?.role !== 'admin' && session.user?.role !== 'superadmin')
  ) {
    router.replace('/dashboard');
    return null;
  }

  // Fetch all sites
  useEffect(() => {
    if (!session?.user) return;
    let url = `${API_URL}/api/sites`;
    if (session.user.role === 'admin') {
      url = `${API_URL}/api/sites/user/${session.user.id}`;
    }
    fetch(url)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => setAllSites(data))
      .catch(err => {
        console.error('Error fetching sites:', err);
        setError('Failed to fetch sites');
      });
  }, [session]);

  // Fetch all users, sending session role as query param
  useEffect(() => {
    if (!session?.user?.role) return;
    fetch(`${API_URL}/api/users?role=${session.user.role}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        console.log('Fetched users:', data);
        if (Array.isArray(data)) {
          setUsers(data);
        } else {
          setUsers([]);
          setError(data.error || 'Failed to fetch users');
        }
      })
      .catch(err => {
        console.error('Error fetching users:', err);
        setError('Failed to fetch users');
        setUsers([]);
      });
  }, [session]);

  // Edit user handler
  const handleEdit = (user: any) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setPassword('');
    setRole(user.role);
    setSites(user.sites ? user.sites.map((s: any) => typeof s === 'string' ? s : s._id) : []);
  };

  // Delete user handler
  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');
      setUsers(users.filter(u => u._id !== userId));
      setSuccess('User deleted successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Update user if editing
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');
    const payload = { name, email, password, role, sites };
    try {
      let res: Response, data: any;
      if (editingUser) {
        res = await fetch(`${API_URL}/api/users/${editingUser._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update user');
        setUsers(users.map(u => (u._id === editingUser._id ? data : u)));
      } else {
        res = await fetch(`${API_URL}/api/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create user');
        // The API now returns the user object directly
        setUsers([...users, data]);
      }
      setSuccess('User updated successfully!');
      setEditingUser(null);
      setName('');
      setEmail('');
      setPassword('');
      setRole('user');
      setSites([]);
      handleAfterUserChange();

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPassword('');
    setRole('user');
    setSites([]);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setPassword('');
    setRole(user.role);
    setSites(user.sites ? user.sites.map((s: any) => typeof s === 'string' ? s : s._id) : []);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const user = {
    name: session.user?.name || 'Admin',
    email: session.user?.email || 'admin@example.com',
    role: session.user?.role || 'admin',
  };

  const handleAfterUserChange = () => {
    setIsModalOpen(false);
    router.refresh();
  };

  return (
    <DashboardLayout user={user}>
      <div className="flex justify-center mt-6 mb-4 w-full px-2 sm:px-0">
        <button
          className="bg-blue-600 text-white py-2 px-4 rounded font-semibold hover:bg-blue-700 transition w-full max-w-xs sm:max-w-md"
          onClick={openCreateModal}
        >
          Create User
        </button>
      </div>
      {/* Modal for Create/Edit User */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 px-2">
          <div className="bg-white p-4 sm:p-8 rounded-xl shadow-lg w-full max-w-xs sm:max-w-lg relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-2xl"
              onClick={() => setIsModalOpen(false)}
            >
              &times;
            </button>
            <h2 className="text-2xl font-bold mb-6 text-blue-700">{modalMode === 'edit' ? 'Edit User' : 'Create New User'}</h2>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div>
                <label className="block font-semibold mb-1">Name</label>
                <input
                  className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Email</label>
                <input
                  className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Password</label>
                <input
                  className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required={modalMode === 'create'}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Role</label>
                <select
                  className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  required
                >
                  {session.user.role === 'superadmin' && (
                    <option value="superadmin">Superadmin</option>
                  )}
                  <option value="admin">Admin</option>
                  <option value="installator">Installator</option>
                  <option value="user">User</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Assign Sites</label>
                <select
                  className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                  multiple
                  value={sites}
                  onChange={e => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setSites(selected);
                  }}
                >
                  {allSites.map(site => (
                    <option key={site._id} value={site._id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? modalMode === 'edit'
                    ? 'Updating...'
                    : 'Creating...'
                  : modalMode === 'edit'
                  ? 'Update User'
                  : 'Create User'}
              </button>
              {editingUser && (
                <button
                  type="button"
                  className="w-full mt-2 bg-gray-300 text-gray-700 py-2 rounded font-semibold hover:bg-gray-400 transition"
                  onClick={() => {
                    setEditingUser(null);
                    setName('');
                    setEmail('');
                    setPassword('');
                    setRole('user');
                    setSites([]);
                    setIsModalOpen(false);
                  }}
                >
                  Cancel Edit
                </button>
              )}
            </form>
            {success && <div className="text-green-600 mt-4">{success}</div>}
            {error && <div className="text-red-600 mt-4">{error}</div>}
          </div>
        </div>
      )}
      {/* Users Table */}
      <div className="w-full mt-6 bg-white p-2 sm:p-8 rounded-xl shadow-lg overflow-x-auto">
        <h2 className="text-xl font-bold mb-4 text-blue-700">Users</h2>
        {users.length === 0 ? (
          <div className="text-gray-500">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border text-left text-xs sm:text-sm">
              <thead>
                <tr>
                  <th className="border-b p-2">Name</th>
                  <th className="border-b p-2">Email</th>
                  <th className="border-b p-2">Role</th>
                  <th className="border-b p-2">Sites</th>
                  <th className="border-b p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => (
                  <tr key={user._id || idx}>
                    <td className="border-b p-2">{user.name || '-'}</td>
                    <td className="border-b p-2">{user.email || '-'}</td>
                    <td className="border-b p-2">{user.role || '-'}</td>
                    <td className="border-b p-2">
                      {user.sites && user.sites.length > 0
                        ? user.sites.map((site: any) => typeof site === 'string'
                            ? (allSites.find(s => s._id === site)?.name || site)
                            : site.name
                          ).join(', ')
                        : 'None'}
                    </td>
                    <td className="border-b p-2">
                      <button
                        className="bg-yellow-400 px-2 py-1 rounded mr-2"
                        onClick={() => openEditModal(user)}
                      >
                        Edit
                      </button>
                      <button
                        className="bg-red-500 text-white px-2 py-1 rounded"
                        onClick={() => handleDelete(user._id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
} 