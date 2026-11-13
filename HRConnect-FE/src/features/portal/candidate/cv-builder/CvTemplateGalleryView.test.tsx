import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CvTemplateGalleryView, BUILTIN_CV_TEMPLATES } from './CvTemplateGalleryView';

describe('CvTemplateGalleryView Component', () => {
  it('renders all 6 distinct templates in the gallery', () => {
    render(
      <CvTemplateGalleryView
        selectedTemplateCode="STANDARD"
        selectedColor="#0284C7"
        onSelectTemplateAndContinue={vi.fn()}
        onJumpToEditor={vi.fn()}
      />
    );

    expect(screen.getByText('Tiêu chuẩn 1 cột')).toBeInTheDocument();
    expect(screen.getByText('Hiện đại 2 cột')).toBeInTheDocument();
    expect(screen.getByText('Thanh lịch (Header Banner)')).toBeInTheDocument();
    expect(screen.getByText('Tối giản (Minimalist)')).toBeInTheDocument();
    expect(screen.getByText('Chuyên nghiệp (Sidebar phải)')).toBeInTheDocument();
    expect(screen.getByText('Sáng tạo (Timeline dọc)')).toBeInTheDocument();
  });

  it('calls onSelectTemplateAndContinue when clicking "Dùng mẫu này"', () => {
    const handleSelect = vi.fn();
    render(
      <CvTemplateGalleryView
        selectedTemplateCode="STANDARD"
        selectedColor="#0284C7"
        onSelectTemplateAndContinue={handleSelect}
        onJumpToEditor={vi.fn()}
      />
    );

    const useButtons = screen.getAllByRole('button', { name: 'Dùng mẫu này' });
    expect(useButtons.length).toBe(6);

    // Click on the first template ("Tiêu chuẩn 1 cột")
    fireEvent.click(useButtons[0]);
    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'STANDARD' }),
      '#0284C7'
    );
  });

  it('filters templates when clicking category pills', () => {
    render(
      <CvTemplateGalleryView
        selectedTemplateCode="STANDARD"
        selectedColor="#0284C7"
        onSelectTemplateAndContinue={vi.fn()}
        onJumpToEditor={vi.fn()}
      />
    );

    // Click "Hiện đại" category
    const modernPill = screen.getByRole('button', { name: 'Hiện đại' });
    fireEvent.click(modernPill);

    expect(screen.getByText('Hiện đại 2 cột')).toBeInTheDocument();
    expect(screen.getByText('Thanh lịch (Header Banner)')).toBeInTheDocument();
    expect(screen.getByText('Chuyên nghiệp (Sidebar phải)')).toBeInTheDocument();
    expect(screen.queryByText('Tiêu chuẩn 1 cột')).not.toBeInTheDocument();
  });

  it('opens preview modal when clicking "Xem trước"', () => {
    render(
      <CvTemplateGalleryView
        selectedTemplateCode="STANDARD"
        selectedColor="#0284C7"
        onSelectTemplateAndContinue={vi.fn()}
        onJumpToEditor={vi.fn()}
      />
    );

    const previewButtons = screen.getAllByRole('button', { name: 'Xem trước' });
    fireEvent.click(previewButtons[0]);

    // Preview modal title should appear
    expect(screen.getByText(/Xem trước mẫu: Tiêu chuẩn 1 cột/i)).toBeInTheDocument();
  });
});
