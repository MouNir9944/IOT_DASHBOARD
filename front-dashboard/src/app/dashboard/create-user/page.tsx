"use client";
import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../../../contexts/LanguageContext';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL; // Base API URL

export default function CreateUserPage() {
  const { data: session, status } = useSession();
  const { t } = useLanguage();
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

  // Debug logging
  console.log('CreateUserPage - Session status:', status);
  console.log('CreateUserPage - Session user:', session?.user);
  console.log('CreateUserPage - User role:', session?.user?.role);
  console.log('CreateUserPage - User ID:', session?.user?.id);
  console.log('CreateUserPage - Role comparison:', {
    isAdmin: session?.user?.role === 'admin',
    isSuperadmin: session?.user?.role === 'superadmin',
    isSousAdmin: session?.user?.role === 'sous admin',
    roleString: `"${session?.user?.role}"`,
    roleLength: session?.user?.role?.length
  });

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

  if (status === 'loading') return <div className="p-6 text-center text-gray-600 dark:text-gray-400">{t('common.loading')}</div>;
  if (
    !session ||
    (session.user?.role !== 'admin' && session.user?.role !== 'superadmin' && session.user?.role !== 'sous admin')
  ) {
    console.log('CreateUserPage - Access denied, redirecting to dashboard');
    console.log('CreateUserPage - Required roles: admin, superadmin, or sous admin');
    console.log('CreateUserPage - User role:', session?.user?.role);
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
    if ((session.user.role === 'admin' || session.user.role === 'sous admin') && session.user.id) {
      params.append('userId', session.user.id);
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
    
    // Add createdBy parameter for admin and sous admin users
    if ((session.user.role === 'admin' || session.user.role === 'sous admin') && session.user.id) {
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
      const url = `${API_URL}/api/users/${userId}?creatorRole=${session?.user?.role}&createdBy=${session?.user?.id}`;
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
    if (role === 'technicien' && sites.length === 0) {
      setError('Please assign at least one site to this technicien');
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
      createdBy: session?.user?.id || null, // Include the creator's ID
      creatorRole: session?.user?.role || null // Include the creator's role for backend validation
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
      <div className="p-3 sm:p-6 bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">User Management</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Create and manage users in your system</p>
        </div>
        
        <div className="flex justify-center mb-6">
          <button
            className="bg-blue-600 dark:bg-blue-500 text-white py-2 px-4 rounded font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 transition w-full max-w-xs sm:max-w-md"
            onClick={openCreateModal}
          >
            {t('users.createUser')}
          </button>
        </div>
      {/* Modal for Create/Edit User */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 dark:bg-opacity-60 p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 lg:p-8 rounded-xl shadow-lg w-full max-w-sm sm:max-w-lg lg:max-w-xl relative max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-2 right-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-2xl z-10"
              onClick={() => setIsModalOpen(false)}
            >
              &times;
            </button>
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold mb-4 sm:mb-6 text-blue-700 dark:text-blue-400 pr-8">{modalMode === 'edit' ? t('users.editUser') : t('users.createUser')}</h2>
            <form className="flex flex-col gap-3 sm:gap-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm sm:text-base font-semibold mb-1 text-gray-900 dark:text-gray-100">{t('common.name')}</label>
                <input
                  className="w-full border border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-sm sm:text-base rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm sm:text-base font-semibold mb-1 text-gray-900 dark:text-gray-100">{t('common.email')}</label>
                <input
                  className="w-full border border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-sm sm:text-base rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm sm:text-base font-semibold mb-1 text-gray-900 dark:text-gray-100">{t('profile.changePassword')}</label>
                <input
                  className="w-full border border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-sm sm:text-base rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required={modalMode === 'create'}
                />
              </div>
              <div>
                <label className="block text-sm sm:text-base font-semibold mb-1 text-gray-900 dark:text-gray-100">{t('common.role')}</label>
                <select
                  className="w-full border border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-sm sm:text-base rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  required
                >
                  {session.user.role === 'superadmin' && (
                    <option value="superadmin">Superadmin - Full system access</option>
                  )}
                  {session.user.role === 'superadmin' && (
                    <option value="admin">Admin - Site management access</option>
                  )}
                  {(session.user.role === 'superadmin' || session.user.role === 'admin') && (
                    <option value="sous admin">Sous Admin - Limited admin access</option>
                  )}
                  {(session.user.role === 'superadmin' || session.user.role === 'admin' || session.user.role === 'sous admin') && (
                    <option value="technicien">Technicien - Device installation access</option>
                  )}
                  {(session.user.role === 'superadmin' || session.user.role === 'admin' || session.user.role === 'sous admin') && (
                    <option value="user">User - Basic site access</option>
                  )}
                </select>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {role === 'user' && 'Users can only be assigned to one site'}
                  {role === 'technicien' && 'Techniciens require at least one assigned site'}
                  {role === 'sous admin' && 'Sous Admins can manage multiple sites and create techniciens and users'}
                  {role === 'admin' && 'Admins can manage multiple sites and create sous admins, techniciens, and users (but not other admins)'}
                  {role === 'superadmin' && 'Superadmins have access to all sites and can create all roles'}
                </div>
              </div>
              <div>
                <label className="block text-sm sm:text-base font-semibold mb-1 text-gray-900 dark:text-gray-100">
                  Assign Sites {sites.length > 0 && <span className="text-green-600 dark:text-green-400">({sites.length} selected)</span>}
                </label>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {session.user.role === 'superadmin' 
                    ? 'Superadmin can assign any site to users'
                    : session.user.role === 'admin'
                    ? 'Admin can assign their accessible sites to users'
                    : session.user.role === 'sous admin'
                    ? 'Sous Admin can assign their accessible sites to users'
                    : role === 'user'
                    ? 'Users can only be assigned to one site'
                    : 'Select sites to assign to this user'
                  }
                </div>
                {role === 'user' ? (
                  <select
                    className="w-full border border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-sm sm:text-base rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
                    className="w-full border border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-sm sm:text-base rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 min-h-[100px] sm:min-h-[120px]"
                    multiple
                    value={sites}
                    onChange={e => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      setSites(selected);
                    }}
                    required={role === 'technicien'}
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
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Hold Ctrl (or Cmd on Mac) to select multiple sites
                  </div>
                )}
                {sites.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Selected Sites:</div>
                    <div className="flex flex-wrap gap-1">
                      {sites.map(siteId => {
                        const site = allSites.find(s => s._id === siteId);
                        return site ? (
                          <span 
                            key={siteId}
                            className="inline-block bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded"
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
                className="w-full bg-blue-600 dark:bg-blue-500 text-white py-2 sm:py-3 text-sm sm:text-base rounded font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 transition disabled:opacity-50"
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
                  className="w-full mt-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 py-2 sm:py-3 text-sm sm:text-base rounded font-semibold hover:bg-gray-400 dark:hover:bg-gray-500 transition"
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
            {success && <div className="text-sm sm:text-base text-green-600 dark:text-green-400 mt-4 p-2 bg-green-50 dark:bg-green-900/20 rounded">{success}</div>}
            {error && <div className="text-sm sm:text-base text-red-600 dark:text-red-400 mt-4 p-2 bg-red-50 dark:bg-red-900/20 rounded">{error}</div>}
          </div>
        </div>
      )}
      {/* Error Display */}
      {error && (
        <div className="w-full mt-4 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-3 sm:px-4 py-2 sm:py-3 rounded text-sm sm:text-base">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {/* Success Display */}
      {success && (
        <div className="w-full mt-4 bg-green-100 dark:bg-green-900/20 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-300 px-3 sm:px-4 py-2 sm:py-3 rounded text-sm sm:text-base">
          <strong>Success:</strong> {success}
        </div>
      )}
      
      {/* Users Table */}
      <div className="w-full mt-6 bg-white dark:bg-gray-800 p-3 sm:p-6 lg:p-8 rounded-xl shadow-lg">
        <h2 className="text-lg sm:text-xl font-bold mb-4 text-blue-700 dark:text-blue-400">Users</h2>
        {users.length === 0 ? (
          <div className="text-sm sm:text-base text-gray-500 dark:text-gray-400 text-center py-8">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300 dark:border-gray-600 text-left text-xs sm:text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="border-b border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-gray-900 dark:text-gray-100 whitespace-nowrap">Name</th>
                  <th className="border-b border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-gray-900 dark:text-gray-100 whitespace-nowrap">Email</th>
                  <th className="border-b border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-gray-900 dark:text-gray-100 whitespace-nowrap">Role</th>
                  <th className="border-b border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-gray-900 dark:text-gray-100 whitespace-nowrap">Sites</th>
                  <th className="border-b border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-gray-900 dark:text-gray-100 whitespace-nowrap">Created By</th>
                  <th className="border-b border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-gray-900 dark:text-gray-100 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((user, idx) => (
                  <tr key={user._id || idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="border-b border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-gray-900 dark:text-gray-100 whitespace-nowrap">{user.name || '-'}</td>
                    <td className="border-b border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-gray-900 dark:text-gray-100 whitespace-nowrap max-w-32 sm:max-w-none truncate">{user.email || '-'}</td>
                    <td className="border-b border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-gray-900 dark:text-gray-100 whitespace-nowrap">{user.role || '-'}</td>
                    <td className="border-b border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-gray-900 dark:text-gray-100 max-w-32 sm:max-w-none">
                      <div className="truncate" title={user.sites && user.sites.length > 0
                        ? user.sites.map((site: any) => typeof site === 'string'
                            ? (allSites.find(s => s._id === site)?.name || site)
                            : site.name
                          ).join(', ')
                        : 'None'}>
                        {user.sites && user.sites.length > 0
                          ? user.sites.map((site: any) => typeof site === 'string'
                              ? (allSites.find(s => s._id === site)?.name || site)
                              : site.name
                            ).join(', ')
                          : 'None'}
                      </div>
                    </td>
                    <td className="border-b border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {user.createdBy ? (
                        users.find(u => u._id === user.createdBy)?.name || 'Unknown'
                      ) : (
                        'System'
                      )}
                    </td>
                    <td className="border-b border-gray-300 dark:border-gray-600 p-2 sm:p-3 text-gray-900 dark:text-gray-100">
                      <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                        <button
                          className="bg-yellow-400 dark:bg-yellow-500 px-2 py-1 rounded text-xs hover:bg-yellow-500 dark:hover:bg-yellow-600 transition whitespace-nowrap"
                          onClick={() => openEditModal(user)}
                        >
                          Edit
                        </button>
                        <button
                          className="bg-red-500 dark:bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-600 dark:hover:bg-red-700 transition whitespace-nowrap"
                          onClick={() => handleDelete(user._id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </DashboardLayout>
  );
} 