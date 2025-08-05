'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '../components/DashboardLayout';
import { useSession } from 'next-auth/react';
import { 
  ChartBarIcon, 
  BoltIcon, 
  SunIcon, 
  CloudIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  FireIcon
} from '@heroicons/react/24/outline';

const API_URL = 'http://localhost:5000/api/users';

export default function SettingsPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [form, setForm] = useState({
    name: session?.user?.name || '',
    email: session?.user?.email || '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (status === 'loading') return <div className="p-6">Loading...</div>;
  if (!session) {
    router.replace('/login');
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (form.password && form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/${session.user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password ? form.password : undefined
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');
      setSuccess('Profile updated successfully!');
      // Optionally update session info
      await update();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout user={session.user}>
      <div className="max-w-xl mx-auto mt-10 bg-white p-8 rounded-xl shadow">
        <h2 className="text-2xl font-bold mb-6 text-blue-700">User Settings</h2>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block font-semibold mb-1">Name</label>
            <input
              className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Email</label>
            <input
              className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">New Password</label>
            <div className="relative">
              <input
                className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Leave blank to keep current password"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Confirm New Password</label>
            <div className="relative">
              <input
                className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Repeat new password"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                onClick={() => setShowConfirmPassword((v) => !v)}
                tabIndex={-1}
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <button
            className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
        {success && <div className="text-green-600 mt-4">{success}</div>}
        {error && <div className="text-red-600 mt-4">{error}</div>}
      </div>
    </DashboardLayout>
  );
} 