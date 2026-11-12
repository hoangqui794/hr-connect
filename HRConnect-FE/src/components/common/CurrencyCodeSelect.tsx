import React from 'react';
import { AutoComplete, Input } from 'antd';
import { DownOutlined } from '@ant-design/icons';

const CURRENCY_OPTIONS = [
  { value: 'VND', label: 'VND — Việt Nam đồng' },
  { value: 'USD', label: 'USD — Đô la Mỹ' },
];

export type CurrencyCodeSelectProps = {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  size?: 'small' | 'middle' | 'large';
  id?: string;
  className?: string;
};

const normalizeCurrencyCode = (value: string) =>
  value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);

/**
 * Currency picker with common choices and support for any ISO 4217 code.
 * The form value is always an uppercase, three-letter code.
 */
export const CurrencyCodeSelect: React.FC<CurrencyCodeSelectProps> = ({
  value,
  onChange,
  disabled,
  size = 'middle',
  id,
  className,
}) => (
  <AutoComplete
    value={value ?? ''}
    options={CURRENCY_OPTIONS}
    onChange={(next) => onChange?.(normalizeCurrencyCode(next))}
    filterOption={false}
    disabled={disabled}
    className={className ?? 'w-full'}
    popupMatchSelectWidth={240}
  >
    <Input
      id={id}
      size={size}
      placeholder="VND, USD hoặc mã khác"
      suffix={<DownOutlined className="text-xs text-slate-400" />}
      aria-label="Tiền tệ"
    />
  </AutoComplete>
);

export const currencyCodeRules = [
  { required: true, message: 'Chọn hoặc nhập tiền tệ.' },
  { pattern: /^[A-Z]{3}$/, message: 'Nhập mã tiền tệ gồm 3 chữ cái, ví dụ EUR.' },
];
