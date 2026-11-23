import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import { api, hasAuthToken, setAuthSession } from '../api';
vi.mock('../api', () => ({ api: vi.fn(), hasAuthToken: vi.fn(), setAuthSession: vi.fn(), clearAuthSession: vi.fn() }));
const customer = { id: 2, name: 'Test Customer', email: 'user@example.com', role: 'CUSTOMER' };
const admin = { id: 1, name: 'Test Admin', email: 'admin@example.com', role: 'ADMIN' };
let account;
function Location() { return <output aria-label="Current URL">{useLocation().pathname}</output>; }
function mount(path) { return render(<MemoryRouter initialEntries={[path]}><App/><Location/></MemoryRouter>); }
beforeEach(() => {
  vi.clearAllMocks(); account = null;hasAuthToken.mockReturnValue(false);
  setAuthSession.mockImplementation(response => response.user);
  api.mockImplementation(async (path, options = {}) => {
    if (path === '/equipment') return [];
    if (path === '/auth/config') return { googleEnabled: false, googleClientId: '' };
    if (path === '/auth/me') return account;
    if (path === '/bookings/mine' || path === '/admin/bookings') return [];
    if (path === '/profile') return { ...account, phone: '', city: options.body?.city || 'Mumbai', bio: '', googleLinked: false, passwordLoginEnabled: true, ...options.body };
    if (path === '/auth/login') return { accessToken: 'signed-token', user: customer };
    return {};
  });
});
describe('Rentora URL routes and account flows', () => {
  it('redirects guests from an admin URL to the login page', async () => {
    mount('/admin/equipment');
    await screen.findByRole('heading', { name: 'Sign in to Rentora' });
    expect(screen.getByLabelText('Current URL').textContent).toBe('/login');
    expect(screen.queryByRole('button', { name: 'Add equipment' })).toBeNull();
  });
  it('keeps customers out of admin pages', async () => {
    account = customer; hasAuthToken.mockReturnValue(true);mount('/admin/equipment');
    await screen.findByRole('heading', { name: 'Good gear. Great plans.' });
    expect(screen.getByLabelText('Current URL').textContent).toBe('/rentals');
  });
  it('opens a customer profile directly and saves changes using the API', async () => {
    account = customer;hasAuthToken.mockReturnValue(true);mount('/profile');
    const city = await screen.findByLabelText('City');
    const events = userEvent.setup();await events.clear(city);await events.type(city, 'Pune');
    await events.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/profile', { method: 'PUT', body: expect.objectContaining({ city: 'Pune' }) }));
    await screen.findByText('Your profile has been updated.');
  });
  it('supports the separate admin profile URL', async () => {
    account = admin;hasAuthToken.mockReturnValue(true);mount('/admin/profile');
    await screen.findByRole('heading', { name: 'Your admin profile.' });
    expect(screen.getByLabelText('Current URL').textContent).toBe('/admin/profile');
    expect((await screen.findByLabelText('Email address')).readOnly).toBe(true);
  });
  it('signs in from the login URL and navigates to customer rentals', async () => {
    mount('/login');const events = userEvent.setup();
    await events.type(await screen.findByLabelText('Email address'), customer.email);
    await events.type(screen.getByLabelText('Password'), 'Password@123');
    await events.click(screen.getByLabelText('Password').closest('form').querySelector('button'));
    await screen.findByRole('heading', { name: 'Good gear. Great plans.' });
    expect(api).toHaveBeenCalledWith('/auth/login', { method: 'POST', skipAuth: true, body: { email: customer.email, password: 'Password@123' } });
    expect(setAuthSession).toHaveBeenCalled();expect(screen.getByLabelText('Current URL').textContent).toBe('/rentals');
  });
  it('returns an expired protected session to the login page', async () => {
    account = customer;hasAuthToken.mockReturnValue(true);mount('/profile');
    await screen.findByLabelText('City');window.dispatchEvent(new Event('rentora:unauthorized'));
    await screen.findByRole('heading', { name: 'Sign in to Rentora' });
    expect(screen.getByLabelText('Current URL').textContent).toBe('/login');
  });
});
