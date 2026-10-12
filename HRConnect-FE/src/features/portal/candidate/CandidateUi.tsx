import React from 'react';
import type { ReactNode } from 'react';

type CandidatePageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export const CandidatePageHeader: React.FC<CandidatePageHeaderProps> = ({ eyebrow, title, description, actions }) => (
  <header className="candidate-page-header">
    <div className="min-w-0">
      {eyebrow && <p className="candidate-eyebrow">{eyebrow}</p>}
      <h1 className="candidate-page-title">{title}</h1>
      {description && <p className="candidate-page-description">{description}</p>}
    </div>
    {actions && <div className="candidate-page-actions">{actions}</div>}
  </header>
);

type CandidateSurfaceProps = React.HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'section' | 'article';
};

export const CandidateSurface: React.FC<CandidateSurfaceProps> = ({ as: Component = 'section', className = '', children, ...props }) => (
  <Component className={`candidate-surface ${className}`.trim()} {...props}>
    {children}
  </Component>
);

