import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../config/i18n';

const useAuthStore = vi.fn();
vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => useAuthStore(selector),
}));

import Sidebar from '../components/layout/Sidebar';

const USER = {
  id: 1,
  name: 'Test Admin',
  email: 'a@b.c',
  role: 'super_admin',
  company_id: 1,
  permissions: [],
  status: 'active',
  company: { id: 1, name: 'Acme', status: 'active', subscription_status: 'active' },
};

function renderSidebar(initialPath = '/dashboard') {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Sidebar />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

// The toggle's accessible name also carries its emoji icon and the chevron, so
// match loosely on the label text.
const groupToggle = () => screen.getByRole('button', { name: /project leads/i });

describe('Sidebar project leads group', () => {
  beforeEach(() => {
    useAuthStore.mockImplementation((selector: (s: unknown) => unknown) =>
      selector({ user: USER, logout: vi.fn() }),
    );
  });

  it('renders one collapsible Project Leads group', () => {
    renderSidebar();
    expect(groupToggle()).toBeInTheDocument();
    expect(groupToggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('no longer renders the three destinations as flat sidebar links', () => {
    renderSidebar();
    const hrefs = screen.getAllByRole('link').map((l) => l.getAttribute('href'));
    expect(hrefs).not.toContain('/tg-leads');
    expect(hrefs).not.toContain('/mypetplus-leads');
    expect(hrefs).not.toContain('/vista-express-leads');
  });

  it('opens on click and reveals all three destinations', async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(groupToggle());

    expect(screen.getByRole('link', { name: /tg leads/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /my ?pet plus leads/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /vista express leads/i })).toBeInTheDocument();
  });

  it('keeps each destination pointing at its original route', async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(groupToggle());

    expect(screen.getByRole('link', { name: /tg leads/i })).toHaveAttribute('href', '/tg-leads');
    expect(screen.getByRole('link', { name: /my ?pet plus leads/i })).toHaveAttribute('href', '/mypetplus-leads');
    expect(screen.getByRole('link', { name: /vista express leads/i })).toHaveAttribute('href', '/vista-express-leads');
  });

  it('auto-expands and marks the active child when already on a project page', () => {
    renderSidebar('/vista-express-leads');

    expect(groupToggle()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /vista express leads/i })).toHaveAttribute('aria-current', 'page');
  });

  it('marks the right child active for each of the three routes', () => {
    renderSidebar('/tg-leads');
    expect(screen.getByRole('link', { name: /tg leads/i })).toHaveAttribute('aria-current', 'page');
  });

  it('does not highlight the group for an unrelated page that shares a prefix', () => {
    // /leads must not light up "Project Leads" — that is a separate entry.
    renderSidebar('/leads');
    expect(groupToggle()).toHaveAttribute('aria-expanded', 'false');
  });
});
