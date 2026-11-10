import React from 'react';
import type { PaginationProps } from 'antd';

const NAMES: Partial<Record<string, string>> = {
  prev: 'Trang trước',
  next: 'Trang sau',
  'jump-prev': 'Lùi 5 trang',
  'jump-next': 'Tiến 5 trang',
};

/**
 * AntD's previous/next pagination buttons hold only an icon, so a screen reader reads no name (C-14).
 * Pass as `itemRender` (Table `pagination` or `<Pagination>`) to give each arrow a Vietnamese name.
 */
export const a11yItemRender: PaginationProps['itemRender'] = (page, type, original) => {
  if (type === 'page') {
    return React.isValidElement(original)
      ? React.cloneElement(original as React.ReactElement<Record<string, unknown>>, { 'aria-label': `Trang ${page}` })
      : original;
  }
  const name = NAMES[type];
  if (!name || !React.isValidElement(original)) return original;
  return React.cloneElement(original as React.ReactElement<Record<string, unknown>>, { 'aria-label': name });
};
