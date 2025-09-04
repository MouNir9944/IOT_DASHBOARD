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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto p-3 sm:p-6 md:p-8 lg:p-10">
          {/* Header */}
          <div className="mb-3 sm:mb-6 lg:mb-8">
            <div className="flex flex-col gap-3">
              <div className="text-center sm:text-left">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">User Management</h1>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Create and manage users in your system</p>
              </div>
              <div className="flex justify-center sm:justify-start">
                <button
                  className="bg-blue-600 dark:bg-blue-500 text-white py-2.5 px-4 rounded-lg font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors w-full sm:w-auto min-w-[140px] shadow-md hover:shadow-lg text-sm sm:text-base touch-manipulation"
                  onClick={openCreateModal}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="text-base">+</span>
                    <span>{t('users.createUser')}</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
          {/* Modal for Create/Edit User */}
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 dark:bg-opacity-60 p-2 sm:p-4">
              <div className="bg-white dark:bg-gray-800 p-3 sm:p-6 lg:p-8 rounded-xl shadow-2xl w-full max-w-sm sm:max-w-lg lg:max-w-2xl xl:max-w-3xl relative max-h-[95vh] overflow-y-auto">
                <button
                  className="absolute top-2 right-2 sm:top-4 sm:right-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-xl sm:text-2xl z-10 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  onClick={() => setIsModalOpen(false)}
                >
                  &times;
                </button>
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold mb-3 sm:mb-4 text-blue-700 dark:text-blue-400 pr-8">{modalMode === 'edit' ? t('users.editUser') : t('users.createUser')}</h2>
                <form className="flex flex-col gap-4 sm:gap-5 lg:gap-6" onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                    <div>
                      <label className="block text-sm sm:text-base font-semibold mb-2 text-gray-900 dark:text-gray-100">{t('common.name')}</label>
                      <input
                        className="w-full border border-gray-300 dark:border-gray-600 p-3 text-sm sm:text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                        placeholder="Enter full name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm sm:text-base font-semibold mb-2 text-gray-900 dark:text-gray-100">{t('common.email')}</label>
                      <input
                        className="w-full border border-gray-300 dark:border-gray-600 p-3 text-sm sm:text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        placeholder="Enter email address"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm sm:text-base font-semibold mb-2 text-gray-900 dark:text-gray-100">{t('profile.changePassword')}</label>
                    <input
                      className="w-full border border-gray-300 dark:border-gray-600 p-3 text-sm sm:text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required={modalMode === 'create'}
                      placeholder={modalMode === 'create' ? 'Enter password' : 'Leave blank to keep current password'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm sm:text-base font-semibold mb-2 text-gray-900 dark:text-gray-100">{t('common.role')}</label>
                    <select
                      className="w-full border border-gray-300 dark:border-gray-600 p-3 text-sm sm:text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
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
                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      {role === 'user' && 'Users can only be assigned to one site'}
                      {role === 'technicien' && 'Techniciens require at least one assigned site'}
                      {role === 'sous admin' && 'Sous Admins can manage multiple sites and create techniciens and users'}
                      {role === 'admin' && 'Admins can manage multiple sites and create sous admins, techniciens, and users (but not other admins)'}
                      {role === 'superadmin' && 'Superadmins have access to all sites and can create all roles'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm sm:text-base font-semibold mb-2 text-gray-900 dark:text-gray-100">
                      Assign Sites {sites.length > 0 && <span className="text-green-600 dark:text-green-400">({sites.length} selected)</span>}
                    </label>
                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
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
                        className="w-full border border-gray-300 dark:border-gray-600 p-3 text-sm sm:text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
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
                        className="w-full border border-gray-300 dark:border-gray-600 p-3 text-sm sm:text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 min-h-[120px] sm:min-h-[140px] transition-colors"
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
                      <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        💡 Hold Ctrl (or Cmd on Mac) to select multiple sites
                      </div>
                    )}
                    {sites.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Selected Sites:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {sites.map(siteId => {
                            const site = allSites.find(s => s._id === siteId);
                            return site ? (
                              <span 
                                key={siteId}
                                className="inline-block bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full border border-blue-200 dark:border-blue-700"
                              >
                                {site.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <button
                      className="flex-1 bg-blue-600 dark:bg-blue-500 text-white py-3 text-sm sm:text-base rounded-lg font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 shadow-md hover:shadow-lg touch-manipulation"
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
                        className="flex-1 sm:flex-none sm:min-w-[120px] bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 py-3 text-sm sm:text-base rounded-lg font-semibold hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors touch-manipulation"
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
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
                {success && (
                  <div className="text-sm text-green-600 dark:text-green-400 mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                    ✅ {success}
                  </div>
                )}
                {error && (
                  <div className="text-sm text-red-600 dark:text-red-400 mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
                    ❌ {error}
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Error Display */}
          {error && (
            <div className="w-full mt-3 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">
              <strong>Error:</strong> {error}
            </div>
          )}
          
          {/* Success Display */}
          {success && (
            <div className="w-full mt-3 bg-green-100 dark:bg-green-900/20 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-300 px-3 py-2 rounded-lg text-sm">
              <strong>Success:</strong> {success}
            </div>
          )}
          
          {/* Users Table */}
          <div className="w-full mt-4 sm:mt-6 bg-white dark:bg-gray-800 p-3 sm:p-6 lg:p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col gap-2 mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-700 dark:text-blue-400 text-center sm:text-left">Users</h2>
              <div className="text-sm sm:text-base text-gray-600 dark:text-gray-400 text-center sm:text-left">
                {users.length} user{users.length !== 1 ? 's' : ''} found
              </div>
            </div>
            {users.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <div className="text-gray-400 dark:text-gray-500 text-4xl sm:text-5xl mb-4">👥</div>
                <div className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-2">No users found</div>
                <div className="text-xs sm:text-sm text-gray-400 dark:text-gray-500">Create your first user to get started</div>
              </div>
            ) : (
              <div>
                {/* Mobile Card Layout */}
                <div className="block sm:hidden space-y-3">
                  {users.map((user, idx) => (
                    <div key={user._id || idx} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {user.name || 'Unnamed User'}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-1">
                            {user.email || '-'}
                          </p>
                        </div>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ml-2 ${
                          user.role === 'superadmin' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200' :
                          user.role === 'admin' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' :
                          user.role === 'sous admin' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200' :
                          user.role === 'technicien' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                          'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200'
                        }`}>
                          {user.role || '-'}
                        </span>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20">Sites:</span>
                          <span className="text-sm text-gray-900 dark:text-gray-100">
                            {user.sites && user.sites.length > 0
                              ? user.sites.map((site: any) => typeof site === 'string'
                                  ? (allSites.find(s => s._id === site)?.name || site)
                                  : site.name
                                ).join(', ')
                              : 'None'}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20">Created by:</span>
                          <span className="text-sm text-gray-900 dark:text-gray-100">
                            {user.createdBy ? (
                              users.find(u => u._id === user.createdBy)?.name || 'Unknown'
                            ) : (
                              'System'
                            )}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          className="flex-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-200 py-2 px-3 rounded-lg text-sm font-medium hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors touch-manipulation"
                          onClick={() => openEditModal(user)}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="flex-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 py-2 px-3 rounded-lg text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors touch-manipulation"
                          onClick={() => handleDelete(user._id)}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden sm:block">
                  <div className="overflow-x-auto shadow-sm rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Name</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Email</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Role</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Sites</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Created By</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {users.map((user, idx) => (
                          <tr key={user._id || idx} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {user.name || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                              <div className="truncate max-w-xs" title={user.email || '-'}>
                                {user.email || '-'}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                user.role === 'superadmin' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200' :
                                user.role === 'admin' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' :
                                user.role === 'sous admin' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200' :
                                user.role === 'technicien' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                                'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                              }`}>
                                {user.role || '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                              <div className="truncate max-w-xs" title={user.sites && user.sites.length > 0
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
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                              {user.createdBy ? (
                                users.find(u => u._id === user.createdBy)?.name || 'Unknown'
                              ) : (
                                'System'
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                              <div className="flex gap-2">
                                <button
                                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-yellow-700 dark:text-yellow-200 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-md hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
                                  onClick={() => openEditModal(user)}
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-200 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                  onClick={() => handleDelete(user._id)}
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
} 