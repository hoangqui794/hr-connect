import React from 'react';

type PageHeaderProps = {
  title: string;
  description: string;
  actions?: React.ReactNode;
};

export const AffiliatePageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => (
  <header className="affiliate-page-header">
    <div className="affiliate-page-header__copy">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    {actions ? <div className="affiliate-page-header__actions">{actions}</div> : null}
  </header>
);

export const AffiliateSectionHeading: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className="affiliate-section-heading">
    <div>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
    {action}
  </div>
);

export const AffiliateStatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint: string;
  icon: React.ReactNode;
  color?: string;
  softColor?: string;
}> = ({ label, value, hint, icon, color = '#5b3fd6', softColor = '#f1efff' }) => (
  <article
    className="affiliate-stat-card"
    style={{ '--stat-color': color, '--stat-soft': softColor } as React.CSSProperties}
  >
    <span className="affiliate-stat-card__icon" aria-hidden>{icon}</span>
    <span className="affiliate-stat-card__label">{label}</span>
    <span className="affiliate-stat-card__value">{value}</span>
    <span className="affiliate-stat-card__hint">{hint}</span>
  </article>
);

export const AffiliateFlowSteps: React.FC<{ active?: 1 | 2 | 3 }> = ({ active = 1 }) => {
  const steps = ['Chọn cơ hội tuyển dụng', 'Nhập thông tin ứng viên', 'Kiểm tra và gửi'];
  return (
    <ol className="affiliate-stepper" aria-label="Các bước giới thiệu ứng viên">
      {steps.map((step, index) => {
        const number = (index + 1) as 1 | 2 | 3;
        return (
          <li key={step} className={`affiliate-stepper__item ${number <= active ? 'is-active' : ''}`} aria-current={number === active ? 'step' : undefined}>
            <span className="affiliate-stepper__number">{number}</span>
            <span>{step}</span>
          </li>
        );
      })}
    </ol>
  );
};
