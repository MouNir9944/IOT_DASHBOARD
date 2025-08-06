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
  const [apiStatus, setApiStatus] = useState<string>('checking');

  // Check API health
  useEffect(() => {
    console.log('Checking API health at:', API_URL);
    fetch(`${API_URL}/api/sites`)
      .then(res => {
        if (res.ok) {
          setApiStatus('connected');
          console.log('✅ API is accessible');
        } else {
          setApiStatus('error');
          console.log('❌ API returned status:', res.status);
        }
      })
      .catch(err => {
        setApiStatus('error');
        console.error('❌ API connection failed:', err);
      });
  }, []);

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
    
    // Add query parameters for filtering
    const params = new URLSearchParams();
    if (session.user.role) {
      params.append('role', session.user.role);
    }
    if (session.user.role === 'admin' && session.user.id) {
      params.append('createdBy', session.user.id);
    }
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    console.log('Fetching sites from:', url);
    fetch(url)
      .then(res => {
        console.log('Sites API response status:', res.status);
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        console.log('Sites API response:', data);
        setAllSites(Array.isArray(data) ? data : []);
      })
      .catch(err => {
        console.error('Error fetching sites:', err);
        setError('Failed to fetch sites');
        setAllSites([]);
      });
  }, [session]);

  // Fetch all users, sending session role and user ID as query params
  useEffect(() => {
    if (!session?.user?.role) return;
    let url = `${API_URL}/api/users?role=${session.user.role}`;
    
    // Add createdBy parameter for admin users
    if (session.user.role === 'admin' && session.user.id) {
      url += `&createdBy=${session.user.id}`;
    }
    
    console.log('Fetching users from:', url);
    fetch(url)
      .then(res => {
        console.log('Users API response status:', res.status);
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        console.log('Users API response:', data);
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
      const url = `${API_URL}/api/users/${userId}`;
      console.log('Deleting user at:', url);
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      console.log('Delete response status:', res.status);
      const data = await res.json();
      console.log('Delete response data:', data);
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');
      setUsers(users.filter(u => u._id !== userId));
      setSuccess('User deleted successfully!');
    } catch (err: any) {
      console.error('Error in handleDelete:', err);
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

    // Validation for site assignment
    if (role === 'user' && sites.length === 0) {
      setError('Please assign exactly one site to this user');
      setLoading(false);
      return;
    }
    if (role === 'user' && sites.length > 1) {
      setError('Users can only be assigned to one site');
      setLoading(false);
      return;
    }
    if (role === 'installator' && sites.length === 0) {
      setError('Please assign at least one site to this installator');
      setLoading(false);
      return;
    }

    // For admin and superadmin, sites are optional but recommended
    if (sites.length === 0 && (role === 'admin' || role === 'superadmin')) {
      const confirmNoSites = window.confirm(
        'No sites are assigned to this user. Admin and Superadmin users typically need site access. Continue anyway?'
      );
      if (!confirmNoSites) {
        setLoading(false);
        return;
      }
    }

    const payload = { 
      name, 
      email, 
      password, 
      role, 
      sites,
      createdBy: session?.user?.id || null // Include the creator's ID
    };
    console.log('Submitting payload:', payload);
    
    try {
      let res: Response, data: any;
      if (editingUser) {
        const url = `${API_URL}/api/users/${editingUser._id}`;
        console.log('Updating user at:', url);
        res = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        console.log('Update response status:', res.status);
        data = await res.json();
        console.log('Update response data:', data);
        if (!res.ok) throw new Error(data.error || 'Failed to update user');
        setUsers(users.map(u => (u._id === editingUser._id ? data : u)));
      } else {
        const url = `${API_URL}/api/users`;
        console.log('Creating user at:', url);
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        console.log('Create response status:', res.status);
        data = await res.json();
        console.log('Create response data:', data);
        if (!res.ok) throw new Error(data.error || 'Failed to create user');
        // The API now returns the user object directly
        setUsers([...users, data]);
      }
      setSuccess(editingUser ? 'User updated successfully!' : 'User created successfully!');
      setEditingUser(null);
      setName('');
      setEmail('');
      setPassword('');
      setRole('user');
      setSites([]);
      handleAfterUserChange();

    } catch (err: any) {
      console.error('Error in handleSubmit:', err);
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
                    <option value="superadmin">Superadmin - Full system access</option>
                  )}
                  <option value="admin">Admin - Site management access</option>
                  <option value="installator">Installator - Device installation access</option>
                  <option value="user">User - Basic site access</option>
                </select>
                <div className="text-xs text-gray-600 mt-1">
                  {role === 'user' && 'Users can only be assigned to one site'}
                  {role === 'installator' && 'Installators require at least one assigned site'}
                  {role === 'admin' && 'Admins can manage multiple sites and create other admins'}
                  {role === 'superadmin' && 'Superadmins have access to all sites'}
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  Assign Sites {sites.length > 0 && <span className="text-green-600">({sites.length} selected)</span>}
                </label>
                <div className="text-xs text-gray-600 mb-2">
                  {session.user.role === 'superadmin' 
                    ? 'Superadmin can assign any site to users'
                    : session.user.role === 'admin'
                    ? 'Admin can assign their accessible sites to users'
                    : role === 'user'
                    ? 'Users can only be assigned to one site'
                    : 'Select sites to assign to this user'
                  }
                </div>
                {role === 'user' ? (
                  <select
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={sites[0] || ''}
                    onChange={e => {
                      setSites(e.target.value ? [e.target.value] : []);
                    }}
                    required
                  >
                    <option value="">Select a site</option>
                    {allSites.map(site => (
                      <option key={site._id} value={site._id}>
                        {site.name} ({site.type || 'unknown type'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[120px]"
                    multiple
                    value={sites}
                    onChange={e => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      setSites(selected);
                    }}
                    required={role === 'installator'}
                  >
                    {allSites.length === 0 ? (
                      <option disabled>No sites available</option>
                    ) : (
                      allSites.map(site => (
                        <option key={site._id} value={site._id}>
                          {site.name} ({site.type || 'unknown type'})
                        </option>
                      ))
                    )}
                  </select>
                )}
                {role !== 'user' && (
                  <div className="text-xs text-gray-500 mt-1">
                    Hold Ctrl (or Cmd on Mac) to select multiple sites
                  </div>
                )}
                {sites.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-semibold text-gray-700 mb-1">Selected Sites:</div>
                    <div className="flex flex-wrap gap-1">
                      {sites.map(siteId => {
                        const site = allSites.find(s => s._id === siteId);
                        return site ? (
                          <span 
                            key={siteId}
                            className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                          >
                            {site.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
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
      {/* Error Display */}
      {error && (
        <div className="w-full mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {/* Success Display */}
      {success && (
        <div className="w-full mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          <strong>Success:</strong> {success}
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
                  <th className="border-b p-2">Created By</th>
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
                      {user.createdBy ? (
                        users.find(u => u._id === user.createdBy)?.name || 'Unknown'
                      ) : (
                        'System'
                      )}
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