import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

describe('ErrorBoundary', () => {
  it('renders child content normally when no error has occurred', () => {
    const html = renderToStaticMarkup(
      createElement(
        ErrorBoundary,
        null,
        createElement('main', null, 'Safe workspace content')
      )
    );
    expect(html).toContain('Safe workspace content');
    expect(html).not.toContain('Workspace Recovery Needed');
  });

  it('transitions to recovery state via getDerivedStateFromError without leaking error text', () => {
    const derived = ErrorBoundary.getDerivedStateFromError();
    expect(derived).toEqual({ hasError: true });

    const boundary = new ErrorBoundary({
      children: createElement('div', null, 'Hidden child'),
    });
    boundary.state = derived;

    const fallbackHtml = renderToStaticMarkup(
      boundary.render() as React.ReactElement
    );
    expect(fallbackHtml).toContain('role="alert"');
    expect(fallbackHtml).toContain('Workspace Recovery Needed');
    expect(fallbackHtml).toContain('Reset Workspace');
    expect(fallbackHtml).not.toContain('Hidden child');
  });
});
