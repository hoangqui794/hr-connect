import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AccountAvatar } from './AccountAvatar';

describe('AccountAvatar', () => {
  it('renders the stored image for an account', () => {
    render(<AccountAvatar name="Demo Candidate" avatar="https://cdn.example.com/avatar.webp" />);

    expect(screen.getByRole('img', { name: 'Demo Candidate' })).toHaveAttribute(
      'src',
      'https://cdn.example.com/avatar.webp'
    );
  });

  it('falls back to initials when the image cannot load', () => {
    render(<AccountAvatar name="Demo Candidate" avatar="https://cdn.example.com/broken.webp" />);

    fireEvent.error(screen.getByRole('img', { name: 'Demo Candidate' }));

    expect(screen.queryByRole('img', { name: 'Demo Candidate' })).not.toBeInTheDocument();
    expect(screen.getByText('DC')).toBeInTheDocument();
  });
});
